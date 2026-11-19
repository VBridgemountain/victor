# Startar V.I.C.T.O.R. Server automatiskt när datorn startar, utan att någon behöver logga in.
# Programmet körs som en schemalagd uppgift (som SYSTEM) och startas om av Windows om det skulle stängas.
#
#   Slå på:   högerklicka på installera-autostart.cmd → Kör som administratör (eller kör den här filen som administratör)
#   Stäng av: ta-bort-autostart.cmd
param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$name = 'VICTOR Server'

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {   # be om administratörsbehörighet och kör om skriptet
  $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  if ($Remove) { $a += '-Remove' }
  Start-Process powershell -Verb RunAs -ArgumentList $a
  exit
}

if ($Remove) {
  if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    Write-Host 'Autostarten är borttagen. Starta servern för hand med node server.js när du vill.'
  } else { Write-Host 'Ingen autostart fanns.' }
  Read-Host 'Tryck Enter för att stänga'; exit
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Host 'Hittar inte Node.js. Installera det från nodejs.org och försök igen.'; Read-Host 'Tryck Enter för att stänga'; exit 1 }
$script = Join-Path $PSScriptRoot 'server.js'

$action    = New-ScheduledTaskAction -Execute $node -Argument "`"$script`" --service" -WorkingDirectory $PSScriptRoot
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
             -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
  -Description 'V.I.C.T.O.R. Server: kontrollpanel och spelservrar. Startar med datorn.' -Force | Out-Null

# Stäng ett V.I.C.T.O.R. Server-fönster som redan är öppet, annars är porten upptagen
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*server.js*' -and $_.CommandLine -notlike '*--service*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName $name

Write-Host ''
Write-Host 'Klart. V.I.C.T.O.R. Server startar nu automatiskt med datorn, även utan inloggning.'
Write-Host 'Den körs i bakgrunden utan fönster. Öppna http://localhost:8787 för panelen.'
Read-Host 'Tryck Enter för att stänga'
