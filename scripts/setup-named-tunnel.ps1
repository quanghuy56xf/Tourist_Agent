# Thiet lap Named Tunnel + domain co dinh tren Cloudflare
# Yeu cau: domain da add vao Cloudflare (DNS managed by Cloudflare)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ConfigDir = Join-Path $ProjectRoot "cloudflared"
$ConfigPath = Join-Path $ConfigDir "config.yml"
$TunnelName = "dinov2-app"
$FrontendPort = 3000

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "[LOI] Chua cai cloudflared. Chay: winget install Cloudflare.cloudflared"
    exit 1
}

Write-Host "========================================"
Write-Host "  SETUP CLOUDFLARE NAMED TUNNEL"
Write-Host "  Domain co dinh (HTTPS)"
Write-Host "========================================"
Write-Host ""
Write-Host "Yeu cau:"
Write-Host "  - Tai khoan Cloudflare (mien phi)"
Write-Host "  - Domain da tro ve Cloudflare (vd: tenban.com)"
Write-Host ""

$domain = Read-Host "Nhap domain cua ban (vd: tenban.com)"
$subdomain = Read-Host "Nhap subdomain (mac dinh: app)" 
if (-not $subdomain) { $subdomain = "app" }
$hostname = "$subdomain.$domain"

Write-Host ""
Write-Host "Domain se la: https://$hostname"
Write-Host ""

# Buoc 1: Login Cloudflare (mo trinh duyet)
$credDir = Join-Path $env:USERPROFILE ".cloudflared"
if (-not (Test-Path (Join-Path $credDir "cert.pem"))) {
    Write-Host "[1/4] Dang nhap Cloudflare — trinh duyet se mo..."
    cloudflared tunnel login
    Write-Host ""
}

# Buoc 2: Tao tunnel (neu chua co)
Write-Host "[2/4] Tao tunnel '$TunnelName'..."
$tunnelList = cloudflared tunnel list 2>&1 | Out-String
if ($tunnelList -notmatch $TunnelName) {
    cloudflared tunnel create $TunnelName
} else {
    Write-Host "  Tunnel '$TunnelName' da ton tai, bo qua tao moi."
}

# Lay Tunnel ID
$tunnelInfo = cloudflared tunnel list 2>&1 | Out-String
$tunnelId = $null
foreach ($line in ($tunnelInfo -split "`n")) {
    if ($line -match $TunnelName) {
        $parts = $line -split "\s+" | Where-Object { $_ }
        if ($parts.Count -ge 1) { $tunnelId = $parts[0] }
        break
    }
}
if (-not $tunnelId) {
    Write-Host "[LOI] Khong lay duoc Tunnel ID. Chay: cloudflared tunnel list"
    exit 1
}
Write-Host "  Tunnel ID: $tunnelId"

# Buoc 3: Route DNS
Write-Host "[3/4] Gan DNS $hostname -> tunnel..."
cloudflared tunnel route dns $TunnelName $hostname 2>&1 | ForEach-Object { Write-Host "  $_" }

# Buoc 4: Tao config.yml
Write-Host "[4/4] Tao cloudflared\config.yml..."
$credentialsFile = Join-Path $credDir "$tunnelId.json"
if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir | Out-Null }

$configContent = @"
# Named Tunnel — domain co dinh
# Tao boi: scripts/setup-named-tunnel.ps1

tunnel: $tunnelId
credentials-file: $credentialsFile

ingress:
  - hostname: $hostname
    service: http://localhost:$FrontendPort
  - service: http_status:404
"@

Set-Content -Path $ConfigPath -Value $configContent -Encoding UTF8

Write-Host ""
Write-Host "========================================"
Write-Host "  HOAN TAT!"
Write-Host "========================================"
Write-Host ""
Write-Host "  Domain co dinh: https://$hostname"
Write-Host "  Config file:    cloudflared\config.yml"
Write-Host ""
Write-Host "Khoi dong tunnel:"
Write-Host "  .\scripts\start-cloudflare-tunnel.ps1"
Write-Host "  (chon 2 — Named Tunnel)"
Write-Host ""
Write-Host "Hoac chay truc tiep:"
Write-Host "  cloudflared tunnel --config cloudflared\config.yml run"
Write-Host ""
