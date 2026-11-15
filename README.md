# V.I.C.T.O.R. by NoirLab

*Visionary Interface for Creative Thinking, Organisation & Research*

Det här repot innehåller två olika program som delar utseende men inte kod.

| | V.I.C.T.O.R. (skrivbord och telefon) | V.I.C.T.O.R. Server |
|---|---|---|
| Vad det är | Startskärm med partikelglober, appar, widgets, påminnelser och brainstorm | Kontrollpanel för en dedikerad serverdator |
| Var det körs | I webbläsaren, som installerad webbapp eller som Android-startskärm | På serverdatorn (Node.js), styrs från webbläsaren |
| Var koden ligger | Repots rot och `android/` | `server/` |
| Kom igång | Öppna länken nedan | Se [server/README.md](server/README.md) |

## V.I.C.T.O.R. — skrivbord och telefon

- **Webb:** https://vbridgemountain.github.io/victor/ (går att installera som app från Chrome eller Edge)
- **Android:** [victor.apk](https://vbridgemountain.github.io/victor/victor.apk) (startskärm som läser in telefonens appar)

Filer:

- `index.html` — hela appen, utan byggsteg
- `manifest.webmanifest`, `sw.js`, `icon*` — gör att den går att installera och starta utan nät
- `android/` — Android-skalet runt samma `index.html`; byggs med `android/build.ps1`
- `victor.apk` — den byggda Android-appen

All data sparas i enheten (webbläsarens lagring). Inget konto och ingen server behövs.

## V.I.C.T.O.R. Server

Ligger i [`server/`](server/) och är ett eget program. Det hör inte ihop med skrivbordsappen och behöver inte den.

- **Panel:** system, nätverk, lyssnande portar, spelservrar via SteamCMD och anslutna spelare
- **Labb:** kodprojekt med redigerare och terminal, kretsbyggare med kopplingskontroll, anslutningar
- **Spelhall:** egna spel i webbläsaren via emulator
- **Säkerhet:** lösenord, tvåstegsinloggning och stöd för åtkomst via nätet

Installation och användning står i [server/README.md](server/README.md).
