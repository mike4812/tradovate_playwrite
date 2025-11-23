@echo off
echo ========================================
echo   Stopping Tradovate Server...
echo ========================================
echo.

REM Kill Node.js processes
echo Stopping Node.js...
taskkill /F /IM node.exe

REM Kill Chrome processes
echo Stopping Chrome browsers...
taskkill /F /IM chrome.exe

echo.
echo ✅ All processes stopped!
echo.
pause