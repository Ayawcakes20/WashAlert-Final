# WashAlert Backend Audit and 3-Week Execution Plan

## 1) Current Backend Snapshot

Tech stack:
- Spring Boot 4 + Spring Security + Spring Data JPA + MySQL
- Session-based auth (with remember-me)
- Email OTP verification + password reset flow

Implemented modules:
- Authentication: register, login, logout, me, change-password, forgot/reset password, Google OAuth
- User Admin: create/update/delete staff, reset staff password
- Machines: list, summary, status update, create machine
- Job Orders: list, recent, summary, create, update status, delete
- Dashboard: summary endpoint
- Audit logs: staff create/delete actions

## 2) Important Gaps Found During Audit

1. Production secrets were hardcoded in `application.yaml` (DB, mail, OAuth).
2. CORS and frontend redirect URL were hardcoded for localhost.
3. `POST /api/auth/change-password` was publicly permitted in security config.
4. Staff could view machine data outside their own branch by query parameter.
5. Dashboard summary was global for everyone (staff should be branch-scoped).
6. Job tracking number generation scanned all records (scales poorly and can race).
7. Maven wrapper failed on this machine due to a null-array issue in `mvnw.cmd`.

## 3) Fixes Already Applied

1. Externalized sensitive config to environment variables in `application.yaml`.
2. Made frontend base URL and CORS allowed origins configurable via properties.
3. Removed `change-password` from public endpoints (must be authenticated now).
4. Enforced staff branch isolation in machine list + machine summary.
5. Enforced staff branch isolation in dashboard summary.
6. Reworked tracking number generation to use DB-generated order ID (`WA-<10000+id>`), avoiding full-table scans.
7. Patched `mvnw.cmd` to avoid null-array crash in PowerShell.

## 4) Module Priority Plan (3 Weeks)

Week 1 (must finish first):
- Stabilize auth and role security (done baseline, then regression test all auth flows)
- Finalize branch-based access rules for all endpoints
- Build API contract docs for web/mobile team (request/response samples)
- Set up production env variables for deployed backend

Week 2 (core client operations):
- Complete job-order lifecycle rules (timestamps, status transitions, validation)
- Add customer-facing tracking endpoint if required by new client
- Add branch-level reports needed by operations (daily totals, status counts)
- Add missing audit trails for sensitive actions (status updates, password resets)

Week 3 (hardening + panel-ready):
- Add integration tests for critical flows (auth, orders, machine updates)
- Prepare deployment checklist and rollback checklist
- Run UAT bug-fix sprint from client feedback
- Prepare architecture and defense script (ERD, module boundaries, security decisions)

## 5) Recommended API Checklist for Panel Defense

Be ready to explain these decisions:
- Why session auth was used instead of JWT (simpler web security + remember-me support)
- Why branch isolation is enforced at service layer
- How email verification and password reset prevent account abuse
- Why secrets are injected through environment variables in production
- Why tracking numbers are generated from DB IDs for uniqueness and speed

## 6) Next Module Candidates to Implement Immediately

Choose one as the next coding batch:
1. Job order business rules (strict status transition map + operator audit log)
2. Customer tracking module (`GET /api/orders/track/{trackingNumber}`)
3. Reporting module (daily/weekly branch metrics for admin dashboard)
4. Notification module (email/SMS updates when order status changes)

If your client requirements doc defines different modules, map each requirement to one backend endpoint and one database table change before coding.
