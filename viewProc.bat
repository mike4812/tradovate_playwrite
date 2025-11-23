@echo off
echo ========================================
echo   Tradovate Server Status
echo ========================================
echo.

echo Checking if server is running...
netstat -ano | findstr :3000

echo.
echo Checking Node.js processes...
tasklist | findstr node.exe

echo.
echo Checking Chrome processes...
tasklist | findstr chrome.exe

echo.
pause