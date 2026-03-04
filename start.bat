@echo off
title RPG Engine
color 0A
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║          RPG Engine  -  Launcher         ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Please install Node.js 20+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check Node version
for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
for /f "tokens=2 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
echo  [OK] Node.js found: 
node -v

:: Check for pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [..] pnpm not found, installing via corepack...
    corepack enable
    corepack prepare pnpm@latest --activate
)
echo  [OK] pnpm found

:: Install dependencies if needed
if not exist "node_modules" (
    echo.
    echo  [..] Installing dependencies (first run)...
    echo      This may take a few minutes.
    echo.
    call pnpm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Build if needed
if not exist "packages\shared\dist" (
    echo  [..] Building shared types...
    call pnpm build:shared
)
if not exist "packages\server\dist" (
    echo  [..] Building server...
    call pnpm build:server
)
if not exist "packages\client\dist" (
    echo  [..] Building client...
    call pnpm build:client
)

:: Push database schema
echo  [..] Syncing database schema...
call pnpm db:push 2>nul

:: Start the server
echo.
echo  ══════════════════════════════════════════
echo    Starting RPG Engine on http://localhost:7860
echo    Press Ctrl+C to stop
echo  ══════════════════════════════════════════
echo.

:: Set production env
set NODE_ENV=production
set PORT=7860
set HOST=0.0.0.0

:: Open browser after a short delay
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:7860"

:: Start server
cd packages\server
node dist/index.js
