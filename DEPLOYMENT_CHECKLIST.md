# WashAlert Deployment Checklist

Use this checklist before deploying to Railway (backend) and running web/mobile against production APIs.

## Backend Required Vars (Railway)
- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `SESSION_COOKIE_SAME_SITE=none`
- `SESSION_COOKIE_SECURE=true`
- `JPA_DDL_AUTO`

## Backend Recommended Values
- `JPA_DDL_AUTO=validate` (or `none`) once schema is stable in production.
- Keep `JPA_DDL_AUTO=update` only while actively evolving schema and validating migrations.
- Bootstrap admin (optional, one-time seed only):
  - `ADMIN_BOOTSTRAP_ENABLED=false` (set to `true` only when intentionally seeding)
  - `ADMIN_BOOTSTRAP_EMAIL`
  - `ADMIN_BOOTSTRAP_PASSWORD`
  - `ADMIN_BOOTSTRAP_FULL_NAME`
  - `ADMIN_BOOTSTRAP_BRANCH`

## Frontend/Mobile Required Vars
- Web: `VITE_API_BASE_URL`
- Mobile: `EXPO_PUBLIC_API_BASE_URL`

## Safety Rules
- Do not commit `.env` files, API keys, or service-account JSON files.
- Do not point web/mobile to local backend unless all local env vars are fully configured.
- Keep `/test` publicly reachable for deployment smoke-checks.

## Quick Smoke Checks After Deploy
1. `GET /test` returns success.
2. Web login + OTP succeeds.
3. Mobile login + OTP succeeds.
4. Dashboard modules load (`analytics`, `inventory`, `notifications`).
