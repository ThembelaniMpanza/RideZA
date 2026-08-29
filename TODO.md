# RideZA Prioritized TODO

This backlog is based on the current Expo app, its implemented user flows, and static validation run on 27 August 2026.

## P0 — Security and launch blockers

- [ ] Rotate every credential currently stored in the tracked `.env` file, remove the file from Git history, and keep only `.env.example` in source control.
- [x] Replace the AsyncStorage token gate with Firebase auth-state handling (`onAuthStateChanged`), secure token persistence, token refresh, and a server-side token verification function.
- [x] Log in to Firebase CLI, deploy `verifySession`, set `EXPO_PUBLIC_AUTH_VERIFY_URL` in local/EAS environments, and rebuild the app.
- [x] Add route guards so unauthenticated users cannot open `(main)` routes and authenticated users cannot return to auth screens.
- [x] Implement real password reset with Firebase `sendPasswordResetEmail`; the current screen only displays a success alert.
- [x] Configure Google Maps keys correctly for Android and iOS builds, restrict each key by app identifier/API, and document the setup.
- [x] Attach an active billing account to the Google Cloud project and verify the restricted Android Maps key in an EAS preview build on the connected emulator.
- [ ] Install Android preview build `3d0b3e45-685d-4849-acc5-f6ad595bd701` on a physical Android device and confirm Maps loads.
- [ ] Complete EAS Apple signing, register an iOS test device, build the iOS preview, and confirm Maps loads on that physical device.
- [ ] Replace the public OSRM demo endpoint with a production routing provider or a controlled backend proxy with quotas, retries, timeouts, and monitoring.
- [ ] Replace the Deno GitHub Actions workflow with Node/Expo CI that installs locked dependencies and runs lint, TypeScript checks, tests, and an Expo export/build check.
- [ ] Add production crash reporting, structured logs, and environment-specific configuration; ensure development crash/test flags never reach production.

## P1 — Core ride product

- [ ] Design and implement the backend data model for riders, drivers, vehicles, rides, locations, fares, payments, ratings, and support cases.
- [ ] Replace the timer-based ride simulation with a server-owned ride state machine: requested, matching, accepted, arriving, waiting, in-progress, completed, cancelled, and failed.
- [ ] Build the driver-side workflow or driver service needed to accept requests, publish live location, start/end trips, and confirm cash collection.
- [ ] Add real-time rider/driver updates using a suitable Firebase service or backend WebSockets, including reconnect and stale-state recovery.
- [ ] Move fare calculation to the backend and define South African pricing rules, minimum fares, surge, tolls, cancellation fees, and quote expiry.
- [ ] Integrate a South Africa-compatible payment provider; support card tokenization, payment authorization/capture, receipts, refunds, failed payments, and webhooks.
- [ ] Persist completed/cancelled trips and replace `DEMO_RIDES` with real paginated ride history and ride-detail screens.
- [ ] Persist ratings, review tags, notes, and tips; prevent duplicate submissions and associate them with the correct ride and driver.
- [ ] Replace local-only driver chat with real-time messaging, delivery state, moderation/reporting, and message retention rules.
- [ ] Connect driver calls through protected phone relay/deep linking and define an emergency escalation flow.
- [ ] Add cancellation and no-show flows for riders and drivers, including reason capture and fee disclosure.
- [ ] Handle location denial, unavailable GPS, backgrounding, poor connectivity, route-provider failure, and app restart during an active trip.

## P1 — Compliance and trust

- [ ] Define the RideZA+ product and legal model before implementing applications, affordability checks, debit orders, penalties, and account suspension.
- [ ] Add POPIA-compliant privacy consent, data-retention/deletion rules, account deletion, terms acceptance, and privacy/terms screens.
- [ ] Add rider and driver identity verification, driver licence/vehicle document checks, expiry handling, and fraud controls.
- [ ] Add safety features: trip sharing, SOS, trusted contacts, incident reporting, driver/rider blocking, and an auditable support workflow.
- [ ] Complete a payment and personal-data threat model, Firebase security rules, backend authorization tests, and dependency/security review.

## P2 — App completeness and quality

- [ ] Implement the Account placeholders: Personal Information, Saved Places, Payment Methods, Notifications, and Privacy & Security.
- [ ] Replace the hard-coded profile identity with backend profile data and support profile editing.
- [ ] Turn Help & Support into real FAQs, contact channels, ticket creation, ride-linked issues, and support status tracking.
- [ ] Refactor the roughly 100 KB `ride.tsx` screen into typed domain hooks, services, state-machine logic, and focused presentation components.
- [ ] Remove or migrate the unused legacy navigation/screens under `src/screens` and `src/navigation`, including the empty signup screen and fake login implementation.
- [ ] Standardize TypeScript usage and eliminate `any` from Firebase, maps, routing responses, theme styles, and navigation parameters.
- [ ] Add unit tests for fare/state logic, integration tests for auth and ride persistence, and end-to-end tests for the critical rider journey.
- [ ] Add loading, empty, offline, error, and retry states across auth, maps, ride history, payments, chat, and support.
- [ ] Review accessibility: dynamic type, screen-reader order, input labels, contrast, touch targets, reduced motion, and keyboard navigation on web.
- [ ] Test responsive layouts on small/large Android devices, iPhones, tablets, and web; decide whether tablet/web are supported release targets.
- [ ] Fix visible encoding/mojibake in project text and verify UTF-8 across source files, README, build logs, and UI strings.

## P2 — Release readiness

- [ ] Replace the generated Expo README with RideZA architecture, setup, environment, Firebase, maps, test, build, and deployment documentation.
- [ ] Add separate development, preview, and production Firebase/maps/payment projects with documented EAS secrets and access ownership.
- [ ] Add app-store metadata, screenshots, privacy disclosures, permission explanations, support URL, privacy URL, and release notes.
- [ ] Define versioning, database migration, feature-flag, rollback, and incident-response processes.
- [ ] Add product analytics for onboarding, search, quote, request, match, cancellation, completion, payment, and retention funnels without collecting unnecessary personal data.
- [ ] Establish performance budgets and measure startup time, map responsiveness, battery/location usage, network usage, and crash-free sessions.

## P3 — Product improvements

- [ ] Add saved Home/Work locations, recent searches, favourites, scheduled rides, and multi-stop rides after the core lifecycle is reliable.
- [ ] Add promos, referrals, receipts, business profiles, accessibility ride preferences, and localized notifications.
- [ ] Add multilingual support and validate South African address/search quality across provinces and informal addressing patterns.
- [ ] Reassess RideZA+ eligibility scoring and premium benefits using real product, legal, risk, and repayment data.

## Current validation baseline

- `npm run lint` passes.
- `npx tsc --noEmit` passes.
- No automated test suite is configured.
- The current GitHub Actions workflow targets Deno and does not validate the Expo application.
- Firebase email/password sign-in and sign-up are implemented; password reset is not.
- Routing/geocoding and the ride UI work as a prototype, while dispatch, driver tracking, trip state, payment, history, chat, and reviews remain simulated or local-only.
