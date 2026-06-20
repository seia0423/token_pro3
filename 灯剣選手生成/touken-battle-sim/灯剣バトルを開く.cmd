@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js 20 or later from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

echo Starting Touken Battle Simulator with World mode.
echo Includes: world simulation, match details, season summary, date skip.
echo Start URL: http://127.0.0.1:3217/
echo If 3217 is already in use, the app will open the next available port.
echo.
node src\web-server.js --port 3217 --open
pause
