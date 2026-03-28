const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const templateConfig = require('../../shared/template-config');
const bookingRules = require('../../shared/booking-rules');
const { appendSheetRow, fetchSheetRows, getAccessToken } = require('./_lib/google-sheets');
const { hasStripeSessionRecorded, isDateBooked } = require('./_lib/bookings');

const buildEmailHtml = (details) => {
  const lines = [
    `<p>Hi ${details.name},</p>`,
    `<p>Thanks for your booking. Your ${details.paymentLabel.toLowerCase()} has been received and your date is reserved.</p>`,
    '<p><strong>Booking details</strong><br>',
    `Event date: ${details.date}<br>`,
    `Guest count: ${details.guests}<br>`,
    `${details.paymentLabel}: ${details.amountPaid}<br>`,
    `Estimated total: ${details.estimatedTotal}<br>`,
    `Balance remaining: ${details.balanceRemaining}<br>`,
    `Balance due by: ${details.balanceDue}</p>`,
    '<p><strong>Important terms</strong><br>',
    'Deposits are non-refundable.<br>',
    `${bookingRules.buildGuestPricingText(templateConfig.booking, templateConfig.site)}<br>`,
    `${bookingRules.buildBookingPolicyText(templateConfig.booking)}</p>`,
    '<p>If you need to make changes, reply to this email.</p>',
    `<p>Thanks,<br>${templateConfig.site.businessName}</p>`
  ];

  return lines.join('');
};

const sendConfirmationEmail = async (payload) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (!apiKey || !fromEmail || !payload.email) return;

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
      subject: `Your booking is confirmed — ${templateConfig.site.businessName}`,
      html: buildEmailHtml(payload)
    })
  });

  if (!response.ok) {
    throw new Error('Unable to send confirmation email.');
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const signature = event.headers['stripe-signature'];
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 400, body: 'Missing Stripe signature.' };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Ignored event.' };
  }

  const session = stripeEvent.data.object;
  const metadata = session.metadata || {};
  const date = bookingRules.normalizeDateInput(metadata.date);
  const guests = metadata.guests || '';
  const name = metadata.name || '';
  const email = session.customer_details?.email || session.customer_email || metadata.email || '';
  const phone = metadata.phone || '';
  const bookingType = metadata.booking_type === 'full' ? 'full' : 'deposit';
  const amountPaidMinorUnits = session.amount_total || 0;
  const amountPaid = Number((amountPaidMinorUnits / 100).toFixed(2));
  const guestCount = Number.parseInt(guests || '0', 10);
  const paymentSchedule = bookingRules.calculatePaymentSchedule({
    eventDate: date,
    guestCount,
    bookingConfig: templateConfig.booking
  });
  const balanceRemainingAmount = bookingType === 'full'
    ? 0
    : Math.max(paymentSchedule.estimatedTotal - amountPaid, 0);
  const formattedEventDate = bookingRules.formatDate(date, {
    locale: templateConfig.site.locale,
    formatOptions: { year: 'numeric', month: 'short', day: '2-digit' }
  });

  try {
    const accessToken = await getAccessToken();
    const rows = await fetchSheetRows(accessToken);

    if (hasStripeSessionRecorded(rows, session.id)) {
      return { statusCode: 200, body: 'Booking already recorded for this session.' };
    }

    if (isDateBooked(rows, date)) {
      return { statusCode: 200, body: 'Date already booked. Manual review required.' };
    }

    await appendSheetRow(accessToken, [
      date,
      'booked',
      name,
      email,
      phone,
      guests,
      amountPaid,
      balanceRemainingAmount,
      paymentSchedule.balanceDueIso,
      bookingType,
      session.id,
      bookingType === 'full' ? 'Paid in full at checkout.' : 'Deposit paid via Stripe Checkout.'
    ]);

    try {
      await sendConfirmationEmail({
        date: formattedEventDate,
        guests,
        name,
        email,
        amountPaid: bookingRules.formatCurrency(amountPaid, templateConfig.site),
        estimatedTotal: bookingRules.formatCurrency(paymentSchedule.estimatedTotal, templateConfig.site),
        balanceRemaining: bookingRules.formatCurrency(balanceRemainingAmount, templateConfig.site),
        balanceDue: paymentSchedule.requiresFullPayment
          ? 'Paid in full'
          : bookingRules.formatDate(paymentSchedule.balanceDueIso, {
            locale: templateConfig.site.locale,
            formatOptions: { year: 'numeric', month: 'short', day: '2-digit' }
          }),
        paymentLabel: bookingType === 'full' ? 'Full payment' : 'Deposit'
      });
    } catch (error) {
      return { statusCode: 200, body: 'Booking recorded. Confirmation email failed to send.' };
    }

    return { statusCode: 200, body: 'Booking recorded.' };
  } catch (error) {
    return { statusCode: 500, body: error.message || 'Webhook failed.' };
  }
};
