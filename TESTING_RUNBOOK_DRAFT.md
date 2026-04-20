# WashAlert Testing Runbook (Draft)

Date: April 3, 2026

## 1) Prerequisites

- Java 17 installed
- Maven wrapper available in backend (`mvnw.cmd`)
- Node.js LTS installed
- MySQL running locally
- Firebase service account JSON ready (for Firebase-enabled tests)
- IDEs:
  - Backend: IntelliJ IDEA
  - Frontend (web + mobile): VS Code

## 2) Backend Testing (IntelliJ)

1. Open IntelliJ IDEA.
2. Open project folder: `C:\Users\Paulo\Desktop\WashAlert-Final\backend`.
3. Wait for Maven import and indexing to complete.
4. Configure environment variables in Run Configuration:
   - `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
   - optional Firebase vars:
     - `FIREBASE_ENABLED`
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_BASE64`
     - `DATA_READ_MODE` (`MYSQL`, `HYBRID`, or `FIRESTORE`)
5. Run tests:
   - IntelliJ Maven tool window -> `test`
   - or terminal in IntelliJ: `.\mvnw.cmd -q test`
6. Start backend:
   - Run `WashalertBackendApplication` main class
   - Confirm app starts on `http://localhost:8080`

## 3) Web Frontend Testing (VS Code)

1. Open VS Code.
2. Open folder: `C:\Users\Paulo\Desktop\WashAlert-Final\web`.
3. Create `.env` from `.env.example`.
4. Set `VITE_API_BASE_URL=http://localhost:8080`.
5. Run:
   - `npm install`
   - `npm run dev`
6. Open the shown localhost URL.
7. Validate flows:
   - Login/Signup
   - Dashboard summary
   - Users (staff list)
   - Orders list + status updates
   - Machines + Inventory views
   - Deliveries + Analytics + AI support page

## 4) Mobile Frontend Testing (VS Code)

1. Open VS Code.
2. Open folder: `C:\Users\Paulo\Desktop\WashAlert-Final\mobile`.
3. Create `.env` from `.env.example`.
4. Set API base:
   - Emulator: `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080`
   - Physical device (same network): use your PC LAN IP
5. Run:
   - `npm install`
   - `npm run start`
6. Launch app in Android/iOS simulator or Expo Go.
7. Validate flows:
   - Login/Register/Forgot Password
   - Create booking
   - Track order and delivery
   - Chat support

## 5) End-to-End Smoke Test Sequence

1. Register a user.
2. Verify email via OTP.
3. Login on web or mobile.
4. Create booking/order.
5. Update order status from staff/admin flow.
6. Assign delivery and update delivery status/location.
7. Check inventory and machine pages for data visibility.
8. Confirm analytics summary reflects latest state.

## 6) Firebase Migration Validation (Staging)

1. Set backend vars:
   - `FIREBASE_ENABLED=true`
   - `DATA_READ_MODE=HYBRID`
2. Start backend and test normal flows.
3. Run one-time backfill:
   - set `FIREBASE_BACKFILL_ON_STARTUP=true`
   - start backend once
4. Compare MySQL vs Firestore counts for:
   - users
   - machines
   - inventory
   - orders
   - deliveries
4.1 Optional API-based parity check (admin session):
   - `GET /api/admin/migration/parity`
   - Confirm `readyForStrictFirestore=true` before strict cutover.
4.2 Optional manual backfill trigger:
   - `POST /api/admin/migration/backfill`
5. Switch to `DATA_READ_MODE=FIRESTORE` in staging and repeat smoke tests.
6. Optional strict profile run:
   - `.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=staging-firestore`
