@echo off
rem Startar V.I.C.T.O.R. Server. Första gången hämtas Node.js (om det saknas) och en genväg läggs på skrivbordet och i Start-menyn.
chcp 65001 >nul
title V.I.C.T.O.R. Server
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0forbered.ps1"
if errorlevel 1 ( echo. & echo Något gick fel, se meddelandet ovan. & pause & exit /b 1 )
set "NODE=%~dp0runtime\node.exe"
if not exist "%NODE%" set "NODE=node"
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8787"
"%NODE%" "%~dp0server.js"
if errorlevel 1 pause
