# Bygger nedladdningspaketen för V.I.C.T.O.R. Server och version.json (som uppdateringsknappen i panelen läser).
#   powershell -ExecutionPolicy Bypass -File server\pack.ps1
# Vad som är nytt skrivs i server\nytt.txt (visas i panelen när man uppdaterar).
# Versionen läses från VERSION i server.js. Resultatet committas och publiceras med GitHub Pages:
#   server/download/victor-server.zip     (Windows)
#   server/download/victor-server.tar.gz  (Linux)
#   server/version.json
param([string]$Notes = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$src = Get-Content (Join-Path $here 'server.js') -Raw -Encoding UTF8
if ($src -notmatch "const VERSION = '([\d.]+)'") { throw 'Hittar inte VERSION i server.js.' }
$version = $Matches[1]
$nf = Join-Path $here 'nytt.txt'
if (-not $Notes -and (Test-Path $nf)) { $Notes = ([IO.File]::ReadAllText($nf, [Text.Encoding]::UTF8)).Trim() }

$stage = Join-Path $env:TEMP 'victor-server-pack'
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
$dst = Join-Path $stage 'victor-server'
New-Item -ItemType Directory -Force $dst | Out-Null
$files = 'server.js', 'README.md', 'Starta V.I.C.T.O.R. Server.cmd', 'forbered.ps1', 'starta.sh',
         'autostart-windows.ps1', 'autostart-linux.sh', 'installera-autostart.cmd', 'ta-bort-autostart.cmd'
foreach ($f in $files) { Copy-Item (Join-Path $here $f) $dst }
foreach ($d in 'public', 'arcade') { Copy-Item -Recurse (Join-Path $here $d) $dst }

$out = Join-Path $here 'download'
New-Item -ItemType Directory -Force $out | Out-Null
$zip = Join-Path $out 'victor-server.zip'; $tgz = Join-Path $out 'victor-server.tar.gz'
Remove-Item $zip, $tgz -ErrorAction SilentlyContinue
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'
& $tar -a -c -f $zip -C $stage victor-server; if ($LASTEXITCODE) { throw 'Kunde inte packa zip.' }
& $tar -c -z -f $tgz -C $stage victor-server; if ($LASTEXITCODE) { throw 'Kunde inte packa tar.gz.' }
Remove-Item -Recurse -Force $stage

$info = [ordered]@{
  version = $version; notes = $Notes; date = (Get-Date -Format 'yyyy-MM-dd')
  zip = 'download/victor-server.zip'; zipSha256 = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
  tgz = 'download/victor-server.tar.gz'; tgzSha256 = (Get-FileHash $tgz -Algorithm SHA256).Hash.ToLower()
}
[IO.File]::WriteAllText((Join-Path $here 'version.json'), ($info | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
Write-Host "Paketen för version $version är klara i $out"
