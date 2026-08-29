# Credential Rotation Checklist

The `.env` file uses `EXPO_PUBLIC_*` values, which Expo embeds in the client application. These variables must never hold private server credentials.

## Keys that require action

- [ ] Create a replacement Firebase/Google API key for `EXPO_PUBLIC_FIREBASE_API_KEY` in the Google Cloud project used by Firebase.
- [ ] Restrict the replacement key to only the APIs required by the Firebase client.
- [x] Create separate Google Maps API keys for Android and iOS instead of sharing `GOOGLE_MAPS_API_KEY`.
- [x] Restrict the Android Maps key to package `com.thembelanim.rideza`, the production signing certificate fingerprint, and the required Maps APIs.
- [x] Restrict the iOS Maps key to bundle identifier `com.thembelanim.rideza` and the required Maps APIs.
- [x] Store replacement Maps values in local `.env` files and EAS environment variables, never in Git.
- [ ] Build and test authentication and maps with the replacement keys.
- [ ] Disable and then delete the exposed keys after the replacement build is confirmed.
- [ ] Review Google Cloud API usage and billing for unexpected activity since the first exposed commit.

## Public Firebase identifiers

The following Firebase client configuration values identify the Firebase project or app but do not grant privileged access by themselves:

- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

They normally do not need rotation. Security must come from Firebase Authentication, Security Rules, App Check, backend authorization, and restricted API keys—not from hiding these identifiers.

## Repository cleanup

- [x] Keep `.env` ignored by Git.
- [x] Keep placeholder-only `.env.example` tracked.
- [x] Remove `.env` from the local `main` branch history.
- [x] Force-push the rewritten `main` branch to GitHub.
- [ ] Ask every collaborator to make a fresh clone after the force-push.
- [ ] Confirm no pull request refs, forks, cached build artifacts, CI logs, or release artifacts still expose the old values.
