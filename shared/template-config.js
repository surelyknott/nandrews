(function initTemplateConfig(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.BookingTemplateConfig = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, () => ({
  site: {
    businessName: 'Nandrews Garage Ltd',
    bookingLabel: 'appointment request',
    locale: 'en-GB',
    currency: 'GBP',
    contactPhone: '023 8077 1777',
    contactPhoneHref: '+442380771777',
    contactEmail: '',
    tagline: 'Friendly servicing, diagnostics, repairs and MOT for all vehicle models.',
    serviceArea: 'Based in Shirley, Southampton and serving local drivers across the area.',
    analyticsId: '',
    siteUrl: '',
    logoPath: '/assets/images/nandrews-logo.png',
    faviconPath: '/assets/images/nandrews-logo.png',
    addressLines: [
      '275 Shirley Rd',
      'Southampton', 
      'SO15 3HT',
      'United Kingdom'
    ],
    openingHours: [
      { day: 'Monday', hours: '8:30am-4:30pm' },
      { day: 'Tuesday', hours: '8:30am-4:30pm' },
      { day: 'Wednesday', hours: '8:30am-4:30pm' },
      { day: 'Thursday', hours: '8:30am-4:30pm' },
      { day: 'Friday', hours: '8:30am-4:30pm' },
      { day: 'Saturday', hours: 'Closed' },
      { day: 'Sunday', hours: 'Closed' }
    ],
    socials: []
  },
  booking: {
    availabilityEndpoint: '/.netlify/functions/availability',
    submitEndpoint: '/.netlify/functions/submit-appointment',
    serviceOptions: [
      'MOT testing',
      'Servicing & repairs',
      'Diagnostics',
    ],
    businessDays: [1, 2, 3, 4, 5],
    firstSlot: '08:30',
    lastSlot: '16:00',
    slotIntervalMinutes: 30,
    blockedStatuses: ['booked', 'confirmed', 'blocked', 'pending']
  },
  copy: {
    bookingIntro: 'Book a weekday appointment online by selecting the service, date, and time that works for you.',
    calendarHelper: 'Saturday and Sunday slots are not available online.',
    guestPricingSummary: 'Choose a service first, then pick an available date and time.',
    bookingPolicySummary: 'Online bookings are available Monday to Friday during garage opening hours. If you leave an email address, a confirmation email will be sent after booking.'
  }
})));
