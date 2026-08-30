# Driver Availability and Live Location

## Implemented surface

The Firebase `api` function now exposes:

```text
GET /v1/drivers/me/availability
PUT /v1/drivers/me/availability
```

Both methods require a valid Firebase bearer token with a driver custom claim. Supported claim shapes are `driver: true`, `role: "driver"`, an array containing `"driver"`, or `roles.driver: true`.

Going online additionally requires an Admin-managed Realtime Database access projection:

```text
/driverAccess/{driverId}
  approved: true
  activeVehicleId: "vehicle-id"
  serviceTypes:
    economy: true
    standard: true
    premium: true
    seven_seater: true
```

Only service types present in this projection can be enabled. Mobile clients cannot read or write `driverAccess`. The future driver onboarding and vehicle services must update this projection with the Admin SDK whenever approval, suspension, active vehicle, or approved services change. Keeping this access data in Realtime Database also lets location security rules block a suspended driver immediately without trusting stale availability state.

## Availability request

```http
PUT /v1/drivers/me/availability
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{
  "available": true,
  "serviceTypes": ["standard"]
}
```

Going offline requires only `{ "available": false }`, so a suspended or non-compliant driver can always stop location publication.

The response contains the active vehicle, enabled service types, status, update time, and a rotating `locationSessionId`. Repeating an online request reuses the active session. Going offline invalidates the session and removes the last live location.

## Realtime Database paths

```text
/driverAvailability/{driverId}
/driverAccess/{driverId}
/driverLocations/{driverId}
/locationReaders/{driverId}/{riderId}
```

The Admin SDK is the only writer of access and availability. An approved online driver may write their own session-bound location. A location is readable only by that driver or by a user whose `locationReaders` value is `true`.

The future dispatch/assignment backend must grant and revoke rider access using the Admin SDK:

```text
locationReaders/{driverId}/{riderId} = true
```

It should grant access only after assignment and revoke it immediately when the ride becomes terminal or the assignment changes. Mobile clients cannot edit this mapping.

Location rules validate coordinate ranges, accuracy, heading, speed, a recent server-relative timestamp, monotonic sequence numbers, and the current location session. High-frequency historical location is not stored by this channel.

## Client service

`src/services/driverAvailability.ts` provides:

- `getDriverAvailability()` to recover online state after restart.
- `setDriverAvailability()` to go online or offline.
- `publishDriverLocation()` to update the protected real-time path.

Call `setDriverAvailability(false)` when ending a shift. A disconnect/presence worker should also mark stale drivers offline; the current API and rules prevent stale-session writes but do not yet implement server-side heartbeat expiry.

## Configuration and deployment

1. Create or select the Firebase Realtime Database instance for the project. No instance currently exists in `rideza-e4c3f`, so its location must be chosen before deployment.
2. Set `EXPO_PUBLIC_FIREBASE_DATABASE_URL` to the exact instance URL.
3. Deploy the new API function and database rules.
4. Set `EXPO_PUBLIC_API_URL` to the deployed `api` function URL and rebuild the app.

```text
firebase deploy --only functions:api,database
```

For local development, `firebase.json` configures the Functions emulator on port `5001` and the Realtime Database emulator on port `9000`.

## Remaining integration work

- Build the driver UI and foreground/background location watcher that calls the client service.
- Add driver onboarding and vehicle APIs that maintain `driverAccess` instead of creating the projection manually.
- Add dispatch logic that manages `locationReaders` and offer access atomically.
- Add App Check enforcement, stale-driver heartbeat cleanup, alerting, and emulator security-rule tests before production launch.
