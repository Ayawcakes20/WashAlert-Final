# WashAlert Final Runbook

## A) Firebase Setup (One-Time)

1. Open [Firebase Console](https://console.firebase.google.com) and create/select your project.
2. Enable Firestore Database.
3. Go to `Project settings` -> `Service accounts` -> `Generate new private key`.
4. Save the JSON key locally, example:
   - `C:\keys\washalert-firebase.json`
5. Copy your Firebase Project ID (needed in backend env vars).

## B) Backend Setup and Run (IntelliJ)

1. Open IntelliJ IDEA.
2. Open folder:
   - `C:\Users\Paulo\Desktop\WashAlert-Final\backend`
3. Wait for Maven import/indexing.
4. Create Run Configuration for main class:
   - `WashalertBackendApplication`
5. Add these environment variables:

```env
DB_URL=jdbc:mysql://localhost:3306/washalert?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
DB_USERNAME=washalert
DB_PASSWORD=washalert123

FIREBASE_ENABLED=true
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=C:\keys\washalert-firebase.json

DATA_READ_MODE=HYBRID
FIREBASE_BACKFILL_ON_STARTUP=false
```

6. Run backend in IntelliJ.

## C) Firebase Backfill and Parity Check (Admin)

1. Login as admin.
2. Optional backfill trigger:
   - `POST /api/admin/migration/backfill`
3. Parity check:
   - `GET /api/admin/migration/parity`
4. Proceed to strict Firebase only when:
   - `readyForStrictFirestore=true`

## D) Web Frontend Run (VS Code)

1. Open VS Code.
2. Open folder:
   - `C:\Users\Paulo\Desktop\WashAlert-Final\web`
3. Create `.env` from `.env.example`.
4. Set:

```env
VITE_API_BASE_URL=http://localhost:8080
```

5. Run:

```powershell
npm install
npm run dev
```

6. Open the local URL shown by Vite.

## E) Mobile Frontend Run (VS Code)

1. Open VS Code.
2. Open folder:
   - `C:\Users\Paulo\Desktop\WashAlert-Final\mobile`
3. Create `.env` from `.env.example`.
4. Set API URL:

```env
# Android emulator
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080
```

```env
# Physical phone (same Wi-Fi)
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_PC_LAN_IP>:8080
```

5. Run:

```powershell
npm install
npm run start
```

6. Open app via emulator or Expo Go.

## F) End-to-End Smoke Test Checklist

1. Register user.
2. Verify OTP.
3. Login.
4. Create booking/order.
5. Update order status (staff/admin).
6. Assign and update delivery.
7. Check inventory and machine monitoring.
8. Check analytics and tracking pages.

## G) Strict Firebase Cutover (Staging First)

1. In backend env vars, switch:

```env
DATA_READ_MODE=FIRESTORE
```

2. Re-run smoke tests.
3. If stable, use same settings for production deployment.

## H) Useful Commands

Backend tests:

```powershell
cd C:\Users\Paulo\Desktop\WashAlert-Final\backend
.\mvnw.cmd -q test
```

Web:

```powershell
cd C:\Users\Paulo\Desktop\WashAlert-Final\web
npm install
npm run dev
```

Mobile:

```powershell
cd C:\Users\Paulo\Desktop\WashAlert-Final\mobile
npm install
npm run start
```
