# Körs av "Starta V.I.C.T.O.R. Server.cmd" före varje start:
#  1. Finns ingen Node.js (18 eller nyare) hämtas den senaste LTS-versionen från nodejs.org till mappen runtime (bara node.exe, kontrollerad mot SHA256SUMS).
#  2. Första gången läggs en genväg "V.I.C.T.O.R. Server" på skrivbordet och i Start-menyn.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$here = $PSScriptRoot
$runtime = Join-Path $here 'runtime'

function NodeOk($exe) {
  try { $v = & $exe --version 2>$null; return ($v -match '^v(\d+)\.' -and [int]$Matches[1] -ge 18) } catch { return $false }
}

if (-not (Test-Path (Join-Path $runtime 'node.exe'))) {
  $sys = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not ($sys -and (NodeOk $sys))) {
    Write-Host 'Node.js saknas. Hämtar den senaste LTS-versionen från nodejs.org (en gång) ...'
    $list = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $rel = $list | Where-Object { $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
    if (-not $rel) { throw 'Hittade ingen Node.js-version att hämta.' }
    $v = $rel.version; $name = "node-$v-win-x64"
    $tmp = Join-Path $env:TEMP "victor-node-$v"
    New-Item -ItemType Directory -Force $tmp | Out-Null
    $zip = Join-Path $tmp "$name.zip"
    Invoke-WebRequest "https://nodejs.org/dist/$v/$name.zip" -OutFile $zip -UseBasicParsing
    $sums = (Invoke-WebRequest "https://nodejs.org/dist/$v/SHASUMS256.txt" -UseBasicParsing).Content
    $want = ($sums -split "`n" | Where-Object { $_ -match " $name\.zip$" }) -replace '\s.*$', ''
    $got = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    if (-not $want -or $got -ne $want.Trim().ToLower()) { Remove-Item -Recurse -Force $tmp; throw 'Node.js-filen stämmer inte med sin kontrollsumma.' }
    Expand-Archive $zip -DestinationPath $tmp -Force
    New-Item -ItemType Directory -Force $runtime | Out-Null
    Copy-Item (Join-Path $tmp "$name\node.exe") $runtime -Force
    Remove-Item -Recurse -Force $tmp
    Write-Host "Node.js $v är hämtad till mappen runtime."
  }
}

$mark = Join-Path $here 'data\.genvag'
if (-not (Test-Path $mark)) {
  try {
    $sh = New-Object -ComObject WScript.Shell
    $target = Join-Path $here 'Starta V.I.C.T.O.R. Server.cmd'
    foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
      $l = $sh.CreateShortcut((Join-Path $dir 'V.I.C.T.O.R. Server.lnk'))
      $l.TargetPath = $target; $l.WorkingDirectory = $here; $l.Description = 'V.I.C.T.O.R. Server by NoirLab'
      $l.IconLocation = "$env:SystemRoot\System32\imageres.dll,1"; $l.Save()
    }
    Write-Host 'Genvägen "V.I.C.T.O.R. Server" finns nu på skrivbordet och i Start-menyn.'
  } catch { Write-Host 'Kunde inte skapa genvägen (inte farligt).' }
  New-Item -ItemType Directory -Force (Join-Path $here 'data') | Out-Null
  Set-Content $mark (Get-Date -Format s)
}
exit 0
