@echo off
echo ========================================
echo   Server Restarting...
echo ========================================
echo.

REM Wait for old process to fully exit
timeout /t 3 /nobreak >nul

REM Kill any remaining processes
taskkill /F /IM node.exe 2>nul
taskkill /F /IM chrome.exe 2>nul

timeout /t 2 /nobreak >nul

REM Start server again
echo Starting server...
echo.
cd /d "%~dp0"
npm start
