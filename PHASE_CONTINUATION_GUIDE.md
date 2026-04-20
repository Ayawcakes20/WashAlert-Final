# WashAlert Continuation Guide (Phase Handoff)

Date: April 3, 2026  
Workspace: `C:\Users\Paulo\Desktop\WashAlert-Final`

## 1) Current Build Status

Completed:
- Frontend integration to backend for both web and mobile (API-connected auth, orders, deliveries, inventory, analytics, support chat).
- Backend Firebase bridge setup:
  - Added Firebase Admin dependency.
  - Added Firebase config classes and properties.
  - Added Firestore sync service.
  - Added dual-write sync hooks in data-mutation services:
    - orders
    - deliveries
    - machines
    - inventory
    - users/auth
- Firebase read migration (Phase 1):
  - Added `washalert.data.read-mode` with values `MYSQL`, `FIRESTORE`, `HYBRID` (default `MYSQL`).
  - Added Firestore read adapter service for machines, inventory, orders, deliveries, and users collections.
  - Updated machine/inventory/orders/delivery/user-auth reads to support Firestore + safe MySQL fallback in `HYBRID`.
  - `CustomUserDetailsService` can read user credentials from Firestore in read modes that prefer Firestore.
- Firebase sync hardening for user updates:
  - Added shared user payload mapper for consistent Firestore user documents.
  - Synced user updates from admin, register, OTP verify, password reset, Google OAuth creation, admin bootstrap, and change-password flows.
- One-time backfill support:
  - Added startup-triggered MySQL -> Firestore backfill runner.
  - Controlled by `FIREBASE_BACKFILL_ON_STARTUP=true`.
- Added staging migration admin API:
  - `GET /api/admin/migration/parity` for MySQL vs Firestore module count parity
  - `POST /api/admin/migration/backfill` to trigger manual backfill
- Added migration-focused backend unit tests:
  - `CustomUserDetailsServiceTests`
  - `FirestoreBackfillServiceTests`
  - `AuthServiceTests`
  - `MigrationParityServiceTests`
  - `HybridFallbackIntegrationTests` (SpringBoot integration, HYBRID fallback)
- Backend tests passed after these changes (`.\mvnw.cmd -q test`).

Not yet completed:
- Full migration to Firebase as the primary read/write data source.
- Production Firebase credentials + environment wiring in deployment platform.
- Role/domain model expansion for mobile customer/driver accounts as first-class backend roles.

## 2) System Overview (Current)

- Web frontend: React + Vite (`web`)
- Mobile frontend: Expo React Native (`mobile`)
- Backend API: Spring Boot (`backend`)
- Current persistent DB: MySQL (active)
- Firebase status: Firestore dual-write bridge (active only when enabled)

## 3) Firebase Bridge Config

Configured keys in backend `application.yaml`:
- `washalert.firebase.enabled`
- `washalert.firebase.project-id`
- `washalert.firebase.service-account-path`
- `washalert.firebase.service-account-base64`

Environment variable mapping:
- `FIREBASE_ENABLED`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `DATA_READ_MODE` (`MYSQL` | `FIRESTORE` | `HYBRID`)
- `FIREBASE_BACKFILL_ON_STARTUP` (`true` | `false`)

Behavior:
- If `FIREBASE_ENABLED=false`, backend runs normally with MySQL only.
- If `FIREBASE_ENABLED=true` and credentials are valid, backend keeps MySQL as source of truth and syncs changes to Firestore.

## 4) Recommended Next Phase (Highest Priority)

Phase: Make Firebase migration safe and reversible before full cutover.

Tasks:
1. Validate Firestore indexes and document conventions in staging.
2. Run one-time backfill in staging and compare counts per module.
3. Add API-level integration tests for auth + tracking flows under `HYBRID` mode.
4. Decide whether `FIRESTORE` mode should be strict (no MySQL fallback) for production cutover.
5. Prepare final deployment runbook (envs, rollback, smoke tests).
6. In staging, use `/api/admin/migration/parity` before and after backfill; cut over only when `readyForStrictFirestore=true`.

## 5) How to Continue in the Next Prompt (When Tokens Are Full)

Use this exact message in the next prompt:

```text
Continue WashAlert from C:\Users\Paulo\Desktop\WashAlert-Final.
Read PHASE_CONTINUATION_GUIDE.md first, then proceed with Phase: Firebase read migration.
Keep UI unchanged unless required.
Do not break existing API contracts for web/mobile.
Proceed with parity testing and staging backfill verification, then document production cutover checklist.
Update the guide with completed items and remaining tasks after changes.
```

## 6) Run Commands

Backend:
- `cd C:\Users\Paulo\Desktop\WashAlert-Final\backend`
- `.\mvnw.cmd spring-boot:run`
- `.\mvnw.cmd -q test`
- One-time backfill run:
- Set env vars first (`FIREBASE_ENABLED=true`, credentials, and `FIREBASE_BACKFILL_ON_STARTUP=true`)
- Then start backend once; the runner logs backfill totals and exits normal startup path.
- Example (PowerShell):
- `$env:FIREBASE_ENABLED='true'`
- `$env:FIREBASE_PROJECT_ID='your-project-id'`
- `$env:FIREBASE_SERVICE_ACCOUNT_PATH='C:\path\service-account.json'`
- `$env:FIREBASE_BACKFILL_ON_STARTUP='true'`
- `.\mvnw.cmd spring-boot:run`

Web:
- `cd C:\Users\Paulo\Desktop\WashAlert-Final\web`
- `npm install`
- `npm run dev`

Mobile:
- `cd C:\Users\Paulo\Desktop\WashAlert-Final\mobile`
- `npm install`
- `npm run start`
