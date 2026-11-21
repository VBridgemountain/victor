# V.I.C.T.O.R. datorbrygga

Ett litet hjälpprogram för Windows som låter V.I.C.T.O.R. i webbläsaren:

- visa datorns installerade program (samma lista som Start-menyn) och lägga dem i globerna
- starta dem med ett klick
- visa vilka fönster som är öppna (widgeten **Öppna program**) och lyfta fram dem

En webbsida får inte göra det själv, därför behövs bryggan. Den behövs bara på datorn, inte på telefonen.

## Kom igång

1. Ladda ner [victor-brygga.zip](https://vbridgemountain.github.io/victor/desktop/helper/victor-brygga.zip) (33 MB) och packa upp den.
2. Dubbelklicka på `victor-brygga.exe`. Varnar Windows (SmartScreen, programmet är inte signerat): välj **Mer information → Kör ändå**.
3. Öppna http://127.0.0.1:8770, kopiera kopplingskoden och bocka gärna i **Starta automatiskt när jag loggar in i Windows**.
4. I V.I.C.T.O.R.: Inställningar → Datorbrygga → klistra in koden.

Ingen annan programvara behövs.

### Med Node.js i stället

Har du [Node.js](https://nodejs.org) kan du köra skriptet direkt: dubbelklicka på `starta-brygga.cmd` (eller `node helper.js`).
Autostart: `node helper.js --autostart`, ta bort med `--no-autostart`.

### Bygga programmet

`powershell -ExecutionPolicy Bypass -File build-exe.ps1` bygger `victor-brygga.zip` från `helper.js` med Nodes "single executable application".
Kräver Node.js och hämtar verktyget postject från npm.

## Säkerhet

- Bryggan svarar bara den egna datorn (127.0.0.1), aldrig nätverket.
- Från en webbläsare släpps bara V.I.C.T.O.R.s egna adresser in, och alla anrop kräver kopplingskoden.
- Den kan starta program som finns i Start-menyn och lyfta fram öppna fönster. Den kör inga fria kommandon.
- Kod och ikoner sparas i `%LOCALAPPDATA%\victor-brygga`.
