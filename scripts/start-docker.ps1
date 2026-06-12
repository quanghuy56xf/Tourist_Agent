# Khoi dong backend + frontend bang Docker Compose
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

Set-Location $ProjectRoot

Write-Host "Dang build va khoi dong Docker containers..."
Write-Host "(Lan dau build mat 10-15 phut do tai PyTorch)"
Write-Host ""

docker compose up -d --build

Write-Host ""
Write-Host "========================================"
Write-Host "  Docker da chay!"
Write-Host "========================================"
Write-Host "  Frontend : http://localhost:3000"
Write-Host "  Backend  : http://localhost:8000"
Write-Host "  API docs : http://localhost:8000/docs"
Write-Host ""
Write-Host "Buoc tiep: mo Cloudflare Tunnel de truy cap tu internet"
Write-Host "  .\scripts\start-cloudflare-tunnel.ps1"
Write-Host ""
Write-Host "Dung containers: docker compose down"
