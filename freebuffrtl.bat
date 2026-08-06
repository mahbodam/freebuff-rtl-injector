@echo off
REM Freebuff RTL Injector — double-click patcher
REM Just place this .bat file inside the freebuff-rtl-injector folder
REM (next to package.json / scripts\) and double-click it any time after
REM Freebuff updates. It re-patches app.asar and refreshes the mod files.

setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH.
    echo Install it from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

if not exist "scripts\patch-asar.mjs" (
    echo [ERROR] scripts\patch-asar.mjs not found.
    echo Make sure this .bat file sits inside the freebuff-rtl-injector folder,
    echo next to the "scripts" subfolder.
    echo.
    pause
    exit /b 1
)

echo Patching Freebuff for RTL support...
echo.
node scripts\patch-asar.mjs

echo.
echo Done. Close this window and (re)start Freebuff.
pause
