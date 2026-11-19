@echo off
rem Gör så att V.I.C.T.O.R. Server startar automatiskt med datorn (frågar efter administratörsbehörighet).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0autostart-windows.ps1"
