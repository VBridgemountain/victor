# V.I.C.T.O.R. datorbrygga

Ett litet hjälpprogram för Windows som låter V.I.C.T.O.R. i webbläsaren:

- visa datorns installerade program (samma lista som Start-menyn) och lägga dem i globerna
- starta dem med ett klick
- visa vilka fönster som är öppna (widgeten **Öppna program**) och lyfta fram dem

En webbsida får inte göra det själv, därför behövs bryggan. Den behövs bara på datorn, inte på telefonen.

## Kom igång

1. Installera [Node.js](https://nodejs.org).
2. Hämta den här mappen och dubbelklicka på `starta-brygga.cmd`.
3. Öppna http://127.0.0.1:8770 på datorn och kopiera kopplingskoden.
4. I V.I.C.T.O.R.: Inställningar → Datorbrygga → klistra in koden.

Starta automatiskt vid inloggning: `node helper.js --autostart` (tas bort med `--no-autostart`).

## Säkerhet

- Bryggan svarar bara den egna datorn (127.0.0.1), aldrig nätverket.
- Från en webbläsare släpps bara V.I.C.T.O.R.s egna adresser in, och alla anrop kräver kopplingskoden.
- Den kan starta program som finns i Start-menyn och lyfta fram öppna fönster. Den kör inga fria kommandon.
- Kod och ikoner sparas i `%LOCALAPPDATA%\victor-brygga`.
