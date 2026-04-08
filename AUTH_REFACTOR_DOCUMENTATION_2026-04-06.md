# WashAlert Auth Refactor Documentation (April 6, 2026)

## 1. Target Architecture
- Identity and password lifecycle: Firebase Authentication
- App authorization source of truth: MySQL `users` profile
- Backend rule: Firebase identity alone is not enough; backend verifies local role/status/platform before access

## 2. Roles and Statuses
- Roles: `CUSTOMER`, `DRIVER`, `STAFF`, `ADMIN`
- Statuses: `PENDING`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED`

## 3. Data Model Updates (MySQL)
`users` entity now includes:
- `id`
- `firebase_uid`
- `email`
- `full_name`
- `role`
- `status`
- `branch`
- `branch_id`
- `invited_by`
- `invited_at`
- `activated_at`
- `deactivated_at`
- `last_login_at`
- `created_at`
- `updated_at`
- Existing compatibility fields retained: `password_hash`, `enabled`, `must_change_password`, `provider`

Implementation references:
- `backend/src/main/java/com/washalert/washalertbackend/user/User.java`
- `backend/src/main/java/com/washalert/washalertbackend/user/Role.java`
- `backend/src/main/java/com/washalert/washalertbackend/user/UserStatus.java`

## 4. Backend Auth Flow (Implemented)

### 4.1 Firebase-first session establishment
Endpoint:
- `POST /api/auth/firebase-session`

Request:
```json
{
  "idToken": "<firebase_id_token>",
  "platform": "WEB"
}
```

Backend behavior:
1. Verify Firebase ID token
2. Load local user by `firebase_uid` or `email`
3. Enforce local `status` and `role/platform` rules
4. Establish Spring Security session
5. Return normalized profile/session payload

### 4.2 Mobile customer profile bootstrap
Endpoint:
- `POST /api/auth/mobile/register-profile`

Request:
```json
{
  "idToken": "<firebase_id_token_from_signup>",
  "fullName": "Juan Dela Cruz"
}
```

Behavior:
- Creates or updates local profile as:
  - `role = CUSTOMER`
  - `status = ACTIVE`

### 4.3 Internal invite completion
Endpoint:
- `POST /api/auth/complete-invitation`

Request:
```json
{
  "idToken": "<firebase_id_token_after_password_setup>"
}
```

Behavior:
- For internal roles in `PENDING`, activates account and sets activation timestamps

### 4.4 Forgot password
Endpoint:
- `POST /api/auth/forgot-password`

Behavior:
- Generates Firebase reset link and sends via backend mail service
- Response remains generic (anti-enumeration)

### 4.5 Legacy endpoints
- `/api/auth/login` and `/api/auth/register` now return explicit migration errors for web/internal flow
- `/api/auth/reset-password`, `/api/auth/set-password`, `/api/auth/change-password` return migration guidance responses

Primary files:
- `backend/src/main/java/com/washalert/washalertbackend/auth/AuthController.java`
- `backend/src/main/java/com/washalert/washalertbackend/auth/AuthService.java`
- `backend/src/main/java/com/washalert/washalertbackend/auth/FirebaseIdentityService.java`
- `backend/src/main/java/com/washalert/washalertbackend/security/SecurityConfig.java`

## 5. Internal Account Lifecycle (Implemented)

### 5.1 Admin create internal user (staff or driver)
Endpoint:
- `POST /api/admin/users/staff` (compatibility path)

Request now supports role:
```json
{
  "fullName": "Maria Santos",
  "email": "maria@washalert.ph",
  "role": "DRIVER",
  "branch": "SpeedyWash - Pasig"
}
```

Behavior:
1. Validate role and branch constraints
2. Create Firebase Auth user (random bootstrap password, not shared)
3. Create local MySQL profile as `PENDING` with invite metadata
4. Generate Firebase password reset link
5. Send invite email

### 5.2 Admin actions
Implemented endpoints:
- `POST /api/admin/users/staff/{id}/resend-invite`
- `PATCH /api/admin/users/staff/{id}/status` with `ACTIVE|SUSPENDED|DEACTIVATED`

Files:
- `backend/src/main/java/com/washalert/washalertbackend/user/UserAdminController.java`
- `backend/src/main/java/com/washalert/washalertbackend/user/UserAdminService.java`

## 6. Web App Changes (Implemented)
- Removed public signup from active web flow
- `/signup` now shows internal-account notice page
- Login now:
  1. Authenticates against Firebase REST (`signInWithPassword`)
  2. Exchanges ID token to backend via `/api/auth/firebase-session`
  3. Stores normalized local session profile
- Forgot password uses Firebase REST `sendOobCode`
- Reset password and set password pages now use Firebase OOB flow
- Added role guard so only internal roles reach dashboard routes
- User management now supports:
  - inviting internal users with role selection (`STAFF`/`DRIVER`)
  - filters by role/status/branch
  - resend invite
  - suspend/reactivate/deactivate actions

Files:
- `web/src/lib/firebaseAuth.ts`
- `web/src/lib/api.ts`
- `web/src/pages/LoginPage.tsx`
- `web/src/pages/ForgotPasswordPage.tsx`
- `web/src/pages/ResetPasswordPage.tsx`
- `web/src/pages/SetPasswordPage.tsx`
- `web/src/pages/StaffAccountNoticePage.tsx`
- `web/src/pages/UsersPage.tsx`
- `web/src/App.tsx`

## 7. Mobile App Changes (Implemented)
- Mobile auth context now uses Firebase REST for:
  - login
  - signup
  - forgot password
  - reset password
- After Firebase login, app calls backend `/api/auth/firebase-session` with `platform=MOBILE`
- After customer signup, app calls backend `/api/auth/mobile/register-profile`
- Registration flow now redirects to login (OTP registration step removed from default success path)

Files:
- `mobile/src/context/AuthContext.jsx`
- `mobile/src/screens/auth/RegisterScreen.jsx`

## 8. Configuration Required

### Backend env vars
- `FIREBASE_ENABLED=true`
- `FIREBASE_PROJECT_ID=<project-id>`
- `FIREBASE_SERVICE_ACCOUNT_PATH=<absolute-json-path>` OR `FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-json>`
- SMTP vars for email sending:
  - `MAIL_HOST`
  - `MAIL_PORT`
  - `MAIL_USERNAME`
  - `MAIL_PASSWORD`
  - `MAIL_FROM`

### Web env vars
- `VITE_API_BASE_URL=http://localhost:8081`
- `VITE_FIREBASE_API_KEY=<firebase_web_api_key>`

### Mobile env vars
- `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8081` (Android emulator)
- `EXPO_PUBLIC_FIREBASE_API_KEY=<firebase_web_api_key_or_mobile-compatible-key>`

## 9. Validation and Build Status
- Backend tests: `mvn test` passed in this workspace
- Web build: `npm run build` passed
- Mobile lint/build validation could not be fully executed due local Expo tooling resolution issues in this environment

## 10. Known Gaps (Next Phase)
The following items still need completion to fully satisfy the full architecture checklist:
- Branch-scoped authorization enforcement in all relevant backend modules (orders/inventory/delivery queries)
- Driver module-level data restriction (assigned deliveries only)
- Full audit log event coverage for all listed auth/account lifecycle actions
- Dedicated API/UI for role change and branch reassignment workflows
- Comprehensive automated tests for all role/status/platform and invite expiration scenarios
- Optional removal of legacy OTP pages/components no longer used in final flow

## 11. Step-by-Step Next Steps
1. Configure Firebase Admin credentials on backend and set `FIREBASE_ENABLED=true`.
2. Set Firebase API keys in web/mobile environment configs.
3. Verify email SMTP credentials by sending a test invite from User Management.
4. Create one staff and one driver account from User Management and confirm:
   - local status starts `PENDING`
   - invite email is received
5. Open invite link and complete password setup; verify status transitions to `ACTIVE`.
6. Test web login:
   - staff/admin can log in
   - customer/driver are denied on web
7. Test mobile login:
   - customer/driver can log in
   - staff/admin are denied on mobile
8. Test forgot password on both web and mobile for each role with generic success messaging.
9. Implement and enforce branch-scoped queries in backend service layers for staff.
10. Add/expand audit log events for all required auth lifecycle actions.
11. Add integration tests for role/platform/status matrix and invite lifecycle.
12. Run UAT using your existing checklist and update any remaining UX edge cases.

---

## 12. Update Log (April 7, 2026) - Invite + Branch + Landing UI Fixes

### 12.1 Internal invite flow fix (BCrypt 72-byte issue)
Issue resolved:
- `POST /api/admin/users/staff` no longer hashes long generated bootstrap passwords with BCrypt.

What changed:
1. Internal user creation now uses Firebase-first invitation creation:
   - `FirebaseIdentityService.createInvitationUser(...)`
2. Local MySQL account creation no longer depends on BCrypt temp password hashing.
3. Internal users are still created as:
   - `status = PENDING`
   - with invite metadata (`invitedAt`, `invitedBy`)
4. Invitation email still sends a Firebase password setup/reset action link.
5. After invitation completion, activation now stamps both:
   - `activatedAt`
   - `verifiedAt`
6. Legacy password-compare guards were added so non-BCrypt placeholders do not crash fallback services.

Backend files updated:
- `backend/src/main/java/com/washalert/washalertbackend/auth/FirebaseIdentityService.java`
- `backend/src/main/java/com/washalert/washalertbackend/user/UserAdminService.java`
- `backend/src/main/java/com/washalert/washalertbackend/auth/AuthService.java`
- `backend/src/main/java/com/washalert/washalertbackend/auth/StaffInvitationService.java`
- `backend/src/main/java/com/washalert/washalertbackend/auth/PasswordResetService.java`
- `backend/src/main/java/com/washalert/washalertbackend/user/User.java`

Important:
- No Firebase project config, API keys, service account config, SMTP config, or IntelliJ env var settings were changed.

### 12.2 Branch field fix (UI + validation)
What changed on User Management:
1. Branch input is now a dropdown (no free-text branch input).
2. Branch options use the WashAlert branch list.
3. Staff invite now requires branch selection.
4. Driver invite keeps branch optional.
5. Empty-state branch message is shown if branch list is unavailable:
   - `No branches available`

Frontend file updated:
- `web/src/pages/UsersPage.tsx`

### 12.3 Landing page cleanup
What changed:
1. Removed duplicate top-right `Sign In` button.
2. Kept one internal login entry:
   - `Staff Portal` -> `/login`
3. Replaced hero CTA with:
   - `Download the App` -> temporary toast (`Mobile app coming soon`)
4. Removed extra duplicate staff login CTAs in page sections.

Frontend file updated:
- `web/src/pages/WelcomePage.tsx`

### 12.4 Validation/verification status
Executed checks:
1. Backend tests: passed (`mvn test`)
2. Web production build: passed (`npm run build`)

### 12.5 Immediate manual QA script for this update
1. Login as Admin on web.
Expected:
- Admin dashboard loads (existing working auth remains intact).

2. Go to User Management -> Invite User.
Expected:
- Role dropdown available (`Staff`, `Driver`).
- Branch input is a dropdown, not text input.

3. Create staff without selecting branch.
Expected:
- Field-level validation error for branch.
- Request not submitted.

4. Create staff with valid email/name/branch.
Expected:
- Success toast: `Invitation sent successfully`.
- No `password must not be more than 72 bytes` error.

5. Confirm invite email arrives and open link.
Expected:
- Set password page loads.
- Invalid/expired links show clear error.

6. Complete password setup and login as invited staff.
Expected:
- Account transitions from `PENDING` to `ACTIVE`.
- Staff can access web internal routes.

7. Open landing page `/`.
Expected:
- Only one staff login action remains (`Staff Portal`).
- Hero shows `Download the App` button.
- No duplicate `Sign In` button at top-right.
