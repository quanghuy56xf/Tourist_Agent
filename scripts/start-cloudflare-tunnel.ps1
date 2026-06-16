# Cloudflare Tunnel — expose frontend local ra internet
# Yeu cau: cloudflared da cai, frontend dang chay port 3000

$ErrorActionPreference = "Stop"
$FrontendPort = 3000

# Kiem tra frontend
try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:$FrontendPort" -UseBasicParsing -TimeoutSec 5
    Write-Host "[OK] Frontend dang chay tai port $FrontendPort"
} catch {
    Write-Host "[LOI] Frontend chua chay. Chay truoc:"
    Write-Host "  cd frontend && npm run dev"
    exit 1
}

# Kiem tra cloudflared
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host ""
    Write-Host "Chua cai cloudflared. Cai bang mot trong cac cach:"
    Write-Host "  winget install Cloudflare.cloudflared"
    Write-Host "  hoac tai: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    Write-Host ""
    Write-Host "Sau khi cai, chay lai script nay."
    exit 1
}

# Dung tunnel cu neu co
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "Chon che do tunnel:"
Write-Host "  1. Quick Tunnel (nhanh, khong can domain, URL tam thoi)"
Write-Host "  2. Named Tunnel (on dinh, can domain + Cloudflare Zero Trust)"
Write-Host ""
$choice = Read-Host "Nhap 1 hoac 2 (mac dinh 1)"

if ($choice -eq "2") {
    $configPath = Join-Path (Split-Path $PSScriptRoot -Parent) "cloudflared\config.yml"
    if (-not (Test-Path $configPath)) {
        Write-Host "[LOI] Khong tim thay cloudflared\config.yml"
        Write-Host "Chay setup domain co dinh (1 lan):"
        Write-Host "  .\scripts\setup-named-tunnel.ps1"
        Write-Host "Huong dan: xem CLOUDFLARE_TUNNEL.md"
        exit 1
    }
    Write-Host "Dang khoi dong Named Tunnel..."
    Start-Process -FilePath "cloudflared" -ArgumentList "tunnel", "--config", $configPath, "run" -WindowStyle Minimized
    Write-Host "[OK] Named Tunnel dang chay. Truy cap qua domain da cau hinh."
} else {
    Write-Host "Dang khoi dong Quick Tunnel..."
    Write-Host "URL se hien ben duoi (dang https://xxx.trycloudflare.com)"
    Write-Host ""
    cloudflared tunnel --url "http://localhost:$FrontendPort"
}
