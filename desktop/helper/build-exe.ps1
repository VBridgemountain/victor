# Bygger datorbryggan till ett färdigt Windows-program (victor-brygga.exe) med Nodes "single executable application".
# Kör:  powershell -ExecutionPolicy Bypass -File build-exe.ps1     Resultat: victor-brygga.zip bredvid skriptet
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$out  = Join-Path $here 'dist'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory $out | Out-Null
Copy-Item (Join-Path $here 'helper.js') $out
@{ main = 'helper.js'; output = 'sea-prep.blob'; disableExperimentalSEAWarning = $true } | ConvertTo-Json | Set-Content (Join-Path $out 'sea-config.json') -Encoding ascii
Push-Location $out
try {
  node --experimental-sea-config sea-config.json
  if ($LASTEXITCODE) { throw 'Kunde inte skapa programdelen.' }
  Copy-Item (Get-Command node).Source 'victor-brygga.exe'
  npx --yes postject@1.0.0-alpha.6 victor-brygga.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
  if ($LASTEXITCODE) { throw 'Kunde inte bygga in programdelen.' }
  Compress-Archive -Path 'victor-brygga.exe' -DestinationPath (Join-Path $here 'victor-brygga.zip') -Force
} finally { Pop-Location }
$z = Get-Item (Join-Path $here 'victor-brygga.zip')
"Klar: $($z.FullName) ($([math]::Round($z.Length / 1MB, 1)) MB)"
