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
- Use your Firebase project's **Web API key**.
- Keep `EXPO_PUBLIC_ENABLE_DEMO_MODE=false` for real backend/Firebase validation.

## Run

```bash
npm install
npx expo start
```
