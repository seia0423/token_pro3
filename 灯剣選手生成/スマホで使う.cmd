@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

cd /d "%~dp0"

set "PLAYER_PORT=4173"
set "SIM_PORT=3217"

set "LAN_IP="
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "CANDIDATE_IP=%%A"
  set "CANDIDATE_IP=!CANDIDATE_IP: =!"
  if "!CANDIDATE_IP:~0,8!"=="192.168." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,3!"=="10." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.16." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.17." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.18." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.19." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.20." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.21." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.22." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.23." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.24." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.25." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.26." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.27." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.28." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.29." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.30." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
  if "!CANDIDATE_IP:~0,7!"=="172.31." if not defined LAN_IP set "LAN_IP=!CANDIDATE_IP!"
)
if not defined LAN_IP set "LAN_IP=PC-IP-ADDRESS"

set "PY_CMD="
where python >nul 2>nul
if not errorlevel 1 set "PY_CMD=python"
if not defined PY_CMD (
  where py >nul 2>nul
  if not errorlevel 1 set "PY_CMD=py -3"
)

if not defined PY_CMD (
  echo Python was not found. Install Python, then run this file again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 or later, then run this file again.
  pause
  exit /b 1
)

start "Touken Player Generator" /D "%~dp0" cmd /k "%PY_CMD% -m http.server %PLAYER_PORT% --bind 0.0.0.0"
start "Touken Battle Simulator" /D "%~dp0touken-battle-sim" cmd /k "node src\web-server.js --host 0.0.0.0 --port %SIM_PORT%"

echo.
echo Open these URLs on your phone.
echo.
echo Player generator:
echo   http://%LAN_IP%:%PLAYER_PORT%/
echo.
echo Battle simulator:
echo   http://%LAN_IP%:%SIM_PORT%/
echo   World mode includes match details, season summary, and date skip.
echo.
echo Keep the two server windows open while using the phone.
echo Close those windows to stop the servers.
echo If port %SIM_PORT% is already in use, close the old simulator window first.
echo.
echo If Windows Firewall asks, allow Python and Node.js on private networks.
echo.

timeout /t 2 /nobreak >nul
rundll32 url.dll,FileProtocolHandler "http://127.0.0.1:%PLAYER_PORT%/"
rundll32 url.dll,FileProtocolHandler "http://127.0.0.1:%SIM_PORT%/"

pause
