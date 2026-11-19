# V.I.C.T.O.R. Server

Kontrollpanel för en dedikerad server, i samma stil som V.I.C.T.O.R. Programmet (agenten) körs på serverdatorn
och du styr den från webbläsaren på valfri dator eller telefon.

Visar processor, minne, disk, publik och lokal IP, hur mycket som skickas ut och tas emot, lyssnande portar,
samt spelservrar: installera och uppdatera via SteamCMD, starta, stoppa, se om de är online, vilka som är
anslutna och serverns utskrift.

## Kom igång (på serverdatorn)

1. Installera [Node.js](https://nodejs.org) 18.15 eller nyare.
2. Kopiera mappen `server` till serverdatorn (utan undermappen `data`, om den finns).
3. Starta agenten: `node server.js`
4. Öppna `http://localhost:8787` på serverdatorn och välj lösenord.
   På en server utan skärm: `node server.js --set-password <lösenord>` och starta sedan agenten.
5. Från andra enheter: öppna `http://<serverns-ip>:8787` (adressen skrivs ut när agenten startar).
6. Under Inställningar: hämta SteamCMD. Lägg sedan till spelservrar med + Spelserver.

Annan port eller adress: miljövariablerna `VICTOR_PORT` och `VICTOR_BIND`.

## Bra att veta

- Den som är inloggad kan starta program på servern. Panelen går över vanlig HTTP: använd den i hemnätet eller
  över VPN (t.ex. Tailscale eller WireGuard) och öppna inte port 8787 i routern mot internet.
- Portlistan visar vad maskinen lyssnar på. Om en port nås från internet avgörs av routern och brandväggen.
- "Stoppa" avslutar spelservern direkt. Spel som bara sparar vid en ordnad avstängning bör sparas i spelet först.
- På Windows delar spelservrarna konsol med agenten: stängs agentens fönster kan servrarna följa med.
  På Linux fortsätter de gå när agenten startas om.
- Mallarnas startkommandon är förslag. Byt servernamn och lösenord i kommandot innan du startar.
- Inställningar, loggar och hämtade spel ligger i `data/`.

## Labb (kod, krets, anslutningar)

Knappen Labb i panelen öppnar en testmiljö på `/lab.html`:

- **Kod:** projekt med filer, kodredigerare med färgläggning och en kommandoterminal. ▶ Kör (F5) kör Python, JavaScript,
  C och C++ med de verktyg som finns installerade på maskinen. Ctrl+S sparar. Projekten ligger i `data/projects`.
- **Krets:** lägg ut ett styrkort (Arduino Uno, ESP32, Raspberry Pi Pico) och delar, dra sladdar mellan stiften och få
  kopplingen kontrollerad: matning, jord, spänningsnivåer, PWM/analog/I2C-stift, ström och saknade motstånd.
  "Skapa kod" gör ett kodskelett med en konstant per inkopplat stift. Kretsen sparas som `krets.json` i projektet.
- **Anslutningar:** vilka språk som är installerade, inkopplade kort (serieportar) och test av om en adress och port svarar.

Terminalen är ett skal utan riktig tty: vanliga kommandon fungerar, men inte helskärmsprogram som vim.
Kretskontrollen följer kopplingsregler och är ingen elektrisk simulering.

## Spelhall (emulator i webbläsaren)

Knappen Spelhall öppnar `/arcade.html`. Lägg in dina egna spelfiler (via sidan eller direkt i `data/roms/<system>/`)
och spela dem i webbläsaren på dator eller telefon. Stöd: PlayStation (PS1), Nintendo 64, SNES, NES, Game Boy/Color/Advance,
Nintendo DS, Sega Mega Drive/Master System/Game Gear och Atari 2600. PS2 och nyare, Xbox och vanliga PC-spel går inte att
köra i en webbläsare.

- Emulatorn är [EmulatorJS](https://emulatorjs.org) och hämtas från deras nät när ett spel startas, så enheten behöver internet.
- Spelaren körs på en egen port (8788, ändras med `VICTOR_ARCADE_PORT`), skild från panelen, så att emulatorns kod inte kan
  nå panelens inloggning. Spelfilerna hämtas dit med en nyckel som gäller i 12 timmar.
- Sparningar lagras i webbläsaren du spelar i. En egen PlayStation-BIOS kan läggas som `data/roms/bios/psx.bin`.
- Lägg bara in spel du själv äger.

## Nå servern utifrån

Slå först på tvåstegsinloggning under Inställningar → Säkerhet och fjärråtkomst. Välj sedan en väg in:

- **Tailscale (enklast, säkrast):** installera Tailscale på servern och på telefon/dator. Panelen nås på serverns
  Tailscale-adress, port 8787, utan att något öppnas mot internet.
- **Cloudflare Tunnel (vanlig https-adress):** kräver en domän hos Cloudflare. Peka en adress mot `http://localhost:8787`
  och en andra mot `http://localhost:8788`, och ange den andra som "Spelhallens egen https-adress" i panelen.
- **Egen HTTPS i programmet:** lägg `cert.pem` och `key.pem` i `data/tls` och starta om. Då krävs portöppning i routern.

Fel lösenord fem gånger spärrar den besökaren i en minut, och väntan fördubblas för varje ny omgång. Inloggningar loggas i
`data/logs/access.log` och visas under Säkerhet och fjärråtkomst.

## Översyn från V.I.C.T.O.R. på dator och telefon

Widgeten **Server** i V.I.C.T.O.R. visar om allt är igång: processor, minne, disk, nätverk, IP-adresser, spelservrar och en
lista över det som behöver åtgärdas (full disk, spelserver som stannat oväntat, väntande uppdatering m.m.).

1. Skapa en läsnyckel i panelen under Inställningar → Säkerhet och fjärråtkomst.
2. Lägg till widgeten Server i V.I.C.T.O.R. och ange serverns adress och nyckeln.

Nyckeln kan bara läsa översikten (`/api/summary`) och inte styra något. Från den publicerade appen krävs serverns
https-adress. Ligger Cloudflare Access framför panelen behöver sökvägen `/api/summary` en egen Access-regel med Bypass,
annars stoppas widgeten av inloggningsspärren.

## Drift: autostart, strömavbrott, säkerhetskopior och notiser

- **Autostart med datorn:** `installera-autostart.cmd` (Windows, kör som administratör) eller `sudo sh autostart-linux.sh` (Linux).
  Då startar programmet utan inloggning efter omstarter och strömavbrott.
- **Efter strömavbrott:** ställ in *Restore on AC Power Loss → Power On* i datorns BIOS så att datorn startar själv.
- **Spelservrar:** per server kan man välja start med datorn, omstart vid krasch, daglig omstart, automatisk uppdatering
  när ingen spelar, och dagliga säkerhetskopior av spelvärlden med återställning.
- **Notiser:** ntfy eller Discord, under Drift → Notiser i panelen.
- **Starta om / stäng av datorn** från panelen (kräver lösenordet igen).

Steg för steg i [INFO.md](../INFO.md), avsnitt 7b–7d.
