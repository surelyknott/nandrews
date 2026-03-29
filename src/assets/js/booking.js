const templateConfig = globalThis.BookingTemplateConfig;
const bookingRules = globalThis.BookingTemplateRules;

if (!templateConfig || !bookingRules) {
  throw new Error('Shared booking config failed to load.');
}

const state = {
  rows: [],
  timeSlots: [],
  selectedService: '',
  selectedDate: '',
  selectedTime: '',
  availabilityLoaded: false
};

const BOOKING_LOOKAHEAD_DAYS = 90;

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const getTakenStatuses = () => (
  Array.isArray(templateConfig.booking.blockedStatuses)
    ? templateConfig.booking.blockedStatuses.map((status) => normalizeStatus(status))
    : ['booked', 'confirmed', 'blocked', 'pending']
);

const setAlert = (elementId, message) => {
  const alertEl = document.getElementById(elementId);
  if (!alertEl) return;

  if (!message) {
    alertEl.textContent = '';
    alertEl.classList.add('d-none');
    return;
  }

  alertEl.textContent = message;
  alertEl.classList.remove('d-none');
};

const clearAlerts = () => {
  setAlert('bookingError', '');
  setAlert('appointmentSuccess', '');
};

const getDateInput = () => document.getElementById('bookingDate');

const openDatePicker = () => {
  const dateInput = getDateInput();
  if (!dateInput) return;

  dateInput.focus({ preventScroll: true });

  if (typeof dateInput.showPicker === 'function') {
    dateInput.showPicker();
    return;
  }

  dateInput.click();
};

const getTodayIso = () => {
  const today = new Date();
  return bookingRules.toIsoDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );
};

const setDateInputBounds = () => {
  const dateInput = getDateInput();
  if (!dateInput) return;
  dateInput.min = getTodayIso();
};

const scrollToElement = (element) => {
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const focusBookingDetails = () => {
  const detailsCard = document.getElementById('bookingDetailsCard');
  const fullName = document.getElementById('fullName');

  scrollToElement(detailsCard);
  window.setTimeout(() => {
    fullName?.focus({ preventScroll: true });
  }, 180);
};

const updateDateInputState = () => {
  const panel = document.getElementById('bookingDatePanel');
  const dateInput = getDateInput();
  const helper = document.getElementById('calendarHelper');
  const isEnabled = Boolean(state.selectedService);

  if (panel) {
    panel.classList.toggle('is-disabled', !isEnabled);
    panel.setAttribute('aria-disabled', String(!isEnabled));
  }

  if (dateInput) {
    dateInput.disabled = !isEnabled;
  }

  if (helper) {
    helper.textContent = isEnabled
      ? templateConfig.copy.calendarHelper
      : 'Choose a service first to unlock weekday availability.';
  }
};

const setStepState = (elementId, { isCurrent = false, isComplete = false } = {}) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.classList.toggle('is-current', isCurrent);
  element.classList.toggle('is-complete', isComplete);

  if (isCurrent) {
    element.setAttribute('aria-current', 'step');
    return;
  }

  element.removeAttribute('aria-current');
};

const updateProgressState = () => {
  const hasServiceAndDate = Boolean(state.selectedService && state.selectedDate);
  const hasTime = Boolean(state.selectedTime);

  setStepState('bookingStepService', {
    isCurrent: !state.selectedService || !state.selectedDate,
    isComplete: hasServiceAndDate
  });

  setStepState('bookingStepTime', {
    isCurrent: Boolean(state.selectedService) && !hasTime,
    isComplete: hasTime
  });

  setStepState('bookingStepDetails', {
    isCurrent: hasTime,
    isComplete: false
  });
};

const updateDetailsState = () => {
  const detailsCard = document.getElementById('bookingDetailsCard');
  const intro = document.getElementById('bookingDetailsIntro');
  const badge = document.getElementById('bookingDetailsBadge');
  const lockMessage = document.getElementById('bookingFormLock');
  const visibleFields = document.querySelectorAll(
    '#bookingForm input:not([type="hidden"]), #bookingForm textarea'
  );
  const isUnlocked = Boolean(state.selectedTime);

  if (detailsCard) {
    detailsCard.classList.toggle('is-locked', !isUnlocked);
    detailsCard.setAttribute('aria-disabled', String(!isUnlocked));
  }

  visibleFields.forEach((field) => {
    field.disabled = !isUnlocked;
  });

  if (intro) {
    intro.textContent = isUnlocked
      ? 'Share your contact details and any useful notes to finish the booking request.'
      : 'Select a time slot above to unlock the contact form.';
  }

  if (badge) {
    badge.textContent = isUnlocked ? 'Ready to book' : 'Waiting for a time';
    badge.classList.toggle('appointment-panel-badge-muted', !isUnlocked);
  }

  if (lockMessage) {
    lockMessage.hidden = isUnlocked;
  }
};

const findNextAvailableDate = () => {
  const startDate = state.selectedDate || getTodayIso();

  for (let dayOffset = 0; dayOffset <= BOOKING_LOOKAHEAD_DAYS; dayOffset += 1) {
    const candidate = bookingRules.addDays(startDate, dayOffset);
    if (!candidate) continue;
    if (getAvailableSlotsForDate(candidate).length) return candidate;
  }

  return '';
};

const updateNextAvailableButton = () => {
  const button = document.getElementById('nextAvailableBtn');
  if (!button) return;

  if (!state.selectedService) {
    button.disabled = true;
    button.textContent = 'Choose service first';
    return;
  }

  if (!state.availabilityLoaded) {
    button.disabled = true;
    button.textContent = 'Loading slots…';
    return;
  }

  const nextAvailableDate = findNextAvailableDate();
  button.disabled = !nextAvailableDate;
  button.textContent = nextAvailableDate ? 'Next available' : 'No slots found';
};

const initDatePickerTrigger = () => {
  const panel = document.getElementById('bookingDatePanel');
  const dateInput = getDateInput();
  if (!panel || !dateInput) return;

  panel.addEventListener('click', () => {
    if (dateInput.disabled) return;
    openDatePicker();
  });
};

const getSelectedRowsForDate = (date) => (
  state.rows.filter((row) => (
    bookingRules.normalizeDateInput(row.date) === bookingRules.normalizeDateInput(date)
  ))
);

const getUnavailableSlotsForDate = (date) => {
  const statuses = getTakenStatuses();
  return getSelectedRowsForDate(date).reduce((slots, row) => {
    if (!statuses.includes(normalizeStatus(row.status || 'confirmed'))) return slots;
    const normalizedTime = bookingRules.normalizeTimeInput(row.time);
    if (normalizedTime) slots.add(normalizedTime);
    return slots;
  }, new Set());
};

const isPastSlotToday = (date, time) => {
  const normalizedDate = bookingRules.normalizeDateInput(date);
  const normalizedTime = bookingRules.normalizeTimeInput(time);
  if (!normalizedDate || !normalizedTime) return false;

  const todayIso = getTodayIso();
  if (normalizedDate !== todayIso) return false;

  const now = new Date();
  const [hours, minutes] = normalizedTime.split(':').map((value) => Number.parseInt(value, 10));
  const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  return slotDate <= now;
};

const getAvailableSlotsForDate = (date) => {
  if (!bookingRules.isBusinessDay(date, templateConfig.booking.businessDays)) return [];

  const takenSlots = getUnavailableSlotsForDate(date);
  return state.timeSlots.filter((time) => (
    !takenSlots.has(time) && !isPastSlotToday(date, time)
  ));
};

const formatDateLong = (date) => bookingRules.formatDate(date, {
  locale: templateConfig.site.locale,
  formatOptions: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
});

const updateSummary = () => {
  const serviceSummary = document.getElementById('selectedServiceSummary');
  const dateSummary = document.getElementById('selectedDateSummary');
  const timeSummary = document.getElementById('selectedTimeSummary');
  const dateLabel = document.getElementById('selectedDateLabel');
  const slotCount = document.getElementById('availableSlotCount');
  const hiddenTime = document.getElementById('selectedTime');
  const submitBtn = document.getElementById('bookingSubmit');
  const slotIntro = document.getElementById('guestPricingSummary');

  const availableSlots = state.selectedDate ? getAvailableSlotsForDate(state.selectedDate) : [];

  if (serviceSummary) {
    serviceSummary.textContent = state.selectedService || 'Not selected';
  }

  if (dateSummary) {
    dateSummary.textContent = state.selectedDate ? formatDateLong(state.selectedDate) : 'Not selected';
  }

  if (timeSummary) {
    timeSummary.textContent = state.selectedTime
      ? bookingRules.formatTimeLabel(state.selectedTime, templateConfig.site.locale)
      : 'Not selected';
  }

  if (dateLabel) {
    dateLabel.textContent = state.selectedDate
      ? formatDateLong(state.selectedDate)
      : state.selectedService
        ? 'Choose a weekday'
        : 'Choose a service first';
  }

  if (slotCount) {
    if (!state.selectedService) {
      slotCount.textContent = 'Choose a service first';
    } else if (!state.selectedDate) {
      slotCount.textContent = 'Select a date';
    } else if (availableSlots.length === 1) {
      slotCount.textContent = '1 slot available';
    } else {
      slotCount.textContent = `${availableSlots.length} slots available`;
    }
  }

  if (hiddenTime) {
    hiddenTime.value = state.selectedTime;
  }

  if (submitBtn) {
    submitBtn.disabled = !(state.selectedService && state.selectedDate && state.selectedTime);
  }

  if (slotIntro) {
    slotIntro.textContent = !state.selectedService
      ? 'Choose a service first, then pick a weekday to load live appointment times.'
      : state.selectedDate
        ? 'Pick the time that works best, then add your contact details below.'
        : 'Choose a weekday to see the currently available appointment times.';
  }

  updateDateInputState();
  updateProgressState();
  updateDetailsState();
  updateNextAvailableButton();
};

const renderTimeSlots = () => {
  const slotGrid = document.getElementById('timeSlotGrid');
  const statusEl = document.getElementById('calendarStatus');
  if (!slotGrid) return;

  slotGrid.innerHTML = '';

  if (!state.selectedService) {
    slotGrid.innerHTML = '<p class="time-slot-empty">Choose a service first, then select a weekday to view available times.</p>';
    if (statusEl) statusEl.textContent = '';
    state.selectedTime = '';
    updateSummary();
    return;
  }

  if (!state.selectedDate) {
    slotGrid.innerHTML = '<p class="time-slot-empty">Select a date to see available times.</p>';
    if (statusEl) statusEl.textContent = '';
    state.selectedTime = '';
    updateSummary();
    return;
  }

  if (!bookingRules.isBusinessDay(state.selectedDate, templateConfig.booking.businessDays)) {
    slotGrid.innerHTML = '<p class="time-slot-empty">Online booking is only available Monday to Friday.</p>';
    if (statusEl) statusEl.textContent = 'Weekday slots only';
    updateSummary();
    return;
  }

  const availableSlots = getAvailableSlotsForDate(state.selectedDate);
  if (statusEl) {
    statusEl.textContent = availableSlots.length
      ? formatDateLong(state.selectedDate)
      : 'No slots available on this date';
  }

  if (!availableSlots.length) {
    slotGrid.innerHTML = '<p class="time-slot-empty">No online slots are available for this date. Please choose another day or call the garage.</p>';
    state.selectedTime = '';
    updateSummary();
    return;
  }

  availableSlots.forEach((time) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `time-slot-button${state.selectedTime === time ? ' is-selected' : ''}`;
    button.textContent = bookingRules.formatTimeLabel(time, templateConfig.site.locale);
    button.addEventListener('click', () => {
      const isNewSelection = state.selectedTime !== time;
      state.selectedTime = time;
      clearAlerts();
      renderTimeSlots();
      updateSummary();
      if (isNewSelection) focusBookingDetails();
    });
    slotGrid.appendChild(button);
  });

  updateSummary();
};

const applyBookingCopy = () => {
  const bookingIntro = document.getElementById('bookingIntro');
  const calendarHelper = document.getElementById('calendarHelper');
  const guestPricingSummary = document.getElementById('guestPricingSummary');
  const bookingPolicySummary = document.getElementById('bookingPolicySummary');

  if (bookingIntro) bookingIntro.textContent = templateConfig.copy.bookingIntro;
  if (calendarHelper) calendarHelper.textContent = templateConfig.copy.calendarHelper;
  if (guestPricingSummary) guestPricingSummary.textContent = templateConfig.copy.guestPricingSummary;
  if (bookingPolicySummary) bookingPolicySummary.textContent = templateConfig.copy.bookingPolicySummary;
};

const parseJsonResponse = async (response, fallbackMessage) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const responseText = await response.text();

  if (contentType.includes('application/json')) {
    return JSON.parse(responseText || '{}');
  }

  if (responseText.trim().startsWith('<')) {
    throw new Error(
      'Live availability is not reachable from this preview server. Use Netlify functions or a deployed build to load time slots.'
    );
  }

  try {
    return JSON.parse(responseText || '{}');
  } catch (error) {
    throw new Error(fallbackMessage);
  }
};

const loadAvailability = async () => {
  const statusEl = document.getElementById('calendarStatus');
  const slotGrid = document.getElementById('timeSlotGrid');

  try {
    state.availabilityLoaded = false;
    updateNextAvailableButton();
    if (statusEl) statusEl.textContent = 'Loading slots…';
    const response = await fetch(templateConfig.booking.availabilityEndpoint);
    const data = await parseJsonResponse(
      response,
      'Unable to load booking availability right now.'
    );

    if (!response.ok) {
      throw new Error(data.error || 'Unable to load booking availability right now.');
    }

    state.rows = Array.isArray(data.rows) ? data.rows : [];
    state.timeSlots = Array.isArray(data.timeSlots) && data.timeSlots.length
      ? data.timeSlots
      : bookingRules.buildTimeSlots(templateConfig.booking);
    state.availabilityLoaded = true;

    renderTimeSlots();
    if (statusEl) statusEl.textContent = '';
  } catch (error) {
    state.availabilityLoaded = false;
    if (statusEl) statusEl.textContent = 'Availability unavailable';
    if (slotGrid) {
      slotGrid.innerHTML = `<p class="time-slot-empty">${error.message || 'Unable to load booking availability right now.'}</p>`;
    }
    updateNextAvailableButton();
  }
};

const initBookingForm = () => {
  const form = document.getElementById('bookingForm');
  const serviceSelect = document.getElementById('bookingService');
  const dateInput = getDateInput();
  const nextAvailableBtn = document.getElementById('nextAvailableBtn');

  if (serviceSelect) {
    serviceSelect.addEventListener('change', (event) => {
      const previousService = state.selectedService;
      state.selectedService = String(event.target.value || '').trim();

      if (!state.selectedService) {
        state.selectedDate = '';
        state.selectedTime = '';
        if (dateInput) dateInput.value = '';
      }

      if (!previousService && state.selectedService) {
        window.setTimeout(() => {
          getDateInput()?.focus({ preventScroll: true });
        }, 120);
      }

      clearAlerts();
      renderTimeSlots();
      updateSummary();
    });
  }

  if (dateInput) {
    dateInput.addEventListener('change', (event) => {
      const nextDate = bookingRules.normalizeDateInput(event.target.value);
      state.selectedDate = nextDate;
      state.selectedTime = '';
      clearAlerts();

      if (!nextDate) {
        renderTimeSlots();
        return;
      }

      if (!bookingRules.isBusinessDay(nextDate, templateConfig.booking.businessDays)) {
        setAlert('bookingError', 'Please choose a Monday to Friday appointment.');
        event.target.value = '';
        state.selectedDate = '';
      }

      renderTimeSlots();
    });
  }

  if (nextAvailableBtn) {
    nextAvailableBtn.addEventListener('click', () => {
      if (!state.selectedService) {
        setAlert('bookingError', 'Choose a service before looking for the next available appointment.');
        return;
      }

      const nextAvailableDate = findNextAvailableDate();
      if (!nextAvailableDate) {
        setAlert('bookingError', 'No online weekday slots are currently available. Please call the garage directly.');
        return;
      }

      state.selectedDate = nextAvailableDate;
      state.selectedTime = '';
      clearAlerts();

      if (dateInput) {
        dateInput.value = nextAvailableDate;
      }

      renderTimeSlots();
      scrollToElement(document.getElementById('timeSlotGrid'));
    });
  }

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlerts();

    if (!state.selectedService || !state.selectedDate || !state.selectedTime) {
      setAlert('bookingError', 'Please choose a service, date, and time before booking.');
      return;
    }

    const payload = {
      service: state.selectedService,
      date: state.selectedDate,
      time: state.selectedTime,
      name: form.name.value,
      phone: form.phone.value,
      email: form.email.value,
      vehicle: form.vehicle.value,
      notes: form.notes.value
    };

    const submitBtn = document.getElementById('bookingSubmit');
    const originalLabel = submitBtn ? submitBtn.textContent : '';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Booking…';
      }

      const response = await fetch(templateConfig.booking.submitEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to confirm the booking.');
      }

      setAlert('appointmentSuccess', data.message || 'Appointment confirmed.');
      form.reset();
      if (serviceSelect) serviceSelect.value = '';
      if (dateInput) dateInput.value = '';
      state.selectedService = '';
      state.selectedDate = '';
      state.selectedTime = '';
      renderTimeSlots();
      updateSummary();
      await loadAvailability();
    } catch (error) {
      setAlert('bookingError', error.message || 'Unable to confirm the booking.');
      await loadAvailability();
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalLabel || 'Confirm booking';
      }
      updateSummary();
    }
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  applyBookingCopy();
  setDateInputBounds();
  initDatePickerTrigger();
  state.timeSlots = bookingRules.buildTimeSlots(templateConfig.booking);
  renderTimeSlots();
  initBookingForm();
  updateSummary();
  await loadAvailability();
});
