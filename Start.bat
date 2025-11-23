@echo off
echo ========================================
echo   Tradovate Multi-Account Control
echo   Starting Server...
echo ========================================
echo.

REM Kill any existing Node.js processes
echo Stopping existing processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM chrome.exe 2>nul

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start the server
echo.
echo Starting server on port 3000...
echo.
node server.js

pause