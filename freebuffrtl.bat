@echo off
REM Freebuff RTL Injector — one-click "patch + launch"
REM
REM Freebuff checks for updates and can silently replace app.asar every
REM time it starts, which wipes the RTL hook. Use THIS file instead of
REM opening Freebuff directly from its own shortcut: it re-patches first
REM (instant no-op if nothing changed) and then opens Freebuff for you.
REM
REM Tip: replace your Desktop/Taskbar Freebuff shortcut's target with this
REM .bat file so you never have to think about it again.

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

node scripts\patch-asar.mjs --launch

