# WashAlert Mobile (Expo)

## Environment setup

Copy `.env.example` to `.env` and set:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8081
EXPO_PUBLIC_FIREBASE_API_KEY=REPLACE_WITH_FIREBASE_WEB_API_KEY
EXPO_PUBLIC_ENABLE_DEMO_MODE=false
```

Notes:
- Use `http://10.0.2.2:8081` for Android emulator.
- Use your Firebase project's web app settings for `EXPO_PUBLIC_FIREBASE_*`.
- Keep `EXPO_PUBLIC_ENABLE_DEMO_MODE=false` for real backend/Firebase validation.

## Expo Go vs development build

- Expo Go:
  - Use for regular development and non-push testing.
  - Remote Android push (FCM token via `expo-notifications`) is intentionally skipped.
  - Auth, OTP, email, chat, and general app flows remain usable.
- Android development build:
  - Use this for remote push notification testing on Android.
  - Required because Expo Go on Android does not support remote push in newer Expo SDKs.

## Required Firebase file for Android push

1. In Firebase Console, open the Android app for package `com.washalert.mobile`.
2. Download `google-services.json`.
3. Place it at: `mobile/google-services.json`.
4. Do not commit this file; it is git-ignored.

## Commands

Install dependencies:

```bash
npm install
```

Run in Expo Go (non-push testing):

```bash
npm run start
```

Build Android development client for push testing:

```bash
npx eas-cli login
npx eas-cli init
npm run build:android:dev
```

Start Metro for installed development client:

```bash
npm run start:dev-client
```

## Push testing flow (Android development build)

1. Install the generated APK from EAS build output.
2. Open the app from the development build (not Expo Go).
3. Log in to trigger token registration and backend token sync.
4. Trigger app events (booking update, delivery update, payment confirmation, etc.) and verify push delivery.
