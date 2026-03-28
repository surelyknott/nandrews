const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const templateConfig = require('../../shared/template-config');
const bookingRules = require('../../shared/booking-rules');
const { isDateBooked } = require('./_lib/bookings');
const { fetchSheetRows, getAccessToken } = require('./_lib/google-sheets');

const parseJson = (body) => {
  try {
    return JSON.parse(body || '{}');
  } catch (error) {
    return null;
  }
};

const resolveBaseUrl = (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  if (origin && /^https?:\/\//.test(origin)) {
    return origin.replace(/\/$/, '');
  }

  return String(process.env.BASE_URL || '').replace(/\/$/, '');
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Stripe is not configured.' })
    };
  }

  const payload = parseJson(event.body);
  if (!payload) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { date, guests, name, email, phone } = payload;
  const guestCount = Number.parseInt(String(guests || ''), 10);
  const normalizedDate = bookingRules.normalizeDateInput(date);

  if (!normalizedDate || !email || !name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
  }

  if (!Number.isInteger(guestCount) || guestCount < 1) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Guest count must be at least 1.' }) };
  }

  const paymentSchedule = bookingRules.calculatePaymentSchedule({
    eventDate: normalizedDate,
    guestCount,
    bookingConfig: templateConfig.booking
  });
  const amountInPence = Math.round(Number(paymentSchedule.chargeNowAmount) * 100);

  if (!amountInPence) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unable to calculate the payment amount.' }) };
  }

  const baseUrl = resolveBaseUrl(event);
  if (!baseUrl) {
    return { statusCode: 500, body: JSON.stringify({ error: 'BASE_URL is not configured.' }) };
  }

  try {
    const accessToken = await getAccessToken({ readOnly: true });
    const rows = await fetchSheetRows(accessToken);

    if (isDateBooked(rows, normalizedDate)) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'That date has already been booked. Please choose another date.' })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Unable to verify availability.' })
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: templateConfig.site.currency.toLowerCase(),
            unit_amount: amountInPence,
            product_data: {
              name: `${paymentSchedule.requiresFullPayment ? 'Full payment' : 'Deposit'} for ${templateConfig.site.bookingLabel} on ${bookingRules.formatDate(normalizedDate, {
                locale: templateConfig.site.locale,
                formatOptions: { year: 'numeric', month: 'short', day: '2-digit' }
              })}`
            }
          },
          quantity: 1
        }
      ],
      metadata: {
        date: normalizedDate,
        guests: String(guestCount),
        name,
        email,
        phone: phone || '',
        booking_type: paymentSchedule.requiresFullPayment ? 'full' : 'deposit',
        estimated_total: String(paymentSchedule.estimatedTotal),
        balance_due_date: paymentSchedule.balanceDueIso
      },
      success_url: `${baseUrl}/?payment=success`,
      cancel_url: `${baseUrl}/?payment=cancel`
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: session.url,
        checkout: {
          estimatedTotal: paymentSchedule.estimatedTotal,
          chargeNowAmount: paymentSchedule.chargeNowAmount,
          requiresFullPayment: paymentSchedule.requiresFullPayment
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Unable to create checkout session.' })
    };
  }
};
