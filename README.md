# WashAlert-Final
For Capstone Project

## Backend Teammate Setup (Railway MySQL)
1. Pull the latest repository from GitHub.
2. Open `backend/.env.example` and copy the required values from shared team credentials or the Railway project.
3. In IntelliJ, set backend run configuration environment variables:
   - `DB_URL`
   - `DB_USERNAME`
   - `DB_PASSWORD`
4. Run the backend application (`backend` module) from IntelliJ.

Notes:
- The backend datasource is environment-variable based; no DB credentials are hardcoded in `application.yaml`.
- Do not commit `.env` files, Railway credentials, or Firebase service account key files.
