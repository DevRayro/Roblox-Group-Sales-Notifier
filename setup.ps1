# setup.ps1 — One-shot installer for Windows.
# Detects/installs Node.js >= 18, then launches the interactive setup wizard.
#
# Usage (in PowerShell):
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup.ps1

$ErrorActionPreference = 'Stop'
$RequiredNodeMajor = 18

# ─── pretty output ──────────────────────────────────────────────────────
function Write-OK   ([string]$msg) { Write-Host "✔ $msg" -ForegroundColor Green }
function Write-Info ([string]$msg) { Write-Host "› $msg" -ForegroundColor Cyan }
function Write-Warn2([string]$msg) { Write-Host "! $msg" -ForegroundColor Yellow }
function Write-Fail ([string]$msg) { Write-Host "✘ $msg" -ForegroundColor Red }
function Write-Head ([string]$msg) { Write-Host ""; Write-Host $msg -ForegroundColor Magenta }

function Banner {
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║  Roblox Group Sales Notifier  •  Bootstrap         ║" -ForegroundColor Cyan
    Write-Host "  ╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Confirm-Yes ([string]$prompt, [bool]$defaultYes = $true) {
    $hint = if ($defaultYes) { 'Y/n' } else { 'y/N' }
    $ans = Read-Host "$prompt ($hint)"
    if ([string]::IsNullOrWhiteSpace($ans)) { return $defaultYes }
    return ($ans -match '^(y|yes)$')
}

function Get-NodeMajor {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { return 0 }
    try {
        $v = (& node -v) -replace '^v',''
        return [int]($v.Split('.')[0])
    } catch { return 0 }
}

function Refresh-Path {
    # Some installers update the registry but not the current session.
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path','User')
}

function Install-NodeViaWinget {
    Write-Info "Installing Node.js via winget…"
    winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    Refresh-Path
}

function Install-NodeViaChoco {
    Write-Info "Installing Node.js via Chocolatey…"
    choco install nodejs-lts -y
    Refresh-Path
}

function Install-NodeViaDirectDownload {
    Write-Info "Downloading the official Node.js LTS MSI installer…"
    $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
    $url  = "https://nodejs.org/dist/latest-v20.x/node-v20.18.0-$arch.msi"
    $tmp  = Join-Path $env:TEMP "nodejs-lts.msi"
    Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
    Write-Info "Running the installer (an admin prompt may appear)…"
    Start-Process msiexec.exe -ArgumentList "/i `"$tmp`" /qn /norestart" -Wait
    Remove-Item $tmp -ErrorAction SilentlyContinue
    Refresh-Path
}

function Ensure-Node {
    $current = Get-NodeMajor
    if ($current -ge $RequiredNodeMajor) {
        Write-OK "Node.js $((& node -v)) — meets requirement (>=$RequiredNodeMajor)."
        return $true
    }
    if ($current -gt 0) {
        Write-Warn2 "Node.js v$current is installed, but we need >=$RequiredNodeMajor. Will upgrade."
    } else {
        Write-Warn2 "Node.js is not installed. Will install it now."
    }

    $methods = @()
    if (Get-Command winget -ErrorAction SilentlyContinue) { $methods += 'winget' }
    if (Get-Command choco  -ErrorAction SilentlyContinue) { $methods += 'choco' }
    $methods += 'direct'

    foreach ($m in $methods) {
        try {
            switch ($m) {
                'winget' { Install-NodeViaWinget }
                'choco'  { Install-NodeViaChoco }
                'direct' { Install-NodeViaDirectDownload }
            }
            $current = Get-NodeMajor
            if ($current -ge $RequiredNodeMajor) {
                Write-OK "Node.js $((& node -v)) installed."
                return $true
            }
        } catch {
            Write-Warn2 "Install via $m failed: $($_.Exception.Message)"
        }
    }
    return $false
}

# ─── main ───────────────────────────────────────────────────────────────
Banner
Write-Head "1) Checking Node.js"

if (-not (Ensure-Node)) {
    Write-Fail "Failed to install Node.js automatically."
    Write-Fail "Please install Node 18+ manually from https://nodejs.org/ and re-run this script."
    exit 1
}

Write-Head "2) Launching the interactive setup wizard"
node scripts/setup.js
exit $LASTEXITCODE
