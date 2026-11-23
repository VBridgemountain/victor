# Bygger V.I.C.T.O.R. VR (appen för Oculus Go och andra headset) till en APK utan Gradle.
# Kräver Android Studio (för Java) och Android SDK med build-tools och en plattform.
# Kör:  powershell -ExecutionPolicy Bypass -File desktop\android-vr\build.ps1
# Resultat: desktop\victor-vr.apk (går att ladda ner från webben). Installera: adb install -r desktop\victor-vr.apk

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
function Run($exe) { & $exe @args; if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($exe)) misslyckades (kod $LASTEXITCODE)" } }

$ver = [regex]::Match((Get-Content "$web\index.html" -Raw -Encoding UTF8), "const APP_VERSION = '(\d+)\.(\d+)\.(\d+)'")
$verName = "$($ver.Groups[1].Value).$($ver.Groups[2].Value).$($ver.Groups[3].Value)"
$verCode = [int]$ver.Groups[1].Value * 10000 + [int]$ver.Groups[2].Value * 100 + [int]$ver.Groups[3].Value

$out = "$here\build"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force "$out\classes", "$out\dex", "$here\res\mipmap-xxhdpi" | Out-Null
Copy-Item "$web\icon-192.png" "$here\res\mipmap-xxhdpi\ic_launcher.png" -Force

Run "$bt\aapt2.exe" compile --dir "$here\res" -o "$out\res.zip"
# Oculus Go kör Android 7.1 (API 25)
Run "$bt\aapt2.exe" link -o "$out\unsigned.apk" -I $jar --manifest "$here\AndroidManifest.xml" `
    --min-sdk-version 25 --target-sdk-version 25 --version-code $verCode --version-name $verName "$out\res.zip"
$src = @((Get-ChildItem "$here\src" -Recurse -Filter *.java).FullName)
Run "$jbr\bin\javac.exe" -source 8 -target 8 -nowarn -cp $jar -d "$out\classes" @src
$classes = @((Get-ChildItem "$out\classes" -Recurse -Filter *.class).FullName)
Run "$bt\d8.bat" --lib $jar --min-api 25 --output "$out\dex" @classes
Push-Location "$out\dex"
try { Run "$bt\aapt.exe" add "$out\unsigned.apk" classes.dex | Out-Null } finally { Pop-Location }
Run "$bt\zipalign.exe" -f -p 4 "$out\unsigned.apk" "$out\aligned.apk"
$ks = "$env:USERPROFILE\.android\debug.keystore"
# v1-signering behövs för Android 7
Run "$bt\apksigner.bat" sign --ks $ks --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey `
    --v1-signing-enabled true --v2-signing-enabled true --out "$out\victor-vr.apk" "$out\aligned.apk"
Run "$bt\apksigner.bat" verify "$out\victor-vr.apk"
Copy-Item "$out\victor-vr.apk" "$web\victor-vr.apk" -Force
"Klar: $web\victor-vr.apk ($([math]::Round((Get-Item "$web\victor-vr.apk").Length / 1KB)) kB)"
