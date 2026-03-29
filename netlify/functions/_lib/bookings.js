const bookingRules = require('../../../shared/booking-rules');

const normalizeHeader = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
);

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const mapSheetRows = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map(normalizeHeader);

  return dataRows.map((row) => headers.reduce((record, key, index) => {
    record[key] = row[index] || '';
    return record;
  }, {}));
};

const isUnavailableStatus = (status, blockedStatuses = ['booked', 'confirmed', 'blocked', 'pending']) => {
  const normalizedStatus = normalizeStatus(status || 'confirmed');
  return blockedStatuses.includes(normalizedStatus);
};

const getUnavailableSlotsByDate = (rows, date, blockedStatuses) => {
  const targetDate = bookingRules.normalizeDateInput(date);
  if (!targetDate) return new Set();

  return mapSheetRows(rows).reduce((slots, row) => {
    if (!isUnavailableStatus(row.status, blockedStatuses)) return slots;
    if (bookingRules.normalizeDateInput(row.date) !== targetDate) return slots;

    const normalizedTime = bookingRules.normalizeTimeInput(row.time);
    if (normalizedTime) slots.add(normalizedTime);
    return slots;
  }, new Set());
};

const isDateBooked = (rows, date) => {
  const targetDate = bookingRules.normalizeDateInput(date);
  if (!targetDate) return false;

  return mapSheetRows(rows).some((row) => (
    bookingRules.normalizeDateInput(row.date) === targetDate &&
    isUnavailableStatus(row.status)
  ));
};

const isTimeSlotTaken = (rows, { date, time, blockedStatuses } = {}) => {
  const normalizedDate = bookingRules.normalizeDateInput(date);
  const normalizedTime = bookingRules.normalizeTimeInput(time);
  if (!normalizedDate || !normalizedTime) return false;

  return mapSheetRows(rows).some((row) => (
    bookingRules.normalizeDateInput(row.date) === normalizedDate &&
    bookingRules.normalizeTimeInput(row.time) === normalizedTime &&
    isUnavailableStatus(row.status, blockedStatuses)
  ));
};

const hasStripeSessionRecorded = (rows, stripeSessionId) => {
  if (!stripeSessionId) return false;

  return mapSheetRows(rows).some((row) => (
    String(row.stripe_session_id || '').trim() === String(stripeSessionId)
  ));
};

module.exports = {
  getUnavailableSlotsByDate,
  hasStripeSessionRecorded,
  isDateBooked,
  isTimeSlotTaken,
  mapSheetRows
};
