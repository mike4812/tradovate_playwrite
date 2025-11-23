@echo off
echo ========================================
echo   Restarting Tradovate Server...
echo ========================================
echo.

REM Stop existing processes
call stop.bat

REM Wait a moment
timeout /t 3 /nobreak >nul

REM Start server again
call start.bat