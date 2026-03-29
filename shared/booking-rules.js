(function initBookingRules(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.BookingTemplateRules = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const DEFAULT_LOCALE = 'en-GB';
  const DEFAULT_CURRENCY = 'GBP';
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MS_PER_MINUTE = 60 * 1000;

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeDateInput = (rawDate) => {
    const isValidDateParts = (year, month, day) => {
      const y = Number.parseInt(year, 10);
      const m = Number.parseInt(month, 10);
      const d = Number.parseInt(day, 10);

      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
      if (m < 1 || m > 12 || d < 1 || d > 31) return false;

      const checkDate = new Date(Date.UTC(y, m - 1, d));
      return (
        checkDate.getUTCFullYear() === y &&
        checkDate.getUTCMonth() === m - 1 &&
        checkDate.getUTCDate() === d
      );
    };

    const dateStr = String(rawDate || '').trim();
    if (!dateStr) return '';

    const isoStyle = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoStyle) {
      const [, year, month, day] = isoStyle;
      return isValidDateParts(year, month, day) ? dateStr : '';
    }

    const ukStyle = dateStr.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (!ukStyle) return '';

    const [, day, month, year] = ukStyle;
    const isoDate = `${year}-${month}-${day}`;
    return isValidDateParts(year, month, day) ? isoDate : '';
  };

  const toDate = (dateInput) => {
    if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
      return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
    }

    const normalizedDate = normalizeDateInput(dateInput);
    if (!normalizedDate) return null;

    const date = new Date(`${normalizedDate}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const toIsoDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (dateInput, options = {}) => {
    const date = toDate(dateInput);
    if (!date) return '';

    const locale = options.locale || DEFAULT_LOCALE;
    const formatOptions = options.formatOptions || {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };

    return new Intl.DateTimeFormat(locale, formatOptions).format(date);
  };

  const formatDisplayDate = (dateInput, options = {}) => (
    formatDate(dateInput, options).replace(/\//g, '-')
  );

  const addDays = (dateInput, days) => {
    const date = toDate(dateInput);
    if (!date) return '';

    date.setDate(date.getDate() + days);
    return toIsoDateString(date);
  };

  const normalizeTimeInput = (rawTime) => {
    const timeStr = String(rawTime || '').trim();
    if (!timeStr) return '';

    const hhmm = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const hours = Number.parseInt(hhmm[1], 10);
      const minutes = Number.parseInt(hhmm[2], 10);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }

    const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
    if (!ampm) return '';

    let hours = Number.parseInt(ampm[1], 10);
    const minutes = Number.parseInt(ampm[2], 10);
    const meridiem = ampm[3].toLowerCase();
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '';

    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const formatTimeLabel = (timeInput, locale = DEFAULT_LOCALE) => {
    const normalizedTime = normalizeTimeInput(timeInput);
    if (!normalizedTime) return '';

    const [hours, minutes] = normalizedTime.split(':').map((value) => Number.parseInt(value, 10));
    const date = new Date(2000, 0, 1, hours, minutes, 0, 0);
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  const isBusinessDay = (dateInput, businessDays = [1, 2, 3, 4, 5]) => {
    const date = toDate(dateInput);
    if (!date) return false;

    const allowedDays = Array.isArray(businessDays)
      ? businessDays.map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger)
      : [1, 2, 3, 4, 5];

    return allowedDays.includes(date.getDay());
  };

  const compareTimes = (left, right) => {
    const leftNormalized = normalizeTimeInput(left);
    const rightNormalized = normalizeTimeInput(right);
    if (!leftNormalized || !rightNormalized) return 0;
    return leftNormalized.localeCompare(rightNormalized);
  };

  const buildTimeSlots = (bookingConfig = {}) => {
    const start = normalizeTimeInput(bookingConfig.firstSlot);
    const end = normalizeTimeInput(bookingConfig.lastSlot);
    const slotIntervalMinutes = toNumber(bookingConfig.slotIntervalMinutes, 30);
    if (!start || !end || slotIntervalMinutes < 1) return [];

    const [startHour, startMinute] = start.split(':').map((value) => Number.parseInt(value, 10));
    const [endHour, endMinute] = end.split(':').map((value) => Number.parseInt(value, 10));
    const startDate = new Date(2000, 0, 1, startHour, startMinute, 0, 0);
    const endDate = new Date(2000, 0, 1, endHour, endMinute, 0, 0);
    if (endDate < startDate) return [];

    const slots = [];
    for (let cursor = startDate.getTime(); cursor <= endDate.getTime(); cursor += slotIntervalMinutes * MS_PER_MINUTE) {
      const date = new Date(cursor);
      slots.push(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
    }

    return slots;
  };

  const getDepositAmount = (eventDate, bookingConfig = {}) => {
    const normalizedDate = normalizeDateInput(eventDate);
    const defaultDeposit = toNumber(bookingConfig.depositAmount);
    if (!normalizedDate) return defaultDeposit;

    const eventYear = Number.parseInt(normalizedDate.slice(0, 4), 10);
    const overrides = bookingConfig.depositOverridesByYear || {};
    const thresholds = Object.keys(overrides)
      .map((year) => Number.parseInt(year, 10))
      .filter(Number.isInteger)
      .sort((left, right) => right - left);

    for (const threshold of thresholds) {
      if (eventYear >= threshold) {
        return toNumber(overrides[String(threshold)], defaultDeposit);
      }
    }

    return defaultDeposit;
  };

  const calculateEstimatedTotal = (guestCount, bookingConfig = {}) => {
    const guests = Number.parseInt(String(guestCount || ''), 10);
    if (!Number.isInteger(guests) || guests < 1) return 0;

    const baseGuestCount = toNumber(bookingConfig.baseGuestCount);
    const minimumSpend = toNumber(bookingConfig.minimumSpend);
    const pricePerAdditionalGuest = toNumber(bookingConfig.pricePerAdditionalGuest);

    if (guests <= baseGuestCount) return minimumSpend;

    return minimumSpend + ((guests - baseGuestCount) * pricePerAdditionalGuest);
  };

  const calculatePaymentSchedule = ({ eventDate, guestCount, bookingConfig = {}, today = new Date() }) => {
    const normalizedDate = normalizeDateInput(eventDate);
    const estimatedTotal = calculateEstimatedTotal(guestCount, bookingConfig);
    const balanceDueDaysBeforeEvent = toNumber(bookingConfig.balanceDueDaysBeforeEvent, 90);
    const fullPaymentThresholdDays = toNumber(
      bookingConfig.fullPaymentThresholdDays,
      balanceDueDaysBeforeEvent
    );
    const standardDeposit = getDepositAmount(normalizedDate, bookingConfig);
    const depositEnabled = bookingConfig.depositEnabled !== false;

    if (!normalizedDate) {
      return {
        normalizedDate: '',
        estimatedTotal,
        depositAmount: standardDeposit,
        chargeNowAmount: 0,
        balanceDueIso: '',
        balanceDueDisplay: '—',
        requiresFullPayment: false,
        daysUntilEvent: null,
        buttonLabel: depositEnabled ? 'Pay Deposit' : 'Pay in Full'
      };
    }

    const eventDateValue = toDate(normalizedDate);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysUntilEvent = Math.floor((eventDateValue - todayMidnight) / MS_PER_DAY);
    const requiresFullPayment = daysUntilEvent >= 0 && daysUntilEvent <= fullPaymentThresholdDays;

    if (requiresFullPayment || !depositEnabled) {
      return {
        normalizedDate,
        estimatedTotal,
        depositAmount: standardDeposit,
        chargeNowAmount: estimatedTotal,
        balanceDueIso: '',
        balanceDueDisplay: 'Due now',
        requiresFullPayment: true,
        daysUntilEvent,
        buttonLabel: 'Pay in Full'
      };
    }

    const balanceDueIso = addDays(normalizedDate, -balanceDueDaysBeforeEvent);

    return {
      normalizedDate,
      estimatedTotal,
      depositAmount: standardDeposit,
      chargeNowAmount: standardDeposit,
      balanceDueIso,
      balanceDueDisplay: balanceDueIso ? formatDisplayDate(balanceDueIso) : '—',
      requiresFullPayment: false,
      daysUntilEvent,
      buttonLabel: 'Pay Deposit'
    };
  };

  const formatCurrency = (amount, options = {}) => {
    const locale = options.locale || DEFAULT_LOCALE;
    const currency = options.currency || DEFAULT_CURRENCY;

    if (!Number.isFinite(amount)) return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(0);

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatCurrencyFromMinorUnits = (amount, options = {}) => (
    formatCurrency(toNumber(amount) / 100, options)
  );

  const buildGuestPricingText = (bookingConfig = {}, options = {}) => {
    const locale = options.locale || DEFAULT_LOCALE;
    const currency = options.currency || DEFAULT_CURRENCY;
    const baseGuestCount = toNumber(bookingConfig.baseGuestCount);
    const minimumSpend = formatCurrency(toNumber(bookingConfig.minimumSpend), { locale, currency });
    const pricePerAdditionalGuest = formatCurrency(
      toNumber(bookingConfig.pricePerAdditionalGuest),
      { locale, currency }
    );

    return `Up to ${baseGuestCount} guests: ${minimumSpend}. Thereafter ${pricePerAdditionalGuest} per guest.`;
  };

  const buildBookingPolicyText = (bookingConfig = {}) => {
    const balanceDueDaysBeforeEvent = toNumber(bookingConfig.balanceDueDaysBeforeEvent, 90);
    const fullPaymentThresholdDays = toNumber(
      bookingConfig.fullPaymentThresholdDays,
      balanceDueDaysBeforeEvent
    );

    if (bookingConfig.depositEnabled === false) {
      return `Full payment is required at the time of booking.`;
    }

    return `Deposits are non-refundable. Balance due ${balanceDueDaysBeforeEvent} days before the event. Bookings within ${fullPaymentThresholdDays} days require full payment at the time of booking.`;
  };

  return {
    addDays,
    buildTimeSlots,
    buildBookingPolicyText,
    buildGuestPricingText,
    calculateEstimatedTotal,
    calculatePaymentSchedule,
    compareTimes,
    formatCurrency,
    formatCurrencyFromMinorUnits,
    formatDate,
    formatDisplayDate,
    formatTimeLabel,
    getDepositAmount,
    isBusinessDay,
    normalizeDateInput,
    normalizeTimeInput,
    toIsoDateString
  };
}));
