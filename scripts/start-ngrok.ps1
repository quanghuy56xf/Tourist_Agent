# Start ngrok tunnel for backend (port 8000) and update frontend API URL.
# Prerequisites:
#   1. ngrok installed
#   2. ngrok config add-authtoken <YOUR_TOKEN>  (one-time, from https://dashboard.ngrok.com/get-started/your-authtoken)
#   3. Backend running: python -m uvicorn app.main:app --reload --port 8000

$ErrorActionPreference = "Stop"
$FrontendPort = 3000
$BackendPort = 8000
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$FrontendEnv = Join-Path $ProjectRoot "frontend\.env.local"
$BackendEnv = Join-Path $ProjectRoot ".env"

# Check backend + frontend
try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/health" -UseBasicParsing -TimeoutSec 3
    Write-Host "[OK] Backend dang chay tai port $BackendPort"
} catch {
    Write-Host "[LOI] Backend chua chay. Mo terminal khac va chay:"
    Write-Host "  cd backend"
    Write-Host "  python -m uvicorn app.main:app --reload --port 8000"
    exit 1
}
try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendPort" -UseBasicParsing -TimeoutSec 3
    Write-Host "[OK] Frontend dang chay tai port $FrontendPort"
} catch {
    Write-Host "[LOI] Frontend chua chay. Mo terminal khac va chay:"
    Write-Host "  cd frontend"
    Write-Host "  npm run dev"
    exit 1
}

# Check ngrok authtoken
$ngrokConfig = Join-Path $env:LOCALAPPDATA "ngrok\ngrok.yml"
if (-not (Test-Path $ngrokConfig)) {
    Write-Host ""
    Write-Host "Chua cau hinh ngrok authtoken. Lam 1 lan:"
    Write-Host "  1. Dang ky: https://dashboard.ngrok.com/signup"
    Write-Host "  2. Lay token: https://dashboard.ngrok.com/get-started/your-authtoken"
    Write-Host "  3. Chay: ngrok config add-authtoken <TOKEN_CUA_BAN>"
    exit 1
}

# Kill existing ngrok on 4040 if any
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Dang khoi dong ngrok tunnel (frontend port $FrontendPort)..."
Start-Process -FilePath "ngrok" -ArgumentList "http", $FrontendPort -WindowStyle Minimized

# Wait for ngrok API
$publicUrl = $null
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
        $publicUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
        if ($publicUrl) { break }
    } catch { }
}

if (-not $publicUrl) {
    Write-Host "[LOI] Khong lay duoc URL ngrok. Kiem tra ngrok tai http://127.0.0.1:4040"
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "  NGROK URL: $publicUrl"
Write-Host "========================================"
Write-Host ""

# API di qua Next.js rewrite, khong can URL backend rieng
Set-Content -Path $FrontendEnv -Value "# De trong - API proxy qua Next.js rewrite`nNEXT_PUBLIC_API_URL="
Write-Host "[OK] Da cap nhat frontend/.env.local (dung proxy mode)"

# Enable CORS allow all for ngrok dev (backend needs restart to pick up)
$backendEnvContent = Get-Content $BackendEnv -ErrorAction SilentlyContinue
if ($backendEnvContent -match "CORS_ALLOW_ALL=true") {
    Write-Host "[OK] CORS_ALLOW_ALL da bat san"
} else {
    Add-Content -Path $BackendEnv -Value "`nCORS_ALLOW_ALL=true"
    Write-Host "[!] Da them CORS_ALLOW_ALL=true vao .env"
    Write-Host "    RESTART backend de ap dung CORS moi!"
}

Write-Host ""
Write-Host "Buoc tiep theo:"
Write-Host "  - Neu frontend dang chay: restart (Ctrl+C roi npm run dev)"
Write-Host "  - Mo web qua ngrok: $publicUrl"
Write-Host "  - Hoac local: http://localhost:3000"
Write-Host "  - Ngrok dashboard: http://127.0.0.1:4040"
Write-Host ""
Write-Host "LUU Y: URL ngrok doi moi lan chay lai script (goi free)."
