const bookingRules = require('../../../shared/booking-rules');

const normalizeHeader = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
);

const mapSheetRows = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map(normalizeHeader);

  return dataRows.map((row) => headers.reduce((record, key, index) => {
    record[key] = row[index] || '';
    return record;
  }, {}));
};

const isBookedStatus = (status) => String(status || 'booked').trim().toLowerCase() === 'booked';

const isDateBooked = (rows, date) => {
  const targetDate = bookingRules.normalizeDateInput(date);
  if (!targetDate) return false;

  return mapSheetRows(rows).some((row) => (
    bookingRules.normalizeDateInput(row.date) === targetDate &&
    isBookedStatus(row.status)
  ));
};

const hasStripeSessionRecorded = (rows, stripeSessionId) => {
  if (!stripeSessionId) return false;

  return mapSheetRows(rows).some((row) => (
    String(row.stripe_session_id || '').trim() === String(stripeSessionId)
  ));
};

module.exports = {
  hasStripeSessionRecorded,
  isDateBooked,
  mapSheetRows
};
