# WashAlert System Documentation (Draft)

Date: April 3, 2026

## Purpose

WashAlert is a laundry operations platform with:
- Admin/staff web dashboard
- Customer/driver mobile app
- Unified backend API

Core capabilities:
- Booking and order lifecycle
- Delivery assignment and tracking
- Inventory monitoring and forecasting
- Machine status monitoring
- Analytics and reporting
- Chat support and notification flows

## Architecture

Client layers:
- Web: React + Vite dashboard for admin/staff operations.
- Mobile: Expo React Native for customer/driver workflows.

Server layer:
- Spring Boot REST API with role-aware access controls.

Data layer:
- MySQL as active system of record.
- Firebase Firestore bridge for migration (dual-write enabled by config).
- Read strategy switch available via `washalert.data.read-mode` (`MYSQL`/`FIRESTORE`/`HYBRID`).

## Current Integration State

Web frontend:
- Connected to backend auth/session endpoints.
- Connected to dashboard, orders, users, machines, deliveries, inventory, analytics, and support chat endpoints.

Mobile frontend:
- Connected to backend auth, booking creation, order tracking, delivery tracking, and support chat endpoints.
- Local fallback logic retained for dev/demo continuity.

Backend:
- API modules implemented for orders, deliveries, inventory, machines, analytics, reporting, payments, support chat, auth, and verification.
- Firebase sync service added and connected to write paths of major modules.
- Firestore read adapter is active for machine, inventory, order, delivery, and user/auth reads (with safe fallback behavior in `HYBRID` mode).
- MySQL-to-Firestore one-time backfill runner is available via startup flag.
- Migration unit tests were added for auth read-mode behavior and backfill execution flow.

## Key API Domains

- Auth: login/register/me/logout/password reset/verify
- Bookings: available slots and booking creation
- Orders: CRUD/status updates and public tracking
- Deliveries: assignment, status/location updates, tracking
- Inventory: item management, stock adjustments, alerts, forecast
- Machines: listing, summary, status updates
- Analytics/Reports: summary metrics and NL report
- Support: chat assistance endpoint
- Migration Admin (admin-only):
  - `GET /api/admin/migration/parity`
  - `POST /api/admin/migration/backfill`

## Environment Configuration

Backend:
- DB: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
- CORS: `CORS_ALLOWED_ORIGINS`
- Mail: `MAIL_*`
- Firebase bridge:
  - `FIREBASE_ENABLED`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_SERVICE_ACCOUNT_PATH`
  - `FIREBASE_SERVICE_ACCOUNT_BASE64`
  - `DATA_READ_MODE` (`MYSQL`, `FIRESTORE`, `HYBRID`)
  - `FIREBASE_BACKFILL_ON_STARTUP` (`true` to run one-time backfill at startup)

Web:
- `VITE_API_BASE_URL`

Mobile:
- `EXPO_PUBLIC_API_BASE_URL`

## Deployment Notes

- Keep backend API contracts stable while iterating UI.
- Enable Firebase in staging first before production.
- Verify CORS origins for web and mobile network access.
- Validate env vars for API base URLs per environment.

## Known Gaps / Next Documentation Updates

- Final Firebase cutover plan and rollback strategy.
- Full endpoint catalog with sample requests/responses.
- Production deployment topology and CI/CD workflow.
- Role model expansion for native customer/driver backend accounts.
