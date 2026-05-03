# WashAlert Live Setup (Steps 1–3)

This guide executes:
1. Firebase backend credentials setup
2. Web/mobile Firebase API key setup
3. SMTP setup and invite-email verification

## Step 1: Configure Backend Firebase Credentials (IntelliJ)

Open backend run configuration in IntelliJ and set environment variables:

- `FIREBASE_ENABLED=true`
- `FIREBASE_PROJECT_ID=<your-project-id>`
- `FIREBASE_SERVICE_ACCOUNT_PATH=<absolute path to service-account.json>`
- `DB_URL=<your mysql url>`
- `DB_USERNAME=<your mysql user>`
- `DB_PASSWORD=<your mysql password>`
- `MAIL_HOST=smtp.resend.com`
- `MAIL_PORT=587`
- `MAIL_USERNAME=resend`
- `MAIL_PASSWORD=<resend_api_key>`
- `MAIL_FROM=WashAlert Support <noreply@washalert.com>`

Reference template:
- `backend/.env.example`

## Step 2: Configure Frontend Firebase Keys (VS Code)

### Web (`web/.env`)
Set:
- `VITE_API_BASE_URL=http://localhost:8081`
- `VITE_FIREBASE_API_KEY=<firebase web api key>`

Template:
- `web/.env.example`

### Mobile (`mobile/.env`)
Create `mobile/.env` (if missing) with:
- `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8081` (Android emulator)
- `EXPO_PUBLIC_FIREBASE_API_KEY=<firebase web api key>`

Template:
- `mobile/.env.example`

## Step 3: Verify SMTP + Invite Email Flow

1. Start backend from IntelliJ.
2. Confirm backend is running:
   - Open: `http://localhost:8081/ping`
   - Expected: `OK`
3. Start web:
   - In VS Code terminal:
   - `cd web`
   - `npm run dev`
4. Login as admin on web.
5. Open **User Management**.
6. Click **Invite User**.
7. Create a STAFF account with:
   - full name
   - email
   - role=`STAFF`
   - branch (required)
8. Expected:
   - UI toast success
   - account appears as `Pending`
   - invite email arrives in inbox
9. Open invite link from email and set password.
10. Expected:
   - success toast
   - redirected to login
   - user status transitions to `Active` after completion/login

## Quick Troubleshooting

- If email not sent:
  - verify `MAIL_USERNAME` and `MAIL_PASSWORD` (use app-password for Gmail)
  - confirm SMTP host/port and firewall
- If Firebase token errors:
  - check `FIREBASE_PROJECT_ID`
  - check `FIREBASE_SERVICE_ACCOUNT_PATH` points to valid JSON
  - ensure API key in web/mobile matches same Firebase project
- If CORS issues:
  - ensure frontend origin is included in `CORS_ALLOWED_ORIGINS`
