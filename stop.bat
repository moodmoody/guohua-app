@echo off
setlocal
cd /d "%~dp0"

set "PORT=3000"
if not "%~1"=="" (
  set "PORT=%~1"
)

if "%PORT%"=="" (
  echo [ERROR] Invalid port.
  exit /b 1
)

set "PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  set "PID=%%a"
  goto :kill
)

echo No process is listening on port %PORT%.
exit /b 0

:kill
echo Stopping process on port %PORT% ^(PID %PID%^)^...
taskkill /PID %PID% /F >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Failed to stop PID %PID%. Try running as Administrator.
  exit /b 1
)

echo Service stopped on port %PORT%.
exit /b 0
