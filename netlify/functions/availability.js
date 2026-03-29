const { fetchSheetRows, getAccessToken } = require('./_lib/google-sheets');
const { mapSheetRows } = require('./_lib/bookings');
const templateConfig = require('../../shared/template-config');
const bookingRules = require('../../shared/booking-rules');

exports.handler = async () => {
  try {
    const accessToken = await getAccessToken({ readOnly: true });
    const rows = await fetchSheetRows(accessToken);
    const mappedRows = mapSheetRows(rows);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: mappedRows,
        timeSlots: bookingRules.buildTimeSlots(templateConfig.booking),
        businessDays: templateConfig.booking.businessDays || [1, 2, 3, 4, 5],
        blockedStatuses: templateConfig.booking.blockedStatuses || ['booked', 'confirmed', 'blocked', 'pending']
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Unable to load availability.' })
    };
  }
};
