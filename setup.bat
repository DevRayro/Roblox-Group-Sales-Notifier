@echo off
REM ============================================================
REM   Roblox Group Sales Notifier - Windows one-click installer.
REM   Just double-click this file. No PowerShell knowledge needed.
REM ============================================================

setlocal EnableDelayedExpansion
title Roblox Group Sales Notifier - Setup
cd /d "%~dp0"

echo.
echo   ============================================================
echo     Roblox Group Sales Notifier - Setup
echo   ============================================================
echo.

REM ---- 1. Check Node.js -----------------------------------------------------
set "NODE_OK="
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VERSION=%%v"
    REM strip leading "v" then take the major
    set "NODE_MAJOR=!NODE_VERSION:~1!"
    for /f "tokens=1 delims=." %%m in ("!NODE_MAJOR!") do set "NODE_MAJOR=%%m"
    if !NODE_MAJOR! GEQ 18 (
        set "NODE_OK=1"
        echo  [ OK ] Node.js !NODE_VERSION! detected.
    ) else (
        echo  [ !! ] Node.js !NODE_VERSION! is too old, need 18 or newer.
    )
) else (
    echo  [ !! ] Node.js is not installed.
)

if not defined NODE_OK (
    echo.
    echo  Trying to install Node.js LTS automatically...
    echo.

    REM ---- Try winget ------------------------------------------------------
    where winget >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo  - Using winget...
        winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
        goto :postInstall
    )

    REM ---- Try Chocolatey --------------------------------------------------
    where choco >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo  - Using Chocolatey...
        choco install nodejs-lts -y
        goto :postInstall
    )

    REM ---- Fallback: download the official MSI -----------------------------
    echo  - Downloading the official Node.js LTS installer from nodejs.org...
    set "MSI_URL=https://nodejs.org/dist/latest-v20.x/node-v20.18.0-x64.msi"
    set "MSI_PATH=%TEMP%\nodejs-lts.msi"
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "try { Invoke-WebRequest -Uri '!MSI_URL!' -OutFile '!MSI_PATH!' -UseBasicParsing } catch { exit 1 }"
    if not exist "!MSI_PATH!" (
        echo.
        echo  [ ERROR ] Could not download Node.js automatically.
        echo  Please install it manually from https://nodejs.org/ and run this file again.
        echo.
        pause
        exit /b 1
    )
    echo  - Running the installer ^(an admin prompt may appear^)...
    msiexec /i "!MSI_PATH!" /qn /norestart
    del "!MSI_PATH!" >nul 2>nul

    :postInstall
    REM Refresh PATH for this session so we can find node.exe right away.
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul ^| find "REG_"') do set "SYS_PATH=%%b"
    for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul ^| find "REG_"') do set "USR_PATH=%%b"
    set "PATH=!SYS_PATH!;!USR_PATH!"

    where node >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo  [ ERROR ] Node.js install seems to have failed.
        echo  Please install Node 18+ manually from https://nodejs.org/ and run this file again.
        echo.
        pause
        exit /b 1
    )
    for /f "tokens=*" %%v in ('node -v') do set "NODE_VERSION=%%v"
    echo  [ OK ] Node.js !NODE_VERSION! installed.
)

REM ---- 2. Hand off to the cross-platform wizard -----------------------------
echo.
echo  Launching the setup wizard...
echo.
node scripts\setup.js
set "EXITCODE=!ERRORLEVEL!"

echo.
if !EXITCODE! EQU 0 (
    echo  Setup finished. You can close this window.
) else (
    echo  Setup exited with code !EXITCODE!.
)
echo.
pause
exit /b !EXITCODE!
