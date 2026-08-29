# Google Maps Setup

RideZA uses separate Google Maps Platform keys for Android and iOS. The keys are injected into native builds by `app.config.js` and must not be committed to Git.

## Required environment variables

Set both values locally in `.env` and in every EAS environment used for native builds:

```dotenv
GOOGLE_MAPS_ANDROID_API_KEY=your-android-google-maps-api-key
GOOGLE_MAPS_IOS_API_KEY=your-ios-google-maps-api-key
```

The previous shared `GOOGLE_MAPS_API_KEY` variable is no longer used. `app.config.js` maps the Android value to `android.config.googleMaps.apiKey` and the iOS value to `ios.config.googleMapsApiKey`. EAS builds fail early if either value is missing.

## Google Cloud restrictions

Create a separate key for each platform and apply all of the following restrictions.

### Android

- Application restriction: **Android apps**
- Package name: `com.thembelanim.rideza`
- Certificate: SHA-1 fingerprint of the certificate that signs the installed build
- API restriction: **Maps SDK for Android** only

The EAS production signing certificate fingerprint is configured on the current key. Add another package/fingerprint entry for every other signing certificate used, including a local debug keystore or development-build keystore. If Google Play App Signing is enabled, add the Play Console app-signing SHA-1 before publishing the store build.

### iOS

- Application restriction: **iOS apps**
- Bundle identifier: `com.thembelanim.rideza`
- API restriction: **Maps SDK for iOS** only

## EAS environments

The project expects both variables in the `development`, `preview`, and `production` EAS environments. To replace a value later, run:

```powershell
eas env:create development --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --visibility sensitive --scope project --force --non-interactive
eas env:create development --name GOOGLE_MAPS_IOS_API_KEY --value <key> --visibility sensitive --scope project --force --non-interactive
```

Repeat for `preview` and `production`. Rebuild the native application after changing a key because both values are compiled into the platform binaries.

## Verification

1. Run `npx expo config --type prebuild --json` with the two local variables present.
2. Build and install Android and iOS binaries signed for the configured restrictions.
3. Confirm the map loads on a physical device without authorization errors.
4. Review Google Maps Platform metrics and quotas after release.

The restricted Android key was verified in EAS preview build `3d0b3e45-685d-4849-acc5-f6ad595bd701` on an Android API 36 emulator. Physical Android verification remains pending. The iOS preview build remains pending until Apple Developer signing credentials and a test device are registered with EAS.

Mobile Maps keys are present in compiled applications by design. Their protection comes from app-identifier, signing-certificate, and API restrictions rather than secrecy alone. Google Maps Platform also requires an active billing account on the Cloud project.
