@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please install Node.js first.
  exit /b 1
)

if not exist node_modules (
  echo node_modules not found, running npm install...
  call npm install
  if errorlevel 1 exit /b 1
)

if not "%~1"=="" (
  set PORT=%~1
)

echo Starting server...
call npm start
