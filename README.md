# Nandrews Garage Ltd

Website project for Nandrews Garage Ltd in Southampton.

This repo contains the client site build, using:

- Eleventy for page generation
- SCSS for styling
- Netlify-ready project structure

## Project purpose

The site is designed to present Nandrews as a friendly, trustworthy local garage offering:

- servicing
- diagnostics
- repairs
- MOT

The homepage also includes an appointment booking flow for:

- selecting a service
- picking a weekday date
- choosing an available time slot
- sending booking details to Google Sheets
- sending an optional email confirmation when an email address is provided

It is currently structured as a four-page site:

- home
- about
- services
- contact

## Local development

Install dependencies:

```bash
npm install
```

Run the local dev server with SCSS watching:

```bash
npm run dev
```

This runs:

- Eleventy local server
- SCSS watch and rebuild

## Build commands

Build the site for local review:

```bash
npm run build
```

Other useful scripts:

- `npm run build:css`
  Builds readable CSS for development
- `npm run build:css:prod`
  Builds compressed CSS
- `npm run build:site`
  Runs Eleventy only

## Key files

- `src/index.njk`
  Homepage
- `src/about/index.njk`
  About page
- `src/services/index.njk`
  Services page
- `src/contact/index.njk`
  Contact page
- `shared/template-config.js`
  Site-wide business details and shared config
- `src/_data/services.js`
  Service card content
- `src/styles/`
  SCSS source files
- `src/assets/images/`
  Site image assets

## Output

- `dist/`
  Generated site output

`dist/` is ignored in git and should be regenerated locally or in deployment.

## Deployment notes

The project is structured for Netlify deployment and includes:

- `netlify.toml`
- `netlify/functions/`

If booking or contact-related backend behavior is extended later, review the Netlify function setup before deployment.

## Booking setup

The appointment form uses:

- `netlify/functions/availability.js`
  Reads booked slots from Google Sheets
- `netlify/functions/submit-appointment.js`
  Saves new appointments and optionally sends confirmation emails

Expected Google Sheet columns:

- `date`
- `time`
- `service`
- `name`
- `email`
- `phone`
- `vehicle`
- `notes`
- `status`
- `created_at`

If the sheet tab is empty, the first successful appointment submission will create this header row automatically before adding the booking.
