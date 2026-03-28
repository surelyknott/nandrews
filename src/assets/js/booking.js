const templateConfig = globalThis.BookingTemplateConfig;
const bookingRules = globalThis.BookingTemplateRules;

if (!templateConfig || !bookingRules) {
  throw new Error('Shared booking config failed to load.');
}

const state = {
  bookedDates: new Set(),
  selectedDate: ''
};

const formatCurrencyOrPlaceholder = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '£—';
  return bookingRules.formatCurrency(value, templateConfig.site);
};

const getGuestCount = () => {
  const guestInput = document.getElementById('guestCount');
  if (!guestInput) return 0;

  const value = Number.parseInt(guestInput.value, 10);
  return Number.isInteger(value) && value > 0 ? value : 0;
};

const getBookedDates = () => state.bookedDates;

const applyBookingCopy = () => {
  const bookingIntro = document.getElementById('bookingIntro');
  const calendarHelper = document.getElementById('calendarHelper');
  const guestPricingSummary = document.getElementById('guestPricingSummary');
  const bookingPolicySummary = document.getElementById('bookingPolicySummary');

  if (bookingIntro) bookingIntro.textContent = templateConfig.copy.bookingIntro;
  if (calendarHelper) calendarHelper.textContent = templateConfig.copy.calendarHelper;
  if (guestPricingSummary) {
    guestPricingSummary.textContent = bookingRules.buildGuestPricingText(
      templateConfig.booking,
      templateConfig.site
    );
  }
  if (bookingPolicySummary) {
    bookingPolicySummary.textContent = bookingRules.buildBookingPolicyText(templateConfig.booking);
  }
};

const updatePricing = () => {
  const depositEl = document.getElementById('depositAmount');
  const paymentAmountLabel = document.getElementById('paymentAmountLabel');
  const totalEl = document.getElementById('estimatedTotal');
  const balanceEl = document.getElementById('balanceDueDate');
  const submitBtn = document.getElementById('bookingSubmit');
  const guestInput = document.getElementById('guestCount');

  const guestCount = getGuestCount();
  const paymentSchedule = bookingRules.calculatePaymentSchedule({
    eventDate: state.selectedDate,
    guestCount,
    bookingConfig: templateConfig.booking
  });

  if (depositEl) {
    depositEl.textContent = formatCurrencyOrPlaceholder(
      state.selectedDate ? paymentSchedule.chargeNowAmount : NaN
    );
  }

  if (paymentAmountLabel) {
    paymentAmountLabel.textContent = paymentSchedule.requiresFullPayment
      ? 'Payment due now'
      : 'Deposit due';
  }

  if (totalEl) {
    totalEl.textContent = formatCurrencyOrPlaceholder(paymentSchedule.estimatedTotal);
  }

  if (balanceEl) {
    balanceEl.textContent = state.selectedDate ? paymentSchedule.balanceDueDisplay : '—';
  }

  if (submitBtn) {
    submitBtn.textContent = paymentSchedule.buttonLabel;
    submitBtn.disabled = !state.selectedDate;
  }

  if (guestInput) {
    const needsGuests = Boolean(state.selectedDate) && !guestCount;
    guestInput.classList.toggle('guest-highlight', needsGuests);
  }
};

const setSelectedDate = (dateStr) => {
  state.selectedDate = dateStr;

  const dateInput = document.getElementById('selectedDate');
  if (dateInput) {
    dateInput.value = dateStr
      ? bookingRules.formatDate(dateStr, {
        locale: templateConfig.site.locale,
        formatOptions: { year: 'numeric', month: 'short', day: '2-digit' }
      })
      : '';
  }

  if (!dateStr) {
    document.querySelectorAll('.fc-daygrid-day.is-selected').forEach((element) => {
      element.classList.remove('is-selected');
    });
  }

  updatePricing();
};

const showBookingError = (message) => {
  const alertEl = document.getElementById('bookingError');
  if (!alertEl) return;

  if (!message) {
    alertEl.classList.add('d-none');
    alertEl.textContent = '';
    return;
  }

  alertEl.textContent = message;
  alertEl.classList.remove('d-none');
};

let calendarInstance = null;

const initCalendar = () => {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl || !window.FullCalendar) return null;

  const today = new Date();
  const todayIso = bookingRules.toIsoDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    fixedWeekCount: false,
    selectable: false,
    firstDay: 1,
    validRange: { start: todayIso },
    headerToolbar: {
      left: 'prev,next',
      center: 'title',
      right: ''
    },
    events: (_info, successCallback) => {
      const events = Array.from(getBookedDates()).map((dateStr) => ({
        start: dateStr,
        end: bookingRules.addDays(dateStr, 1),
        display: 'background'
      }));
      successCallback(events);
    },
    dayCellClassNames: (arg) => (
      getBookedDates().has(arg.dateStr) ? ['is-booked'] : []
    ),
    dateClick: (info) => {
      if (getBookedDates().has(info.dateStr)) {
        showBookingError('That date is already booked. Please choose another day.');
        return;
      }

      showBookingError('');
      document.querySelectorAll('.fc-daygrid-day.is-selected').forEach((element) => {
        element.classList.remove('is-selected');
      });
      info.dayEl.classList.add('is-selected');
      setSelectedDate(info.dateStr);
    }
  });

  calendar.render();
  return calendar;
};

const buildBookedDatesSet = (rows) => {
  const bookedDates = new Set();

  rows.forEach((row) => {
    const status = String(row.status || 'booked').trim().toLowerCase();
    const date = bookingRules.normalizeDateInput(row.date);

    if (!date || status !== 'booked') return;
    bookedDates.add(date);
  });

  return bookedDates;
};

const loadBookings = async () => {
  const statusEl = document.getElementById('calendarStatus');

  try {
    if (statusEl) statusEl.textContent = 'Loading availability…';

    const response = await fetch(templateConfig.booking.availabilityEndpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to load availability right now.');
    }

    state.bookedDates = buildBookedDatesSet(data.rows || []);
    if (statusEl) statusEl.textContent = '';
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message || 'Unable to load availability right now.';
  }
};

const initBookingForm = () => {
  const guestInput = document.getElementById('guestCount');
  const form = document.getElementById('bookingForm');

  if (guestInput) {
    guestInput.addEventListener('input', updatePricing);
  }

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showBookingError('');

    if (!state.selectedDate) {
      showBookingError('Please select a date from the calendar.');
      return;
    }

    if (!getGuestCount()) {
      showBookingError('Please add a guest count before continuing.');
      return;
    }

    const payload = {
      date: state.selectedDate,
      guests: form.guests.value,
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value
    };

    try {
      const response = await fetch(templateConfig.booking.checkoutEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Unable to start checkout.');
      }

      window.location.href = data.url;
    } catch (error) {
      showBookingError(error.message || 'Unable to start checkout.');
    }
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  applyBookingCopy();

  const paymentStatus = document.getElementById('paymentStatus');
  if (paymentStatus) {
    const showStatus = (message, className) => {
      paymentStatus.textContent = message;
      paymentStatus.classList.remove(
        'd-none',
        'alert-danger',
        'alert-success',
        'alert-warning',
        'status-hide'
      );
      paymentStatus.classList.add(className, 'status-visible');

      window.setTimeout(() => {
        paymentStatus.classList.remove('status-visible');
        paymentStatus.classList.add('status-hide');
        window.setTimeout(() => {
          paymentStatus.classList.add('d-none');
        }, 450);
      }, 5000);
    };

    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment');
    if (status === 'success') {
      showStatus(
        'Payment received. Your booking has been recorded and a confirmation email is on its way.',
        'alert-success'
      );
    } else if (status === 'cancel') {
      showStatus(
        'Payment was cancelled. You can select a new date and try again.',
        'alert-warning'
      );
    }
  }

  calendarInstance = initCalendar();
  await loadBookings();
  initBookingForm();
  updatePricing();

  if (calendarInstance) {
    calendarInstance.refetchEvents();
  }
});
