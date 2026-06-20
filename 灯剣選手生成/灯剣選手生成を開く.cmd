@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PLAYER_PORT="
set "PY_CMD="

where python >nul 2>nul
if not errorlevel 1 set "PY_CMD=python"

if not defined PY_CMD (
  where py >nul 2>nul
  if not errorlevel 1 set "PY_CMD=py -3"
)

if not defined PY_CMD (
  echo Python was not found.
  echo Install Python 3 and run this file again.
  pause
  exit /b 1
)

for /f %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports=4173,5173,8000,8080,3219,8765,49152,50080; foreach($p in $ports){ try { $listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,[int]$p); $listener.Start(); $listener.Stop(); Write-Output $p; exit 0 } catch {} }; exit 1"') do set "PLAYER_PORT=%%P"

if not defined PLAYER_PORT (
  echo No available local port was found.
  echo Close old local server windows or restart Windows, then run this file again.
  pause
  exit /b 1
)

echo Starting Touken Player Generator...
echo URL: http://127.0.0.1:%PLAYER_PORT%/
echo.

start "Touken Player Generator Server" /D "%~dp0" cmd /k "%PY_CMD% -m http.server %PLAYER_PORT% --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
rundll32 url.dll,FileProtocolHandler "http://127.0.0.1:%PLAYER_PORT%/"
