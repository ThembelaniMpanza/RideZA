# RideZA API Gap Assessment

Last reviewed: 2026-08-30

## Decision

The current endpoint surface is not sufficient for a production ride-hailing platform.

RideZA currently has one first-party HTTP endpoint, `POST /verifySession`, plus Firebase Authentication and a direct client call to the public OSRM demo router. The rider flow, driver assignment, trip state, payments, chat, calling, ratings, history, subscriptions, and support are local or simulated UI state.

A versioned backend API and real-time data layer should be added. The existing verification endpoint can remain temporarily, but every new private operation must verify Firebase authentication itself and enforce resource ownership and role authorization.

## Requested-domain verdict

| Domain | Current project state | Decision |
| --- | --- | --- |
| Rider onboarding and profiles | Onboarding completion is local; Firebase supplies only authentication identity | Add P0 profile and onboarding APIs |
| Saved places and emergency contacts | Not persisted by a RideZA backend | Add P0 owned-resource APIs and an SOS workflow |
| Fare estimates | Calculated from local constants and a direct OSRM route | Add a P0 server-authoritative quote API |
| Ride requests and cancellation | Simulated with component state and timers | Add P0 commands with idempotency and state validation |
| Trip tracking | Simulated route progress | Add a P0 durable ride snapshot plus authorized real-time subscriptions |
| Driver onboarding, documents, and vehicles | No driver backend or active driver app flow | Add P0 driver APIs, storage uploads, and staff approval |
| Driver availability and location | Implemented in source; deployment, driver UI, App Check, and dispatch integration remain | Complete the remaining production controls before enabling drivers |
| Ride offers and trip actions | Simulated driver assignment and progress | Add P0 atomic offer and state-transition commands |
| Payment methods and receipts | Hard-coded display data only | Add P0 provider-tokenized payment and receipt APIs |
| Wallets | Not implemented | Add only if the accounting and regulatory product is approved |
| Driver payouts | Not implemented | Add P0 provider onboarding, ledger, earnings, and payout reads |
| Refunds | Not implemented | Add P1 request APIs, payment webhooks, and finance operations |
| Notification devices/preferences | Not implemented | Add P0 device registration and P1 preferences |
| Ratings | Captured only in local component state | Add a P0 post-trip rating command and aggregate read |
| Support | Informational UI only | Add P0 ticketing plus a distinct live-safety escalation path |
| Trip history | Static client data | Add P0 paginated rider and driver history |

All requested domains therefore need new backend capabilities. They should not all be ordinary REST endpoints: live locations, active-trip updates, offers, and messages are better delivered through protected real-time channels, while payment/document outcomes must enter through signed provider webhooks.

## Recommended architecture

```text
Rider app ─┐
           ├─ HTTPS API `/v1` ── domain services ── Firestore
Driver app ┘          │                 │              │
                      │                 ├─ payment provider
                      │                 ├─ routing provider
                      │                 ├─ object storage
                      │                 └─ FCM notifications
                      │
                      └─ Realtime Database / Firestore listeners
                         for active trip state and live location
```

Use HTTP endpoints for commands, validation, money movement, durable writes, and paginated reads. Use Firebase real-time subscriptions for active ride state, offers, messages, and matched-driver location. Push notifications are delivery hints, not the source of truth.

The catalog below describes resource operations, not separately deployed Cloud Functions for every route. Start with a modular monolith:

- One authenticated HTTPS `api` function hosting the `/v1` router.
- Separate webhook handlers where raw-body verification or provider isolation requires it.
- Queue-backed workers for dispatch, offer expiry, notifications, reconciliation, document processing, and deletion workflows.
- Firestore for durable domain records and ledgers; Realtime Database or equivalent for short-lived high-frequency location.

The current function runs in `us-central1`. Before production, choose the closest supported region that also satisfies database, payment-provider, latency, and data-residency constraints; keep tightly coupled services colocated.

All paths below are relative to `/v1` unless marked otherwise.

Priority meanings:

- **P0**: required for a credible production launch.
- **P1**: required soon after the core ride flow or before scaling usage.
- **Conditional**: required only if the corresponding product feature is offered.
- **Operations**: required for staff or provider integrations rather than the mobile apps.

## Foundation and identity

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `GET /session` | P0 | Return authenticated user ID, roles, account state, and rider/driver onboarding status. This can eventually replace the empty-body `POST /verifySession` contract. |
| `GET /config` | P0 | Return client-safe service areas, ride classes, feature flags, support details, and minimum supported app version. |
| `POST /uploads` | P0 | Create a short-lived signed upload target for approved content types and size limits. Used for avatars, driver documents, vehicles, incidents, and support. |
| `POST /accounts/me/deletion-requests` | P1 | Start an auditable account deletion and retention workflow. |
| `GET /health` | Operations | Shallow service health for deployment monitoring; it must not reveal secrets or dependency details. |

`POST /verifySession` is valid as a session probe, but it is not authorization for later calls. Each endpoint must independently verify the Firebase ID token and relevant role.

## Rider onboarding and profile

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `PUT /riders/me/onboarding` | P0 | Idempotently submit required rider details, accepted policy versions, and onboarding completion. |
| `GET /riders/me` | P0 | Fetch the rider profile and account status. |
| `PATCH /riders/me` | P0 | Update allowed profile fields such as name, avatar, locale, and accessibility preferences. |
| `GET /riders/me/saved-places` | P0 | List home, work, and custom saved places. |
| `POST /riders/me/saved-places` | P0 | Create a validated saved place. |
| `PATCH /riders/me/saved-places/{placeId}` | P0 | Rename or update a saved place. |
| `DELETE /riders/me/saved-places/{placeId}` | P0 | Remove a saved place. |
| `GET /riders/me/emergency-contacts` | P0 | List emergency contacts without exposing them to other users. |
| `POST /riders/me/emergency-contacts` | P0 | Add and optionally verify a contact. |
| `PATCH /riders/me/emergency-contacts/{contactId}` | P0 | Update contact details or notification consent. |
| `DELETE /riders/me/emergency-contacts/{contactId}` | P0 | Remove a contact. |

Saved coordinates should be validated and normalized server-side. Contact verification, if enabled, needs rate-limited OTP delivery and verification endpoints rather than trusting a client-supplied `verified` flag.

Optional verified-contact additions:

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `POST /riders/me/emergency-contacts/{contactId}/verification` | Conditional | Send a verification challenge. |
| `POST /riders/me/emergency-contacts/{contactId}/verification/confirm` | Conditional | Confirm the challenge with rate and attempt limits. |

## Place discovery and serviceability

Saved places alone do not cover address search or service-area validation. If provider search is not intentionally performed on-device, add:

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `GET /places/autocomplete` | P0 | Return localized, proximity-biased address suggestions without exposing unrestricted provider credentials. |
| `GET /places/{placeId}` | P0 | Resolve a selected provider place to normalized coordinates and address components. |
| `POST /serviceability-checks` | P0 | Confirm pickup/destination service areas and supported ride classes before quoting. |

Place identifiers should be treated as provider-scoped references, not permanent substitutes for normalized address and coordinate data required by a ride.

## Fare estimates and ride lifecycle

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `POST /fare-estimates` | P0 | Calculate server-authoritative ride options, route summary, itemized fares, currency, and quote expiry. |
| `POST /rides` | P0 | Request a ride using a valid `fareEstimateId`, pickup, destination, ride class, payment choice, and idempotency key. |
| `GET /rides/active` | P0 | Recover the user's current ride after restart or reconnect. |
| `GET /rides/{rideId}` | P0 | Fetch an authorized ride snapshot, participants, fare, and current state. |
| `POST /rides/{rideId}/cancel` | P0 | Cancel with actor-specific reason rules and return any fee/refund result. |
| `POST /rides/{rideId}/sos` | P0 | Create a high-priority safety incident with a server timestamp and location snapshot. |
| `POST /rides/{rideId}/share-links` | P1 | Create an expiring, revocable trip-sharing link with minimal public data. |
| `DELETE /rides/{rideId}/share-links/{shareId}` | P1 | Revoke a trip-sharing link. |

The fare estimate response should include at least:

- `fareEstimateId`, `currency`, and `expiresAt`.
- Service-level ID, display name, capacity, ETA, and availability.
- Base fare, distance/time components, booking fee, surge, discount, taxes, and total.
- Route distance and duration used for pricing.
- Cancellation policy summary.

The server must calculate and sign the estimate. `POST /rides` must not accept a client-authored total price. Routing should move behind the backend or a production-approved client integration; the public OSRM demo endpoint should not be the pricing authority.

Recommended canonical ride states:

```text
requested → searching → driver_assigned → driver_arriving → driver_waiting
          → in_progress → completed

terminal alternatives: canceled_by_rider, canceled_by_driver,
                       canceled_by_system, no_driver_available
```

Do not expose a general `PATCH /rides/{rideId}` status field. Use actor-specific commands so the server can enforce valid transitions, timestamps, pricing consequences, and audit records.

## Driver onboarding and fleet

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `PUT /drivers/me/onboarding` | P0 | Submit identity, licence, service-area, policy consent, and application data idempotently. |
| `GET /drivers/me` | P0 | Fetch profile, verification state, availability, active vehicle, and compliance blockers. |
| `PATCH /drivers/me` | P0 | Update allowed profile and operating preferences. |
| `GET /drivers/me/documents` | P0 | List document type, review state, rejection reason, and expiry without returning unrestricted storage URLs. |
| `POST /drivers/me/documents` | P0 | Register an uploaded document and start verification. |
| `DELETE /drivers/me/documents/{documentId}` | P1 | Remove or supersede a document when policy permits. |
| `GET /drivers/me/vehicles` | P0 | List owned/approved vehicles. |
| `POST /drivers/me/vehicles` | P0 | Add a vehicle and its compliance metadata. |
| `PATCH /drivers/me/vehicles/{vehicleId}` | P0 | Update allowed vehicle fields. Compliance-sensitive changes must trigger re-review. |
| `DELETE /drivers/me/vehicles/{vehicleId}` | P1 | Archive an unused vehicle if it is not assigned to an active ride. |
| `PUT /drivers/me/active-vehicle` | P0 | Select one approved vehicle for the current shift. |
| `PUT /drivers/me/availability` | P0 | Go online/offline with service types and enforce approval, vehicle, document, and active-trip constraints. |

Driver approval must be asynchronous. A driver cannot approve their own profile, documents, or vehicle by changing a client-writable field.

## Driver location, offers, and trip actions

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `GET /drivers/me/availability` | P0 | Recover availability and the current location session after restart or reconnect. |
| `GET /drivers/me/offers` | P0 | Recover pending ride offers after restart or reconnect. |
| `POST /ride-offers/{offerId}/accept` | P0 | Atomically accept an unexpired offer and prevent double assignment. |
| `POST /ride-offers/{offerId}/reject` | P0 | Reject an offer with an optional controlled reason. |
| `POST /rides/{rideId}/arrive` | P0 | Driver reports arrival; server checks assignment and reasonable proximity. |
| `POST /rides/{rideId}/start` | P0 | Start the trip, preferably with a rider PIN or equivalent confirmation. |
| `POST /rides/{rideId}/complete` | P0 | Complete the trip and trigger final fare, payment, receipt, earnings, and notifications. |
| `POST /rides/{rideId}/cash-confirmations` | Conditional | Record the authorized party's cash handover confirmation and resolve disputes safely. |

### Live driver location

Do not send every GPS ping through an ordinary Cloud Function if Firebase Realtime Database is available. Use a narrowly scoped real-time write path such as:

```text
/driverLocations/{driverId}
```

Required controls:

- Firebase Auth plus App Check.
- A driver may write only their own location while online or assigned.
- Validate latitude, longitude, accuracy, heading, speed, and server-relative timestamp bounds.
- Reject implausible jumps and stale sequence numbers.
- Apply TTL cleanup; do not retain raw high-frequency history indefinitely.
- Only the matched rider, assigned driver, and authorized operations staff may read active-trip location.

If direct database writes cannot meet validation or compliance requirements, add `POST /drivers/me/location-batches` and send small ordered batches to a dedicated low-latency ingestion service.

### Real-time ride channels

Recommended authorized subscriptions:

```text
/rides/{rideId}
/rides/{rideId}/events
/drivers/{driverId}/offers/{offerId}
/driverLocations/{driverId}
/rides/{rideId}/messages/{messageId}
```

The HTTP API remains the only command path. Clients may observe state through subscriptions but must not directly set ride state, fare, assignment, payment, or earnings fields.

## Payments, receipts, wallets, and payouts

Payment provider tokens must be used instead of handling raw card numbers or bank credentials in RideZA systems.

### Rider payment methods and charges

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `POST /riders/me/payment-methods/setup` | P0 | Create a provider setup flow or client secret for tokenized payment details. |
| `GET /riders/me/payment-methods` | P0 | List masked tokenized methods. |
| `PUT /riders/me/default-payment-method` | P0 | Select a method owned by the authenticated rider. |
| `DELETE /riders/me/payment-methods/{paymentMethodId}` | P0 | Detach a method if it is not required by an active ride. |
| `GET /rides/{rideId}/receipt` | P0 | Return the immutable itemized receipt and payment status. |
| `POST /rides/{rideId}/refund-requests` | P1 | Request a refund with a controlled reason and supporting detail. |
| `GET /riders/me/refund-requests` | P1 | List refund request states and decisions. |

Authorization, capture, cancellation fees, tips, refunds, and receipt generation should be server-driven by ride transitions and verified provider events. Do not let the app call a generic endpoint that chooses arbitrary payment amounts.

### Rider wallet

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `GET /riders/me/wallet` | Conditional | Return credit balance, currency, and wallet status. |
| `GET /riders/me/wallet/transactions` | Conditional | Paginated immutable ledger entries. |
| `POST /riders/me/wallet/top-ups` | Conditional | Start a provider-backed top-up with an idempotency key. |

Only implement a stored-value wallet after its accounting, reconciliation, expiry, chargeback, and regulatory model is defined. Promotional credits can use the same read model but should be a separate ledger type from deposited money.

### Driver earnings and payouts

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `GET /drivers/me/earnings/summary` | P0 | Return server-calculated gross fares, fees, tips, adjustments, and net earnings for a date range. |
| `GET /drivers/me/earnings/transactions` | P0 | Paginated immutable driver ledger. |
| `POST /drivers/me/payout-accounts/onboarding` | P0 | Start or resume provider-hosted payout onboarding. |
| `GET /drivers/me/payout-account` | P0 | Return masked payout readiness and compliance status. |
| `GET /drivers/me/payouts` | P0 | List payout amounts, periods, status, and failure reasons. |
| `POST /drivers/me/payout-requests` | Conditional | Request an instant/manual payout if the business supports it. |

### RideZA+ membership

The existing RideZA+ screen requires a backend if membership is sold rather than remaining informational UI.

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `GET /memberships/plans` | Conditional | Return eligible plans, benefits, terms version, price, and currency. |
| `GET /memberships/me` | Conditional | Return current membership and renewal/cancellation state. |
| `POST /memberships/checkout-sessions` | Conditional | Start provider-hosted purchase with eligibility and terms consent. |
| `POST /memberships/me/cancellation-requests` | Conditional | Request end-of-period or policy-compliant cancellation. |

Membership activation, renewal, payment failure, cancellation, and refund state must be driven by verified payment-provider events.

## Notification devices and preferences

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `POST /notification-devices` | P0 | Upsert an Expo/FCM/APNs token with platform, app version, locale, and installation ID. |
| `DELETE /notification-devices/{installationId}` | P0 | Unregister the current installation on sign-out, token rotation, or account removal. |
| `GET /notification-preferences` | P1 | Fetch transactional and optional notification settings. |
| `PATCH /notification-preferences` | P1 | Update only user-configurable categories and channels. |

Critical ride, payment, security, and safety notifications should be modeled separately from optional marketing preferences. Invalid provider tokens must be disabled from delivery feedback.

## Ratings, communications, support, and history

### Ratings

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `POST /rides/{rideId}/ratings` | P0 | Submit one role-aware rating after a completed ride; support tags, note, and optional tip reference. |
| `GET /drivers/{driverId}/rating-summary` | P0 | Return the public aggregate needed by matched riders, not private review details. |

Rating edits should either be disallowed or use a short documented window. Moderation and retaliation protections should prevent exposing reviewer identities or raw notes to the other party.

### Trip history

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `GET /riders/me/rides` | P0 | Cursor-paginated rider history with filters and compact summaries. |
| `GET /drivers/me/rides` | P0 | Cursor-paginated driver history and earnings linkage. |

The existing `GET /rides/{rideId}`, receipt, and support resources supply details without duplicating a second history model.

### In-trip chat and calling

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `GET /rides/{rideId}/messages` | Conditional | Recover authorized, paginated messages for an active/recent ride. |
| `POST /rides/{rideId}/messages` | Conditional | Send a rate-limited message or persist it before real-time delivery. |
| `POST /rides/{rideId}/call-sessions` | Conditional | Create a short-lived masked-number or in-app call session for assigned participants. |

These endpoints are required if the existing driver-chat and driver-call screens remain product features. Never expose personal phone numbers directly when a relay or in-app calling provider is used.

### Support and safety follow-up

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `POST /support/tickets` | P0 | Create a categorized ticket, optionally linked to a ride, payment, payout, or safety incident. |
| `GET /support/tickets` | P0 | List the authenticated user's tickets. |
| `GET /support/tickets/{ticketId}` | P0 | Fetch an authorized ticket and status. |
| `POST /support/tickets/{ticketId}/messages` | P0 | Add a message or attachment reference to an open ticket. |
| `POST /support/tickets/{ticketId}/close` | P1 | Allow the requester to close a resolvable ticket. |

`POST /rides/{rideId}/sos` must create an immutable incident and alert the operational safety path; creating a normal support ticket is not enough for an active emergency.

## Provider webhooks

| Method and path | Priority | Purpose |
| --- | --- | --- |
| `POST /webhooks/payments/{provider}` | P0 | Receive signed, replay-safe charge, refund, dispute, payout, and account-status events. |
| `POST /webhooks/document-verification/{provider}` | Conditional | Receive signed identity/document review outcomes. |
| `POST /webhooks/communications/{provider}` | Conditional | Receive call or message delivery/status events. |

Webhook handlers must verify signatures against the raw request body, store provider event IDs, process idempotently, and return quickly before asynchronous business processing.

## Operations and admin surface

The consumer and driver workflows cannot operate safely without staff controls. These should use a separate admin client, stricter roles, enforced MFA, immutable audit logs, and preferably a separate hostname or gateway policy.

Minimum operational capabilities:

| Method and path | Purpose |
| --- | --- |
| `GET /admin/driver-applications` | Review queued applications and compliance blockers. |
| `POST /admin/driver-applications/{driverId}/decisions` | Approve, reject, suspend, or request more information with reason codes. |
| `POST /admin/documents/{documentId}/decisions` | Record document verification decisions. |
| `GET /admin/rides/{rideId}` | Inspect full ride state and audit events for support/safety. |
| `POST /admin/rides/{rideId}/actions` | Perform narrowly defined interventions, never arbitrary field edits. |
| `GET /admin/support/tickets` | Queue, filter, and assign tickets. |
| `POST /admin/support/tickets/{ticketId}/messages` | Respond as an authorized support agent. |
| `POST /admin/refund-requests/{requestId}/decisions` | Approve or reject within role-based financial limits. |
| `GET /admin/reconciliation` | Compare ride ledger, payment, refund, and payout records. |
| `PUT /admin/service-areas/{serviceAreaId}/pricing` | Version future-effective pricing rather than overwriting historical rules. |

## Cross-cutting API requirements

Every endpoint should follow these rules:

1. **Authentication and roles:** verify Firebase ID tokens on every private request; use server-managed rider, driver, support, finance, safety, and admin roles.
2. **Ownership:** derive the acting user from the token, never a caller-provided user ID. Check ride assignment and resource ownership on every nested resource.
3. **Idempotency:** require `Idempotency-Key` for ride requests, offer acceptance, payments, wallet top-ups, payouts, refunds, and other retryable commands.
4. **Concurrency:** use transactions for offer acceptance, ride transitions, ledger writes, vehicle selection, and availability changes.
5. **Validation:** use explicit schemas, allowlists, normalized coordinates/phones, server timestamps, controlled enums, and request-size limits.
6. **Errors:** return a stable error envelope such as `{ code, message, requestId, details? }` without leaking provider or stack details.
7. **Pagination:** use cursor pagination for rides, messages, ledger entries, payouts, tickets, and admin queues.
8. **Money:** store integer minor units and ISO currency; use immutable double-entry ledgers for wallet and driver balances.
9. **Audit:** record actor, action, before/after state, reason, request ID, timestamp, and relevant provider event for sensitive operations.
10. **Privacy:** minimize location retention, encrypt sensitive PII, use short-lived signed document URLs, redact logs, and enforce retention/deletion policies.
11. **Abuse controls:** add App Check, per-user/device/IP rate limits, duplicate detection, OTP attempt limits, and alerting on suspicious location/payment behavior.
12. **Observability:** propagate request/ride/payment IDs through structured logs, metrics, traces, and alerts without logging tokens or raw sensitive data.
13. **Versioning:** deploy under `/v1`; make breaking changes in a new version while keeping event and webhook schemas versioned too.

## Recommended delivery sequence

### Phase 1: identity and rider data

- Build the `/v1` gateway, shared auth/role middleware, validation, errors, idempotency, and audit primitives.
- Add session/config, rider onboarding/profile, saved places, emergency contacts, uploads, and notification devices.

### Phase 2: dispatch core

- Add server-side fare estimates, ride requests, active-ride recovery, cancellation, canonical state, and authorized subscriptions.
- Add driver onboarding, documents, vehicles, availability, live location, offers, and atomic trip actions.

### Phase 3: money and safety

- Add tokenized payment methods, authorization/capture, cash confirmation, receipts, driver ledgers/payouts, webhooks, SOS, and operational tooling.

### Phase 4: product completion

- Add ratings, history, support, refund requests, notifications/preferences, chat/calling, trip sharing, and wallet features that the product actually enables.

## Acceptance criteria before launch

- A ride survives app restarts and network interruptions on both rider and driver clients.
- Only one driver can accept an offer, and every invalid or replayed transition is rejected.
- The server owns price, cancellation fee, final fare, payment, refund, payout, and receipt calculations.
- Active location is visible only to authorized parties and expires after the operational retention window.
- Driver approval and documents cannot be self-approved from a client.
- Payment and payout webhooks are signature-verified, idempotent, reconciled, and observable.
- Every P0 endpoint has authorization, validation, concurrency, failure, and retry tests.
- Support and safety staff can resolve live incidents without direct database edits.
