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
    tagline: 'Friendly servicing, diagnostics, repairs and MOT for all model vehicles.',
    serviceArea: 'Based in Shirley, Southampton and serving local drivers across the area.',
    analyticsId: '',
    siteUrl: '',
    logoPath: '/assets/images/nandrews-logo.png',
    faviconPath: '/assets/images/nandrews-logo.png',
    addressLines: [
      '275 Shirley Rd',
      'Southampton SO15 3HT'
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
    checkoutEndpoint: '/.netlify/functions/create-checkout',
    baseGuestCount: 135,
    minimumSpend: 4000,
    pricePerAdditionalGuest: 30,
    depositEnabled: true,
    depositAmount: 2000,
    depositOverridesByYear: {
      2027: 1500
    },
    balanceDueDaysBeforeEvent: 90,
    fullPaymentThresholdDays: 90
  },
  copy: {
    bookingIntro: 'Call, message, or send an appointment request and the team will come back to you.',
    calendarHelper: 'Online booking is not live yet.',
    guestPricingSummary: 'Clear advice and practical next steps.',
    bookingPolicySummary: 'For servicing, diagnostics, repairs and MOT enquiries, call the garage or send a message through the contact page.'
  }
})));
