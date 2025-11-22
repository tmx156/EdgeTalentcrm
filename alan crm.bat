@echo off
title Alan CRM - Server & Client Launcher
echo ========================================
echo   Alan CRM - Starting Server & Client
echo ========================================
echo.

REM Get the directory where the batch file is located
cd /d "%~dp0"

echo Starting Backend Server on port 5000...
start "Alan CRM - Server" cmd /k "cd /d %~dp0 && cd server && npm start"

timeout /t 3 /nobreak >nul

echo Starting Frontend Client on port 3000...
start "Alan CRM - Client" cmd /k "cd /d %~dp0\client && npm start"

echo.
echo ========================================
echo   Both servers are starting...
echo   Server: http://localhost:5000
echo   Client: http://localhost:3000
echo ========================================
echo.
echo Press any key to exit this window (servers will keep running)...
pause >nul

