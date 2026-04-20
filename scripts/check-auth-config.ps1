$ErrorActionPreference = "Stop"

function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }

Write-Info "Checking WashAlert auth setup prerequisites..."

$requiredBackendVars = @(
  "FIREBASE_ENABLED",
  "FIREBASE_PROJECT_ID",
  "DB_URL",
  "DB_USERNAME",
  "DB_PASSWORD",
  "MAIL_HOST",
  "MAIL_PORT",
  "MAIL_USERNAME",
  "MAIL_PASSWORD"
)

foreach ($name in $requiredBackendVars) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Warn "Missing backend env var: $name"
  } else {
    Write-Ok "Found backend env var: $name"
  }
}

$serviceAccountPath = [Environment]::GetEnvironmentVariable("FIREBASE_SERVICE_ACCOUNT_PATH")
if (-not [string]::IsNullOrWhiteSpace($serviceAccountPath)) {
  if (Test-Path $serviceAccountPath) {
    Write-Ok "Firebase service account file exists: $serviceAccountPath"
  } else {
    Write-Warn "Firebase service account file does not exist: $serviceAccountPath"
  }
} else {
  Write-Warn "FIREBASE_SERVICE_ACCOUNT_PATH is empty (or use FIREBASE_SERVICE_ACCOUNT_BASE64)"
}

$webEnv = Join-Path (Get-Location) "web\.env"
if (Test-Path $webEnv) {
  $webContent = Get-Content $webEnv -Raw
  if ($webContent -match "VITE_FIREBASE_API_KEY\s*=\s*.+") {
    Write-Ok "web/.env has VITE_FIREBASE_API_KEY"
  } else {
    Write-Warn "web/.env missing VITE_FIREBASE_API_KEY"
  }
  if ($webContent -match "VITE_API_BASE_URL\s*=\s*http://localhost:8081") {
    Write-Ok "web/.env API base URL points to backend 8081"
  } else {
    Write-Warn "web/.env API base URL is not http://localhost:8081"
  }
} else {
  Write-Warn "web/.env not found"
}

$mobileEnv = Join-Path (Get-Location) "mobile\.env"
if (Test-Path $mobileEnv) {
  $mobileContent = Get-Content $mobileEnv -Raw
  if ($mobileContent -match "EXPO_PUBLIC_FIREBASE_API_KEY\s*=\s*.+") {
    Write-Ok "mobile/.env has EXPO_PUBLIC_FIREBASE_API_KEY"
  } else {
    Write-Warn "mobile/.env missing EXPO_PUBLIC_FIREBASE_API_KEY"
  }
} else {
  Write-Warn "mobile/.env not found (copy from mobile/.env.example)"
}

try {
  $ping = Invoke-WebRequest -Uri "http://localhost:8081/ping" -UseBasicParsing -TimeoutSec 3
  if ($ping.StatusCode -eq 200 -and $ping.Content -match "OK") {
    Write-Ok "Backend ping succeeded (http://localhost:8081/ping)"
  } else {
    Write-Warn "Backend ping returned unexpected response"
  }
} catch {
  Write-Warn "Backend not reachable at http://localhost:8081/ping (start backend in IntelliJ)"
}

Write-Info "Auth setup check complete."
