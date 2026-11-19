@echo off
rem Tar bort autostarten för V.I.C.T.O.R. Server (frågar efter administratörsbehörighet).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0autostart-windows.ps1" -Remove
