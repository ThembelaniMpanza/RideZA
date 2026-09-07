# Rider observability and analytics

RD-21 uses Sentry for crash/error and performance telemetry, and PostHog for consent-based product analytics. Each event carries `environment` (`development`, `staging`, or `production`) and `release` (`rideza@<version>`) so dashboards and alerts cannot mix environments.

## Privacy boundary

Crash reporting is operationally necessary and does not identify the Firebase user. Product analytics is disabled until the rider opts in under **Account > Privacy & analytics**. Revoking consent flushes the consent event and opts the device out.

Never add these values to telemetry properties, exception messages, breadcrumbs, or logs:

- Firebase ID/refresh tokens, authorization headers, cookies, credentials, or secrets
- Email addresses, phone numbers, Firebase UIDs, platform user IDs, or trip IDs
- Pickup/destination labels, coordinates, route history, or precise location timestamps
- Chat/message bodies, review notes, documents, or support attachments
- Card, bank, payment-provider, or full fare/payment payloads

`src/telemetry/privacy.ts` enforces an analytics property allow-list and recursively filters provider payloads. API paths are reduced to route templates, query strings are removed, and exception messages are filtered while stack frames are retained. PostHog GeoIP enrichment, session replay, automatic lifecycle capture, and person profiles are disabled.

Retention and access policy:

- Sentry events: retain for 30 days; production project access is limited to on-call engineering and security.
- PostHog events: retain for 13 months; access is limited to product analytics and approved engineering leads.
- Export/delete requests must use the anonymous device identifier; no identity joins or data-warehouse exports are permitted.
- Review access quarterly and record changes in the engineering access register.

## Environment setup

Create separate Sentry projects and PostHog projects for staging and production. Configure these as EAS environment variables/secrets; never commit real values:

| Name | Visibility | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SENTRY_DSN` | Public | Runtime crash ingestion DSN |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | Public | Runtime project key |
| `EXPO_PUBLIC_POSTHOG_HOST` | Public | Regional HTTPS ingestion host |
| `EXPO_PUBLIC_TELEMETRY_SAMPLE_RATE` | Public | `1.0` staging, `0.1` production |
| `SENTRY_ORG` | Plain/sensitive | Source-map organization slug |
| `SENTRY_PROJECT` | Plain/sensitive | Source-map project slug |
| `SENTRY_AUTH_TOKEN` | Secret | Build-only source-map upload token |

Production EAS builds fail if either provider or Sentry source-map credentials are missing. They also fail when `EXPO_PUBLIC_ENABLE_CRASH_SCREEN`, `EXPO_PUBLIC_SHOW_TEST_ACCOUNT`, or `EXPO_PUBLIC_RESET_ONBOARDING` is truthy. `SENTRY_AUTH_TOKEN` is never embedded in Expo public config.

After adding the values, validate each profile:

```powershell
eas env:list --environment preview
eas env:list --environment production
eas build --profile preview --platform android
eas build --profile production --platform android
```

## Event contract

The consent-based funnel is:

1. `onboarding_completed`
2. `destination_selected`
3. `fare_quote_viewed`
4. `ride_requested` or `ride_search_started` (temporary prototype UI)
5. `ride_matched`
6. `ride_cancelled` or `trip_completed`
7. `payment_started` and `payment_completed`
8. `trip_review_submitted`

Use `app_session_started` for weekly retention. `screen_viewed` paths contain templates, not IDs. Do not add arbitrary event names or properties; extend the typed contract and privacy tests in the same pull request.

## Performance budgets

| Metric | Budget | Signal |
| --- | ---: | --- |
| App interactive startup | 3,000 ms | `app_start` |
| Initial balanced location fix | 5,000 ms | `location_initial_fix` |
| Map gesture response | 250 ms | `map_interaction` |
| API request | 2,500 ms | `api_request` |
| Route calculation | 3,000 ms | `route_calculation` |
| Fare quote | 2,500 ms | `fare_quote` |
| Ride request | 4,000 ms | `ride_request` |
| SignalR connection | 5,000 ms | `realtime_connect` |

Foreground location uses balanced accuracy, at least 15 metres of movement, and a five-second minimum interval. Add a separate approved budget before enabling background or high-accuracy tracking.

## Dashboards and alerts

Build one dashboard per provider/project and filter every widget by `environment`.

Sentry production dashboard:

- Crash-free sessions and users by release
- New/regressed issues by release
- P50/P95 duration and budget-exceeded rate for every metric above
- API failures grouped by route template and HTTP status
- SignalR failures/reconnects by release

PostHog production dashboard:

- Onboarding-to-completed-trip funnel and median conversion time
- Cancellation rate by status and whether a reason was provided
- Payment completion rate by payment-method category
- D1/D7/D30 retention from `app_session_started`
- Analytics opt-in/opt-out trend

Configure alerts only in production; staging alerts go to the engineering test channel:

- Crash-free sessions below 99.5% over 15 minutes
- A new/regressed issue affects at least 5 sessions in 15 minutes
- P95 exceeds a metric budget for three consecutive 10-minute windows
- API or payment failure rate exceeds 2% for 10 minutes
- No production sessions received for 30 minutes during the normal traffic window

Route production alerts to the on-call channel and paging service; include environment, release, issue/metric, and a dashboard link. Never include event payloads in notification text.

## Release verification

1. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run validate:expo`.
2. Install a staging build, opt analytics in, and exercise onboarding through review.
3. Trigger a harmless staging error and confirm its release/environment and uploaded source map.
4. Confirm no email, token, coordinate, address, message, or payment value appears in either provider.
5. Verify each performance signal and the complete funnel in staging.
6. Confirm production build-time guards reject diagnostic/test flags.
7. Promote only after the staging evidence is attached to RD-21.
