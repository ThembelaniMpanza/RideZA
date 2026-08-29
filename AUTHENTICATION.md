# RideZA Authentication

RideZA uses Firebase Authentication as the source of truth for client sessions. The app does not copy ID tokens, user IDs, or email addresses into its own AsyncStorage keys.

## Client session lifecycle

- Native Firebase Auth state is encrypted with Expo SecureStore through `getReactNativePersistence`.
- Web persistence uses Firebase browser-local persistence.
- `onAuthStateChanged` controls access to the authenticated route group.
- Firebase refreshes its short-lived ID tokens using its persisted refresh credential.
- `onIdTokenChanged` and app foreground events trigger another server verification.
- A token rejected as invalid or revoked by the server signs the local user out.
- A temporary verification-service outage does not destroy a valid local Firebase session; protected backend endpoints must still reject unverified requests themselves.

## Deploy the verification function

1. Install the Firebase CLI and authenticate with the account that owns the project.
2. Select the Firebase project with `firebase use --add`.
3. Install server dependencies with `npm --prefix functions install`.
4. Build with `npm --prefix functions run build`.
5. Deploy with `firebase deploy --only functions:verifySession`.
6. Add the deployed HTTPS URL to local and EAS environments as `EXPO_PUBLIC_AUTH_VERIFY_URL`.
7. Rebuild the app because Expo public environment variables are embedded at build time.

For the local emulator, the URL follows this shape:

```text
http://127.0.0.1:5001/PROJECT_ID/us-central1/verifySession
```

## Protect future backend endpoints

Every endpoint that reads or changes private RideZA data must call `requireVerifiedUser` before doing any work. Client-side route protection improves navigation behavior but is not backend authorization.

The helper calls Firebase Admin `verifyIdToken(token, true)`, which verifies the signature and expiry and also checks whether the user's refresh tokens were revoked.
