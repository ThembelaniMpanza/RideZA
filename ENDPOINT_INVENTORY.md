# RideZA Endpoint Inventory

Last reviewed: 2026-08-30

For the proposed production API and missing-domain assessment, see `API_GAP_ASSESSMENT.md`.

## Scope and summary

This inventory covers first-party HTTP endpoints, explicit third-party HTTP calls, remote operations hidden behind SDKs, and client navigation routes. Package registry URLs and documentation links are excluded.

| Category | Count | Summary |
| --- | ---: | --- |
| First-party HTTP operations | 3 | Session verification plus driver availability read/update |
| Explicit third-party REST endpoints | 1 | Public OSRM driving-route service, called from two flows |
| Firebase Auth SDK operations | 5 | Sign up, sign in, password reset, token refresh, and sign out |
| Device/platform service families | 3 | Location, geocoding, and map tiles/rendering |
| Realtime Database channels | 2 | Driver availability and protected live location |

There are currently no backend endpoints for ride creation, ride status, driver discovery, chat, calls, payments, tips, reviews, ride history, subscriptions, or support. Those experiences are local UI/demo flows.

## First-party HTTP endpoint

### `POST /verifySession`

| Property | Value |
| --- | --- |
| Production URL | `https://verifysession-coo4wxiwva-uc.a.run.app` |
| Firebase function | `verifySession` |
| Runtime/region | Firebase Functions v2, `us-central1` |
| Exposure | Public invoker; application authentication is enforced in the handler |
| CORS | Enabled for all origins by `cors: true` |
| Client timeout | 10 seconds |
| Cache policy | `Cache-Control: no-store` |

Live validation on 2026-08-30 confirmed that `GET` returns `405` with `Allow: POST`, while an unauthenticated `POST` returns `401` with the expected missing-bearer-token error.

Request:

```http
POST / HTTP/1.1
Authorization: Bearer <Firebase ID token>
Accept: application/json
Content-Type: application/json

{}
```

The JSON body is ignored. The handler verifies the Firebase ID token with revocation checking enabled.

Success response (`200`):

```json
{
  "uid": "firebase-user-id",
  "email": "user@example.com",
  "expiresAt": "2026-08-30T12:00:00.000Z"
}
```

`email` can be `null`.

| Status | Condition | Response shape |
| ---: | --- | --- |
| `200` | Valid, non-revoked Firebase ID token | `{ uid, email, expiresAt }` |
| `401` | Missing, invalid, expired, or revoked bearer token | `{ error: string }` |
| `405` | Method other than `POST` | `{ error: "Method not allowed" }`; `Allow: POST` |
| `500` | Unexpected verification failure | `{ error: "Session verification failed" }` |

Call sites and lifecycle:

- The client URL comes from `EXPO_PUBLIC_AUTH_VERIFY_URL`.
- Verification runs after Firebase restores a signed-in user, when the ID token changes, when the app returns to the foreground, and during an explicit refresh.
- A rejected session signs the local Firebase user out. A temporary endpoint failure retains the local Firebase session but marks server verification unavailable.

Implementation: `functions/src/index.ts`, `functions/src/auth.ts`, and `src/services/sessionVerification.ts`.

Local emulator URL template:

```text
http://127.0.0.1:5001/<project-id>/us-central1/verifySession
```

### `GET|PUT /v1/drivers/me/availability`

Implementation status: complete in source; deployment and Firebase project configuration are still required.

| Property | Value |
| --- | --- |
| Firebase function | `api` |
| Base URL | `EXPO_PUBLIC_API_URL` |
| Runtime/region | Firebase Functions v2, `us-central1` |
| Authentication | Firebase bearer token with a server-managed driver role |
| Online preconditions | Admin-managed driver approval, active vehicle, and service access projection in Realtime Database |
| Cache policy | `Cache-Control: no-store` |

`GET` recovers the current availability and location session. `PUT` accepts an `available` boolean and optional approved `serviceTypes`. Going online creates or reuses a location session; going offline invalidates the session and removes the live location.

Implementation: `functions/src/index.ts`, `functions/src/driverAvailability.ts`, and `src/services/driverAvailability.ts`.

## Realtime Database channels

| Path | Writers | Readers | Purpose |
| --- | --- | --- | --- |
| `/driverAccess/{driverId}` | Admin SDK only | No mobile client | Driver approval, active vehicle, and allowed-service projection |
| `/driverAvailability/{driverId}` | Admin SDK only through the API | The driver and explicitly authorized location readers | Canonical online/offline state and active location-session ID |
| `/driverLocations/{driverId}` | The authenticated online driver with the active session | The driver and users granted under `/locationReaders/{driverId}/{userId}` | Latest validated, sequence-ordered live location |

The default database policy is deny-all. Mobile clients cannot edit availability or reader grants. Location rules validate ownership, online state, session ID, coordinate ranges, accuracy, heading, speed, timestamp freshness, monotonic sequence, and allowed fields.

Implementation: `database.rules.json`. Setup and integration details: `DRIVER_AVAILABILITY.md`.

## Explicit third-party REST endpoint

### `GET https://router.project-osrm.org/route/v1/driving/{coordinates}`

| Property | Value |
| --- | --- |
| Provider | OSRM public demo server |
| Authentication | None |
| Path parameter | Semicolon-separated `longitude,latitude` pairs |
| Query | `overview=full&geometries=geojson` |
| Data sent | Precise pickup/destination or simulated driver coordinates |
| Data consumed | `routes[0].geometry.coordinates`, `distance`, and `duration` |

Active call patterns:

```text
GET /route/v1/driving/{driverLng},{driverLat};{pickupLng},{pickupLat}?overview=full&geometries=geojson
GET /route/v1/driving/{pickupLng},{pickupLat};{destinationLng},{destinationLat}?overview=full&geometries=geojson
```

The first call builds the simulated driver's approach route. The second builds the rider trip route and fare inputs. Both fall back to a locally generated straight line if routing fails. Neither call currently has an abort timeout, retry policy, rate limiter, or application proxy.

Implementation: `app/(main)/ride.tsx`.

## SDK-backed remote operations

These calls are network operations, but the project does not construct their HTTP URLs directly. Their concrete provider endpoints are selected by the SDK and platform at runtime.

### Firebase Authentication

Project: `rideza-e4c3f`.

| Operation | SDK call | Input | Active source |
| --- | --- | --- | --- |
| Create account | `createUserWithEmailAndPassword` | Email, password | `app/(auth)/signup.tsx` |
| Sign in | `signInWithEmailAndPassword` | Email, password | `app/(auth)/login.tsx` |
| Send password reset | `sendPasswordResetEmail` | Email | `app/(auth)/forgot-password.tsx` |
| Refresh/read ID token | `getIdToken`, `getIdTokenResult` | Persisted Firebase session | `src/services/sessionVerification.ts`, `src/auth/AuthProvider.tsx` |
| Sign out | `signOut` | Local Firebase session | `src/auth/AuthProvider.tsx` |

Firebase auth state and token-change listeners also communicate with Firebase as required by the SDK. Firebase public configuration is loaded from `EXPO_PUBLIC_FIREBASE_*` variables.

`src/screens/Auth/LoginScreen.js` contains a second sign-in call, but that legacy screen is not connected to the active Expo Router tree.

### Location and geocoding

`app/(main)/ride.tsx` uses Expo Location for:

- Foreground location permission.
- Current device position.
- Position updates every 15 metres.
- Forward geocoding for typed pickup and destination queries.
- Reverse geocoding for coordinates and address labels.

Location and geocoding providers vary by platform and runtime. These are not RideZA-owned endpoints.

### Maps

`react-native-maps` renders map data through the platform map provider. Native builds receive platform-specific Google Maps keys from `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` via `app.config.js`. The concrete tile/service URLs are managed by the native SDK and are not present in application source.

## Client navigation routes

Expo Router route-group segments such as `(auth)` and `(main)` organize code but are omitted from user-facing URLs. The custom URI scheme is `rideza://`.

| User-facing path | Source route | Access | Notes |
| --- | --- | --- | --- |
| `/` | `(onboarding)/index` | Signed out, onboarding incomplete | Onboarding flow |
| `/` | `(auth)/index` | Signed out, onboarding complete | Redirects to `/signup` |
| `/signup` | `(auth)/signup` | Signed out, onboarding complete | Firebase account creation |
| `/login` | `(auth)/login` | Signed out, onboarding complete | Firebase sign-in |
| `/forgot-password` | `(auth)/forgot-password` | Signed out, onboarding complete | Firebase password reset |
| `/` | `(main)/index` | Signed in | Redirects to `/ride` |
| `/ride` | `(main)/ride` | Signed in | Main ride demo |
| `/account` | `(main)/account` | Signed in | Account settings |
| `/previous-rides` | `(main)/previous-rides` | Signed in | Local ride-history UI |
| `/ride-options` | `(main)/ride-options` | Signed in | Hidden from tab bar |
| `/driver-chat` | `(main)/driver-chat` | Signed in | Local chat UI; no messaging endpoint |
| `/driver-call` | `(main)/driver-call` | Signed in | Local call UI; no telephony endpoint |
| `/rideza-plus` | `(main)/rideza-plus` | Signed in | Subscription UI; no billing endpoint |
| `/help-support` | `(main)/help-support` | Signed in | Support UI; no support endpoint |

Navigation guards are client-side UX controls. Backend authorization must continue to be enforced independently on every future private endpoint.

## Notable gaps and risks

1. The ride workflow is a simulation. It does not persist or synchronize rides, drivers, prices, payments, messages, calls, reviews, tips, or support requests.
2. Precise coordinates are sent directly from the client to the public OSRM demo server. Production use should evaluate provider terms, capacity, privacy requirements, and whether routing should go through a controlled service.
3. OSRM requests have graceful UI fallback but no timeout or cancellation, so a stalled request can leave routing state waiting indefinitely.
4. The verification function allows cross-origin requests from any origin. Bearer-token verification protects data, but a narrower CORS policy would reduce browser exposure if the supported web origins are known.
5. Firebase and Google Maps client keys are embedded in builds by design; Google Cloud restrictions and Firebase security controls must be the enforcement boundary.
6. The new availability API establishes `/v1`, while `verifySession` remains an unversioned legacy endpoint. Future ride-domain routes should remain under the versioned API.

## Maintenance checklist

Update this inventory whenever any of the following changes:

- A Firebase function export is added, removed, renamed, or moved to another region.
- A new `fetch`, HTTP client, Firebase product, or native network SDK is introduced.
- An environment variable containing a service base URL is added.
- A new Expo Router screen is added or its access guard changes.
- A local/demo feature gains a persistent backend implementation.
