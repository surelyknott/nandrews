const templateConfig = require('../../shared/template-config');
const bookingRules = require('../../shared/booking-rules');
const { appendSheetRow, fetchSheetRows, getAccessToken } = require('./_lib/google-sheets');
const { isTimeSlotTaken } = require('./_lib/bookings');

const SHEET_HEADER_ROW = [
  'date',
  'time',
  'service',
  'name',
  'email',
  'phone',
  'vehicle',
  'notes',
  'status',
  'created_at'
];

const parseJson = (body) => {
  try {
    return JSON.parse(body || '{}');
  } catch (error) {
    return null;
  }
};

const normalizeService = (service) => String(service || '').trim();

const isAllowedService = (service) => (
  (templateConfig.booking.serviceOptions || []).includes(normalizeService(service))
);

const buildConfirmationHtml = ({ service, date, time, name, phone, vehicle, notes }) => {
  const lines = [
    `<p>Hi ${name},</p>`,
    `<p>Your appointment has been booked with ${templateConfig.site.businessName}.</p>`,
    '<p><strong>Booking details</strong><br>',
    `Service: ${service}<br>`,
    `Date: ${bookingRules.formatDate(date, {
      locale: templateConfig.site.locale,
      formatOptions: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    })}<br>`,
    `Time: ${bookingRules.formatTimeLabel(time, templateConfig.site.locale)}<br>`,
    `Phone: ${phone}<br>`,
    `${vehicle ? `Vehicle: ${vehicle}<br>` : ''}`,
    `${notes ? `Notes: ${notes}<br>` : ''}`,
    '</p>',
    `<p>If anything changes, call the garage on ${templateConfig.site.contactPhone}.</p>`,
    `<p>Thanks,<br>${templateConfig.site.businessName}</p>`
  ];

  return lines.join('');
};

const sendConfirmationEmail = async (payload) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (!apiKey || !fromEmail || !payload.email) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: payload.email,
      reply_to: replyTo || undefined,
      subject: `Booking confirmed — ${templateConfig.site.businessName}`,
      html: buildConfirmationHtml(payload)
    })
  });

  if (!response.ok) {
    throw new Error('Unable to send confirmation email.');
  }

  return true;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const payload = parseJson(event.body);
  if (!payload) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body.' })
    };
  }

  const service = normalizeService(payload.service);
  const date = bookingRules.normalizeDateInput(payload.date);
  const time = bookingRules.normalizeTimeInput(payload.time);
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  const email = String(payload.email || '').trim();
  const vehicle = String(payload.vehicle || '').trim();
  const notes = String(payload.notes || '').trim();
  const availableSlots = bookingRules.buildTimeSlots(templateConfig.booking);

  if (!service || !date || !time || !name || !phone) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Service, date, time, name, and phone are required.' })
    };
  }

  if (!isAllowedService(service)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Please choose a valid service.' })
    };
  }

  if (!bookingRules.isBusinessDay(date, templateConfig.booking.businessDays)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Please choose a weekday appointment.' })
    };
  }

  if (!availableSlots.includes(time)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Please choose a valid appointment time.' })
    };
  }

  try {
    const accessToken = await getAccessToken();
    const rows = await fetchSheetRows(accessToken);

    if (isTimeSlotTaken(rows, {
      date,
      time,
      blockedStatuses: templateConfig.booking.blockedStatuses
    })) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'That time has already been booked. Please choose another slot.' })
      };
    }

    if (!rows.length) {
      await appendSheetRow(accessToken, SHEET_HEADER_ROW);
    }

    await appendSheetRow(accessToken, [
      date,
      time,
      service,
      name,
      email,
      phone,
      vehicle,
      notes,
      'confirmed',
      new Date().toISOString()
    ]);

    let emailSent = false;
    if (email) {
      try {
        emailSent = await sendConfirmationEmail({
          service,
          date,
          time,
          name,
          phone,
          email,
          vehicle,
          notes
        });
      } catch (error) {
        emailSent = false;
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        emailSent,
        message: email
          ? 'Appointment confirmed. A confirmation email is on its way.'
          : 'Appointment confirmed. The garage has received your booking.'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Unable to save appointment.' })
    };
  }
};
