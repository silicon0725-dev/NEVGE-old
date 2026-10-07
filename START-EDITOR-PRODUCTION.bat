@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Next Generation Visual Game Engine - Production Performance Server

echo.
echo ============================================================
echo   Next Generation Visual Game Engine
echo   NES Studio Production Performance Launcher
echo ============================================================
echo.

set "BUN_EXE="
for /f "delims=" %%I in ('where bun 2^>nul') do (
    if not defined BUN_EXE set "BUN_EXE=%%I"
)

if not defined BUN_EXE (
    if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set "BUN_EXE=%USERPROFILE%\.bun\bin\bun.exe"
    )
)

if not defined BUN_EXE (
    echo [ERROR] Bun was not found.
    echo.
    echo Install Bun first, then double-click this file again.
    echo After installing Bun, close and reopen this window so PATH is refreshed.
    echo.
    pause
    exit /b 1
)

echo [OK] Bun:
echo      %BUN_EXE%
echo.

set "NEED_INSTALL=0"
if not exist "node_modules\" set "NEED_INSTALL=1"
if not exist "node_modules\webpack\bin\webpack.js" set "NEED_INSTALL=1"
if not exist "node_modules\@dimforge\rapier2d-compat\package.json" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
    echo [SETUP] Dependencies are missing or incomplete.
    echo [SETUP] Running: bun install
    echo.
    "%BUN_EXE%" install
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed.
        echo Check the network output above, then run START-EDITOR-PRODUCTION.bat again.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed.
    echo.
) else (
    echo [OK] Dependencies already installed.
    echo.
)

if not exist "scripts\build-production.js" (
    echo [ERROR] scripts\build-production.js was not found.
    echo Put this launcher in the NGVGE project root, next to package.json.
    echo.
    pause
    exit /b 1
)

if not exist "scripts\serve-production.mjs" (
    echo [ERROR] scripts\serve-production.mjs was not found.
    echo Copy the bundled scripts folder into the NGVGE project root.
    echo.
    pause
    exit /b 1
)

set "NODE_ENV=production"

echo [BUILD] Production bundle:
echo         bun run build
echo.
"%BUN_EXE%" run build
set "BUILD_EXIT=%ERRORLEVEL%"

if not "%BUILD_EXIT%"=="0" (
    echo.
    echo [ERROR] Production build failed with code %BUILD_EXIT%.
    echo Review the first webpack error above.
    echo.
    pause
    exit /b %BUILD_EXIT%
)

if not exist "build\index.html" (
    echo.
    echo [ERROR] Production build completed, but build\index.html was not found.
    echo.
    pause
    exit /b 1
)

if not defined PORT set "PORT=8602"
set "EDITOR_URL=http://127.0.0.1:%PORT%/"

echo.
echo [OK] Production build completed.
echo.
echo [START] Static production server:
echo         %EDITOR_URL%
echo.
echo This does NOT use webpack-dev-server.
echo NODE_ENV=production is active.
echo Press Ctrl+C in this window to stop the server.
echo.

start "" powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process '%EDITOR_URL%'"

"%BUN_EXE%" run scripts/serve-production.mjs
set "SERVER_EXIT=%ERRORLEVEL%"

echo.
if "%SERVER_EXIT%"=="0" (
    echo [STOPPED] Production server stopped.
) else (
    echo [ERROR] Production server exited with code %SERVER_EXIT%.
    echo Review the output above for the first error.
    pause
)

exit /b %SERVER_EXIT%
