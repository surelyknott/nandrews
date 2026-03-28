# Booking System Template

Reusable local-business site template with:

- a single live booking calendar
- Stripe Checkout for deposits or full payment
- Google Sheets as the booking source of truth
- Netlify Functions for availability and booking automation
- Eleventy layouts/partials for page structure
- SCSS partials for maintainable styling

The repo includes sample content, but
the build is oriented around a cleaner four-page template:

- home
- about
- services
- contact

## Current architecture

- Static site build: Eleventy
- Styling: SCSS compiled to `src/assets/css/main.css`
- Booking logic shared between browser and backend
- Availability source: Google Sheet via Netlify Function
- Payments: Stripe Checkout
- Booking storage: Google Sheet append on webhook

## Source structure

- `src/`
  Eleventy source files, layouts, partials, and front-end assets
- `shared/template-config.js`
  Business-facing site and booking configuration
- `shared/booking-rules.js`
  Shared date, pricing, and payment logic
- `netlify/functions/`
  Availability, checkout, and webhook handlers
- `tests/`
  Booking-rule tests

The intended publish target is the Eleventy output in `dist/`.

## Quick start

1. Install dependencies:
   - `npm install`
2. Copy environment variables from `.env.example`
3. Read `BOOKING_SETUP.md`
4. Build the site:
   - `npm run build`
5. Deploy to Netlify

## Useful scripts

- `npm run build`
- `npm run build:css`
- `npm run build:css:prod`
- `npm run build:site`
- `npm run dev`
- `npm run watch:css`
- `npm test`

## Local development

- `npm run dev`
  Runs Eleventy and SCSS watch together for local work.
- `npm run build:css`
  Writes readable CSS for development.
- `npm run build:css:prod`
  Writes compressed CSS if you want a minified output.

## Files to edit first

- `shared/template-config.js`
  Business name, contact details, booking rules, analytics ID, and shared copy
- `src/_data/navigation.js`
  Simplified page navigation
- `src/_data/services.js`
  Services page and homepage service cards
- `src/_includes/partials/`
  Shared nav/footer chrome
- `src/styles/`
  SCSS partials

## Current limitations

- A checkout race condition is still possible if two users try to pay for the same date at nearly the same time.
- The built-in artwork is intentionally generic placeholder media and should be replaced for the final client package.
