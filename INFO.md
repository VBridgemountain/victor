# V.I.C.T.O.R. — så går du tillväga

Samlad guide för allt i det här repot. Kort översikt över vad som är vad finns i [README.md](README.md).

**Innehåll**

1. [Två program](#1-två-program)
2. [V.I.C.T.O.R. på datorn](#2-victor-på-datorn)
3. [V.I.C.T.O.R. på Android](#3-victor-på-android)
4. [Datorbryggan: datorns program och öppna fönster](#4-datorbryggan-datorns-program-och-öppna-fönster)
5. [Widgets](#5-widgets)
6. [V.I.C.T.O.R. Server: installation](#6-victor-server-installation)
7. [Spelservrar](#7-spelservrar)
8. [Labbet](#8-labbet)
9. [Spelhallen](#9-spelhallen)
10. [Säkerhet på servern](#10-säkerhet-på-servern)
11. [Nå servern utifrån med Cloudflare](#11-nå-servern-utifrån-med-cloudflare)
12. [Översyn över servern från V.I.C.T.O.R.](#12-översyn-över-servern-från-victor)
13. [Microsoft 365 live-data](#13-microsoft-365-live-data)
14. [Uppdatera och utveckla](#14-uppdatera-och-utveckla)
15. [Felsökning](#15-felsökning)
16. [Vad som inte är provat](#16-vad-som-inte-är-provat)

---

## 1. Två program

| | V.I.C.T.O.R. | V.I.C.T.O.R. Server |
|---|---|---|
| Vad | Startskärm med glober, appar, widgets, påminnelser, brainstorm | Kontrollpanel för en serverdator |
| Körs | I webbläsaren, som installerad webbapp eller Android-startskärm | På serverdatorn, styrs från webbläsaren |
| Mapp | `desktop/` | `server/` |
| Behöver | Ingenting | Node.js på serverdatorn |

De delar utseende men inte kod, och ingen av dem kräver den andra.

---

## 2. V.I.C.T.O.R. på datorn

**Öppna:** https://vbridgemountain.github.io/victor/

**Installera som program:** öppna adressen i Chrome eller Edge och klicka på installera-ikonen till höger i adressfältet. Då får den eget fönster och ikon i Start-menyn, och startar även utan nät.

**Grunderna**

- Dra i globen för att snurra den. Scrolla eller nyp för att zooma.
- Zooma ut helt för översikten med alla glober runt stoftmolnet. Dra för att snurra ringen, klicka på en glob för att gå in.
- Zooma in helt för att se globens appar i rader och dess idéer.
- **Glober:** lägg till, byt namn, välj färg per glob, lägg till appar.
- **+ Widget:** lägg till widgets. Dra dem i titelraden för att flytta.
- **Sök:** hittar appar i alla glober.
- **Inställningar:** temafärg, antal partiklar, exportera/importera.

**Appar i globerna** kan vara webbadresser, protokoll (t.ex. `spotify:`, `vscode:`, `ms-settings:`) eller datorns installerade program via datorbryggan (avsnitt 4).

**Brainstorm:** zooma in i en glob, skriv en idé, klicka på den för att gå in i den och lägga underidéer. Knappen Claude kopierar idéträdet och öppnar Claude för att utveckla det.

**Data:** allt sparas i webbläsaren på den enheten. Flytta mellan enheter med Exportera/Importera under Inställningar. Dator och telefon delar inte data.

---

## 3. V.I.C.T.O.R. på Android

**Ladda ner:** https://vbridgemountain.github.io/victor/desktop/victor.apk

1. Öppna länken i telefonen och installera. Tillåt installation från webbläsaren om telefonen frågar.
2. Första start sorterar telefonens appar in i glober.
3. För att använda den som startskärm: Inställningar → Välj V.I.C.T.O.R. som startskärm.

**Uppdatera:** ladda ner samma länk igen och installera över den gamla. Globerna ligger kvar.

**På telefonen**

- **Lägg till appar:** rutan "Lägg till" sist i rutnätet inne i en glob, eller Glober → "+ Lägg till appar från telefonen".
- **Snabbknappar** (Ringa, Kamera, Internet, SMS) under globen: slå av och på under + Widget.
- **Widgets** ligger i en låda som öppnas med knappen Widgets.

Appen är debug-signerad och finns inte i Play Butik.

---

## 4. Datorbryggan: datorns program och öppna fönster

En webbsida kan inte se datorns program. Datorbryggan är ett litet hjälpprogram för Windows som gör det möjligt. Den behövs bara om du vill lägga installerade program i globerna eller använda widgeten Öppna program.

**Kom igång**

1. Installera [Node.js](https://nodejs.org).
2. Hämta mappen `desktop/helper` och dubbelklicka på `starta-brygga.cmd`.
3. Öppna http://127.0.0.1:8770 på datorn och kopiera kopplingskoden.
4. I V.I.C.T.O.R.: Inställningar → Datorbrygga → klistra in koden → Anslut.

**Använda**

- Glober → **+ Lägg till program från datorn**: samma lista som Start-menyn. Tryck för att lägga i globen, tryck igen för att ta bort.
- Klicka på programmet i globen för att starta det.
- Widgeten **Öppna program** visar öppna fönster.

**Starta automatiskt vid inloggning**

```bash
node helper.js --autostart
```

Ta bort autostarten med `node helper.js --no-autostart`.

**Säkerhet:** bryggan svarar bara den egna datorn (127.0.0.1), bara V.I.C.T.O.R.s adresser med rätt kod släpps in, och den startar bara program som finns i Start-menyn.

---

## 5. Widgets

| Widget | Visar | Kräver |
|---|---|---|
| Klocka | Tid, datum, vecka | – |
| Väder | Aktuellt väder och prognos, valfri ort | Internet |
| Länkar | Egna genvägar | – |
| Påminnelser | Att göra, med larm vid vald tid | – |
| Anteckningar | Fritext som sparas | – |
| Sök | Webbsökning | – |
| System | Batteri, nätverk, skärm | – |
| Timer | Nedräkning med larm | – |
| IP och nätverk | Din publika IP, anslutning | Internet |
| Server | Serverns status och varningar | V.I.C.T.O.R. Server + läsnyckel (avsnitt 12) |
| Öppna program | Öppna fönster på datorn | Datorbryggan, bara dator |
| Microsoft 365 admin | Genvägar, och live-data efter inloggning | Appregistrering för live-data (avsnitt 13), bara dator |

---

## 6. V.I.C.T.O.R. Server: installation

På serverdatorn (Windows eller Linux):

1. Installera [Node.js](https://nodejs.org) 18.15 eller nyare.
2. Hämta repot (Code → Download ZIP på GitHub, eller `git clone`) och gå till mappen `server`.
3. Starta:

```bash
node server.js
```

4. Öppna `http://localhost:8787` **på serverdatorn** och välj lösenord (minst 8 tecken).
5. Från andra enheter i hemnätet: `http://<serverns-ip>:8787`. Adressen skrivs ut när programmet startar.

**Server utan skärm:** sätt lösenordet från terminalen och starta sedan som vanligt.

```bash
node server.js --set-password <lösenord>
```

**Portar:** 8787 (panelen) och 8788 (spelhallens spelare). Ändras med miljövariablerna `VICTOR_PORT`, `VICTOR_ARCADE_PORT` och `VICTOR_BIND`.

**Data:** lösenord, inställningar, loggar, spelservrar, kodprojekt och spelfiler ligger i `server/data/`. Säkerhetskopiera den mappen. Kopiera inte med en `data`-mapp från en annan dator.

**Panelen visar:** processor, minne, disk, publik och lokal IP, trafik ut och in, lyssnande portar och spelservrar.

---

## 7. Spelservrar

1. Inställningar → **Hämta och installera SteamCMD** (Valves verktyg för spelservrar).
2. **+ Spelserver** → välj en mall (Valheim, Counter-Strike 2, Palworld, Rust, 7 Days to Die) eller ange Steam app-ID själv.
3. Ändra servernamn och lösenord i startkommandot. Mallarna är förslag.
4. Öppna servern → **Installera**. Följ SteamCMD-loggen.
5. **Starta**. Statusen blir Online när servern svarar, med antal spelare.

**Låta vänner ansluta:** de ansluter från spelet till din publika IP och spelets port. Öppna just den porten i routern (oftast UDP). De behöver ingen inloggning i panelen, och Cloudflare Tunnel släpper inte igenom speltrafik.

**Bra att veta**

- **Stoppa** avslutar servern direkt. Spara i spelet först om spelet bara sparar vid ordnad avstängning.
- **Sök uppdatering** jämför installerad version med Steams. **Uppdatera** kräver att servern är stoppad.
- **Anslutna spelare** visas för spel som svarar på Steams statusförfrågan.
- På Windows kan spelservrarna stängas om du stänger programmets fönster. På Linux fortsätter de gå.
- "Ta bort ur panelen" tar inte bort spelfilerna från disken.

---

## 8. Labbet

Knappen **Labb** i panelen.

- **Kod:** skapa projekt och filer, redigera med färgläggning, kör med ▶ Kör eller F5. Stöd för Python, JavaScript, C och C++ om verktygen är installerade på servern. Ctrl+S sparar.
- **Terminal:** kommandon körs i projektets mapp. Det är ett enkelt skal, så helskärmsprogram som vim fungerar inte.
- **Krets:** lägg ut ett styrkort (Arduino Uno, ESP32, Raspberry Pi Pico) och delar, klicka på ett stift och sedan ett annat för att dra en sladd. Kopplingen kontrolleras löpande: matning, jord, spänningsnivåer, stiftens förmågor, ström och saknade motstånd. **Skapa kod** gör ett kodskelett från kopplingen.
- **Anslutningar:** installerade språk, inkopplade kort (serieportar) och test av om en adress och port svarar.

Kretskontrollen följer kopplingsregler och är ingen elektrisk simulering. Läs databladen innan du bygger.

---

## 9. Spelhallen

Knappen **Spelhall** i panelen. Spela egna spel i webbläsaren, på dator eller telefon.

1. Välj system, välj spelfil, tryck **Lägg till spel**. Eller lägg filer direkt i `server/data/roms/<system>/`.
2. Klicka på spelet för att starta.

**System:** PlayStation 1, Nintendo 64, SNES, NES, Game Boy/Color/Advance, Nintendo DS, Sega Mega Drive, Master System, Game Gear, Atari 2600. PS2 och nyare, Xbox och PC-spel går inte att köra i en webbläsare.

**Bra att veta**

- Lägg bara in spel du själv äger.
- Spelet körs i enheten du spelar på. Sparningar ligger i den webbläsaren.
- Emulatorn (EmulatorJS) hämtas från nätet när ett spel startas, så enheten behöver internet.
- PlayStation fungerar bäst med en fil per spel (`.chd` eller `.pbp`). En egen BIOS kan läggas som `data/roms/bios/psx.bin`.

---

## 10. Säkerhet på servern

Den som är inloggad i panelen kan köra program på servern. Skydda den därefter.

**Inställningar → Säkerhet och fjärråtkomst**

- **Tvåstegsinloggning:** slå på, lägg in nyckeln i en autentiseringsapp (Google Authenticator, Microsoft Authenticator, Aegis) och bekräfta med en kod. Gör det innan servern blir nåbar utifrån.
- **Senaste inloggningar:** tid, adress och utfall.
- **Läsnyckel:** för widgeten Server (avsnitt 12).

**Inbyggt skydd**

- Fem fel lösenord spärrar den besökaren i en minut. Väntan fördubblas för varje ny omgång, upp till en timme.
- Första lösenordet kan bara väljas på servern själv.
- Spelhallens emulator körs på en egen port och kan inte nå panelens inloggning.

**Dela aldrig lösenordet.** Panelen har inga gästkonton.

---

## 11. Nå servern utifrån med Cloudflare

Ger en vanlig https-adress som fungerar i vilken webbläsare som helst, utan program på datorn du sitter vid. Kräver en domän vars DNS ligger hos Cloudflare.

**A. Domänen**

- Köp en domän hos Cloudflare (Domain Registration), **eller**
- lägg till en befintlig domän i Cloudflare (gratisnivån) och byt namnservrar hos registraren till de två Cloudflare visar. Cloudflare kopierar de DNS-poster som redan finns. Vänta tills domänen är aktiv.

Efter namnserverbytet sköts all DNS i Cloudflare. Skapa inga subdomäner hos den gamla registraren, de får ingen effekt.

**B. Förbered servern**

Installera och starta enligt avsnitt 6, välj lösenord och slå på tvåstegsinloggning.

**C. Tunneln**

1. Cloudflare → Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared.
2. Ge den ett namn och kör installationskommandot som visas på serverdatorn.
3. Lägg till två Public hostnames:
   - `server.dindomän` → `http://localhost:8787`
   - `spel.dindomän` → `http://localhost:8788`

**D. Spärr framför panelen (rekommenderas)**

Zero Trust → Access → Applications → Add an application → Self-hosted.

- Program för `server.dindomän` med en regel som bara släpper in din e-postadress.
- Lägg **inte** Access på `spel.dindomän`. Den adressen lämnar bara ut spelfiler med en tidsbegränsad nyckel.
- Om du använder widgeten Server: skapa ett eget program för sökvägen `server.dindomän/api/summary` med regeln **Bypass**, annars stoppas widgeten.

**E. I panelen**

Inställningar → Säkerhet och fjärråtkomst → ange `https://spel.dindomän` som "Spelhallens egen https-adress".

**Begränsning:** Cloudflares gratisnivå tar högst 100 MB per uppladdning. Lägg stora spelfiler direkt i `data/roms` eller ladda upp i hemnätet.

**Alternativ utan domän:** Tailscale. Installera på servern och på dina enheter, och öppna `http://<serverns-tailscale-namn>:8787`. Inget öppnas mot internet, men varje enhet behöver Tailscale-appen.

---

## 12. Översyn över servern från V.I.C.T.O.R.

Widgeten **Server** visar om allt är igång och larmar när något behöver åtgärdas.

1. Serverpanelen → Inställningar → Säkerhet och fjärråtkomst → **Skapa läsnyckel** → Kopiera.
2. V.I.C.T.O.R. → + Widget → **Server** → ange serverns adress och nyckeln.

**Visar:** status (grön, gul, röd), varningar i klartext, processor, minne, disk, trafik, publik och lokal IP, drifttid, spelservrar, samt knappar till Panel, Labb och Spelhall.

**Varnar för:** nästan full disk, nästan slut på minne, långvarigt hög processorlast, spelserver som stannat oväntat eller inte svarar, väntande uppdatering, åtkomst via nätet utan tvåstegsinloggning, och att servern inte svarar.

**Bra att veta**

- Läsnyckeln kan bara läsa översikten, inte styra något. Byt eller ta bort den i panelen.
- Från den publicerade appen krävs serverns **https**-adress. En säker sida får inte läsa från `http://192.168…`.
- Med Cloudflare Access behövs Bypass-regeln i avsnitt 11 D.

---

## 13. Microsoft 365 live-data

Genvägarna i widgeten fungerar direkt. Live-data kräver en appregistrering i din Microsoft-miljö, en gång.

1. [Entra admin center](https://entra.microsoft.com) → Appregistreringar → Ny registrering. Konton i den här katalogen räcker.
2. Autentisering → Lägg till plattform → **Ensidesprogram (SPA)** med omdirigerings-URI:
   `https://vbridgemountain.github.io/victor/desktop/`
3. API-behörigheter → Microsoft Graph → Delegerade behörigheter:
   - `ServiceHealth.Read.All`
   - `Organization.Read.All`
   - `User.Read.All`
   - `CloudPC.Read.All` (bara om du vill se Windows 365 Cloud PC)
4. Tryck **Bevilja administratörsmedgivande**.
5. Kopiera **Program-ID (client)** och **Katalog-ID (tenant)** från Översikt.
6. I widgeten: **Koppla live-data …** → klistra in båda → Spara → **Logga in hos Microsoft**.

**Visar:** tjänster med problem, antal konton, licenser (använda av totalt) och valfritt Cloud PC.

**Bra att veta**

- Bara läsrättigheter används.
- Inloggningen sparas i webbläsaren, följer inte med vid export, och gäller högst ett dygn.
- Widgeten visar själv rätt omdirigerings-URI. Kopiera den därifrån om du kör appen från en annan adress.
- Tillåt popup-fönster för sidan, annars öppnas inte inloggningen.

---

## 14. Uppdatera och utveckla

**Användare**

- **Webbappen** uppdateras av sig själv när det finns nät.
- **Android:** ladda ner APK:n igen och installera över.
- **Servern:** hämta repot på nytt och ersätt mappen `server`, men behåll `server/data`. Starta om programmet.
- **Datorbryggan:** ersätt `helper.js` och starta om.

**Utveckling**

- Skrivbordsappen är en enda fil: `desktop/index.html`. Inget byggsteg.
- En push till `main` publicerar webbappen via GitHub Pages inom någon minut.
- Bygg Android-appen (kräver Android Studio med SDK):

```bash
powershell -ExecutionPolicy Bypass -File desktop\android\build.ps1
```

- Servern: `server/server.js` (agenten), `server/public/` (panel, labb, spelhall), `server/arcade/player.html` (spelaren).
- Kontrollera syntaxen före push: `node --check server/server.js`.

---

## 15. Felsökning

| Problem | Trolig orsak och åtgärd |
|---|---|
| Sidan är tom eller gammal | Ladda om med Ctrl+F5. Den installerade appen hämtar ny version vid nästa start med nät. |
| "Första lösenordet måste väljas på servern" | Öppna `http://localhost:8787` på serverdatorn, eller använd `--set-password`. |
| "För många försök" | Vänta den tid som anges. Spärren gäller per besökare. |
| Tappat lösenordet | Stoppa programmet, kör `node server.js --set-password <nytt>` och starta igen. |
| Tappat tvåstegskoden | Stoppa programmet, ta bort raden `"totp"` ur `server/data/config.json` och starta igen. |
| Spelservern startar inte | Läs serverns utskrift i panelen. Kontrollera startkommandot och att installationen blev klar. |
| Vänner kan inte ansluta | Porten är inte öppnad i routern, eller brandväggen blockerar. Panelen visar bara att servern lyssnar. |
| Spelhallen visar inget spel | Enheten saknar internet (emulatorn hämtas från nätet), eller spelhallens adress är inte inställd vid tunnel. |
| Widgeten Server: "svarar inte" | Fel adress, servern är av, http i stället för https, eller Cloudflare Access utan Bypass-regel. |
| Widgeten Server: "Nyckeln godkänns inte" | Skapa en ny läsnyckel i panelen och klistra in den igen. |
| Datorns program syns inte | Datorbryggan är inte igång, eller koden stämmer inte. Öppna http://127.0.0.1:8770. |
| Microsoft-inloggningen öppnas inte | Popup-fönster är blockerade för sidan. |
| Microsoft svarar med fel om omdirigering | Omdirigerings-URI i appregistreringen matchar inte exakt, eller plattformen är inte SPA. |

---

## 16. Vad som inte är provat

Det här är byggt men inte provkört på riktigt, så räkna med att något kan behöva justeras:

- **Servern på Linux.** Koden har stöd, men allt är provkört på Windows.
- **SteamCMD:** hämtning, installation och uppdatering av riktiga spel, samt sökning efter ny version. Start, stopp, status och spelarlista är provade med en simulerad spelserver.
- **Spelhallen med ett riktigt spel.** Emulatorn startar, men inget spel, ingen handkontroll och ingen telefon är provad.
- **Åtkomst via Cloudflare Tunnel** och egen HTTPS med certifikat.
- **Microsoft 365 live-data** mot en riktig Microsoft-miljö. Provad med simulerade svar.
- **C++ i Labbet** och knappen Skapa kod.
- **Lyfta fram fönster** från widgeten Öppna program.
- **Senaste versionerna på en riktig telefon.** De är provade i emulator och i webbläsare i telefonstorlek.
