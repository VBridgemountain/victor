# Bygger V.I.C.T.O.R.-launchern till en installerbar APK utan Gradle.
# Kräver Android Studio (för Java) och Android SDK med build-tools och en plattform.
# Kör:  powershell -ExecutionPolicy Bypass -File android\build.ps1
# Resultat: android\build\victor.apk

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$web  = Split-Path $here -Parent
$sdk  = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$jbr  = @("$env:ProgramFiles\Android\Android Studio\jbr", "$env:LOCALAPPDATA\Programs\Android Studio\jbr") |
        Where-Object { Test-Path "$_\bin\javac.exe" } | Select-Object -First 1
if (-not $jbr) { throw 'Hittar inte Java (Android Studio jbr).' }
$bt   = (Get-ChildItem "$sdk\build-tools" | Sort-Object { [version]($_.Name -replace '[^0-9.]', '') } | Select-Object -Last 1).FullName
$plat = (Get-ChildItem "$sdk\platforms"   | Sort-Object { [int]($_.Name -replace '\D', '') }        | Select-Object -Last 1).FullName
$jar  = "$plat\android.jar"
$env:JAVA_HOME = $jbr
$env:Path = "$jbr\bin;$env:Path"

function Run($exe) {   # kör ett verktyg och avbryt om det misslyckas
    & $exe @args
    if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($exe)) misslyckades (kod $LASTEXITCODE)" }
}

$out = "$here\build"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force "$out\assets", "$out\classes", "$out\dex" | Out-Null

# 1. Webbgränssnittet följer med i appen (samma filer som på webben)
Copy-Item "$web\index.html", "$web\icon.svg", "$web\icon-192.png", "$web\icon-512.png", "$web\icon-180.png", "$web\manifest.webmanifest" "$out\assets"   # platt mapp: aapt2 på Windows skriver undermappar med bakstreck
New-Item -ItemType Directory -Force "$here\res\mipmap-xxhdpi" | Out-Null
Copy-Item "$web\icon-192.png" "$here\res\mipmap-xxhdpi\ic_launcher.png" -Force

# 2. Resurser + manifest
Run "$bt\aapt2.exe" compile --dir "$here\res" -o "$out\res.zip"
Run "$bt\aapt2.exe" link -o "$out\unsigned.apk" -I $jar --manifest "$here\AndroidManifest.xml" -A "$out\assets" `
    --min-sdk-version 26 --target-sdk-version 34 --version-code 1 --version-name 0.1 "$out\res.zip"

# 3. Java -> dex
$src = @((Get-ChildItem "$here\src" -Recurse -Filter *.java).FullName)
Run "$jbr\bin\javac.exe" -source 11 -target 11 -nowarn -cp $jar -d "$out\classes" @src
$classes = @((Get-ChildItem "$out\classes" -Recurse -Filter *.class).FullName)
Run "$bt\d8.bat" --lib $jar --min-api 26 --output "$out\dex" @classes

# 4. Lägg in koden, justera och signera (debug-nyckel: duger för egen installation, inte för Play Butik)
Push-Location "$out\dex"
try { Run "$bt\aapt.exe" add "$out\unsigned.apk" classes.dex | Out-Null } finally { Pop-Location }
Run "$bt\zipalign.exe" -f -p 4 "$out\unsigned.apk" "$out\aligned.apk"
$ks = "$env:USERPROFILE\.android\debug.keystore"
if (-not (Test-Path $ks)) {
    New-Item -ItemType Directory -Force (Split-Path $ks) | Out-Null
    Run "$jbr\bin\keytool.exe" -genkeypair -keystore $ks -storepass android -keypass android -alias androiddebugkey `
        -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=Android,C=US'
}
Run "$bt\apksigner.bat" sign --ks $ks --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey `
    --out "$out\victor.apk" "$out\aligned.apk"
Run "$bt\apksigner.bat" verify "$out\victor.apk"

$apk = Get-Item "$out\victor.apk"
"Klar: $($apk.FullName) ($([math]::Round($apk.Length / 1KB)) kB)"
