# Credential and Repository Remediation

This file records the evidence and operator actions for RD-5. Never paste credential values, scanner findings, or unredacted build output into this document.

## Exposure evidence

- The tracked `.env` file was introduced by commit `1101acaeb9ac6704e35917decf58dae358abcfa6` on 2026-08-30.
- The file contained Firebase client configuration plus separate Android and iOS Google Maps API keys.
- A redacted Gitleaks v8.29.0 scan of all 23 commits found three `gcp-api-key` findings, all in that file and commit.
- `EXPO_PUBLIC_*` values are embedded in the client bundle. They must contain only publishable client configuration, never privileged server credentials.
- The repository also tracked IDE metadata, emulator screenshots, Expo export output, and debug/build logs. These artifacts may contain local paths or runtime diagnostics and are removed by RD-5.

## Repository remediation

- [x] Replace the developer's local values with EAS-managed development values in ignored `.env.local` configuration.
- [x] Keep only the placeholder-only `.env.example` template in source control.
- [x] Ignore every `.env*` file except `.env.example`.
- [x] Remove tracked `.idea`, emulator screenshot, Expo export, and log artifacts.
- [x] Add a redacted Gitleaks scan over complete Git history to CI.
- [ ] Rewrite all shared Git refs to remove `.env`, then force-push in a coordinated maintenance window.
- [ ] Ask every collaborator to make a fresh clone after the force-push.
- [ ] Confirm no pull request refs, forks, CI logs, build caches, or release artifacts retain the exposed values.

## Credential rotation

Treat every API key value that appeared in `.env` as exposed even when it was intended for a public client.

- [x] Create replacement key `rideza-firebase-client-rd5-20260908` for `EXPO_PUBLIC_FIREBASE_API_KEY`.
- [x] Restrict the Firebase client key to Identity Toolkit, Secure Token, Firebase Installations, and Firebase Realtime Database APIs.
- [x] Create replacement key `rideza-android-maps-rd5-20260908` restricted to package `com.thembelanim.rideza`, signing fingerprint `d4199a3a50657021cc78ef6a0d09c85ac89f568f`, and the Android Maps API.
- [x] Create replacement key `rideza-ios-maps-rd5-20260908` restricted to bundle identifier `com.thembelanim.rideza` and the iOS Maps API.
- [x] Replace all three exposed values in the EAS development, preview, and production environments.
- [x] Pull replacement development values into ignored `.env.local` and delete the old local copy.
- [ ] Build and test authentication, maps, and backend session verification with replacement values.
- [ ] Disable exposed keys after replacement builds pass, then delete them after the rollback window.
- [ ] Review Google Cloud API usage and billing from 2026-08-30 onward for unexpected activity.

The Firebase auth domain, project ID, storage bucket, messaging sender ID, and app ID identify the public client project and generally do not need rotation. Authentication, Security Rules, App Check, backend authorization, and restricted API keys provide the security boundary.

## Approved configuration sources

| Runtime | Source | Requirements |
| --- | --- | --- |
| Local development | Ignored `.env.local`, pulled from the EAS `development` environment | Never commit this file; use development-restricted client keys. |
| Development build | EAS `development` environment | The `development` profile explicitly selects this environment. |
| Preview build | EAS `preview` environment | The `preview` profile explicitly selects this environment. |
| Production build | EAS `production` environment | The `production` profile explicitly selects this environment; no test-only flags. |
| CI | Committed non-secret profile defaults plus GitHub secrets where required | CI must not depend on a tracked local environment file. |

Keep endpoints and intentionally public client settings in `eas.json` only when they are safe to commit. Keep Maps keys, Firebase API keys, Sentry upload tokens, and all privileged server credentials in EAS or another approved secret store. Never prefix privileged values with `EXPO_PUBLIC_`.

## Verification

### 2026-09-08 results

- Local lint, TypeScript, all 11 tests, and Expo public configuration validation pass.
- Expo configuration resolves successfully with the EAS `development` and `preview` environments.
- Production Expo configuration reaches the unrelated RD-21 telemetry guard, then stops because Sentry/PostHog variables are not provisioned yet.
- The replacement Firebase client key receives HTTP 200 from the Identity Toolkit configuration endpoint.
- The configured Realtime Database endpoint is reachable and returns HTTP 401 for the intentionally unauthenticated validation request, as required by the database rules.
- Android preview build `4cc8f029-e3bf-43a1-8b39-e3371fb15728` was queued with the replacement EAS variables; install-time Maps validation remains pending.

Run these checks after the history rewrite and credential rotation:

```bash
git ls-files --error-unmatch .env
git log --all -- .env
gitleaks git --redact --verbose .
npm run lint
npm run typecheck
npm test
npm run validate:expo
```

The first command must fail because `.env` is untracked. The second and third commands must return no `.env` history or secret findings. Validate one build for every EAS profile before disabling exposed keys.
