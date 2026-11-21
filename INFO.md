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

Drift, strömavbrott, säkerhetskopior och notiser för servern står i avsnitt 7b–7d.

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

**Spel från archive.org:** Glober → **+ Spel från archive.org**. Välj samling (MS-DOS, Windows 3.x, arkad, konsoler, Commodore 64, Apple II), sök eller klistra in en länk från archive.org, och tryck **Spela** eller **Lägg till**. Spelet öppnas i ett eget fönster inne i appen: dra i titelraden för att flytta, i nedre högra hörnet för att ändra storlek, ⛶ för helskärm, — för att minimera. Klicka i spelet innan du spelar, så att tangentbordet styr det. Spelen körs hos Internet Archive och laddas inte ner till datorn eller servern. Spelfönstret visar archive.org:s egen spelare: högtalaren uppe till höger slår på och av ljudet, pilarna ger helskärm. **?** visar hur man spelar just det spelet (kontrollerna för alla klassiker finns inlagda), **↻** startar om spelet. Undvik Ctrl+R och Ctrl+W i spelen: det är webbläsarens genvägar för att ladda om och stänga. **⧉** öppnar spelet i ett eget fönster, och **Spel i eget fönster** under Inställningar → Fönster gör det alltid. Mus i gamla spel fångas när du klickar i spelet; Esc släpper den.

**Mappar:** i Glober, tryck **+ Ny mapp** och lägg appar i den med **Flytta till…** på varje rad (eller **Öppna mappen** för att redigera innehållet). I globen klickar du på mappen för att zooma in ett steg till; scrolla ut, tryck Esc eller klicka på globens namn högst upp för att backa.

**Klassiska spel:** på datorn finns mappen **Klassiker** i globen **Spel** med 46 av de mest spelade spelen hos archive.org (MS-DOS, arkad och Windows 3.x), bland annat Doom, Duke Nukem, Earthworm Jim, Prince of Persia, Monkey Island och Lemmings. Ta bort spel du inte vill ha, eller hela mappen. **Ladda in klassikerna** (i spelsökningen eller Inställningar → Glober och appar) lägger tillbaka det som saknas och skapar mappen igen om den är borttagen.

**Sortera och flytta appar:** i Glober, dra i ⠿ framför en app för att ändra ordning, eller släpp den på en glob i flikraden för att flytta den dit. Menyn "Flytta till…" på varje rad gör samma sak.

**Ikoner för webbadresser:** som standard hämtas webbplatsens egen ikon direkt från sajten. Tryck på ikonen i Glober för att välja webbplatsens ikon, första bokstaven, en emoji eller en bildadress. Vill du inte ha webbplatsernas ikoner alls: Inställningar → stäng av "Hämta webbplatsernas egna ikoner".

**Importera många länkar och bokmärken:** Glober eller Inställningar → **Importera länkar eller bokmärken**. Exporterade bokmärken från webbläsaren (.html) fungerar: Chrome och Edge → Bokmärken → Hantera bokmärken → ⋮ → Exportera bokmärken; Firefox → Hantera bokmärken → Importera och säkerhetskopiera → Exportera bokmärken till HTML. Mapparna blir glober. Välj en fil (på datorn) eller klistra in innehållet (fungerar även på telefonen). Varje adress blir en app. Filen kan vara:

- en lista med adresser: `["https://github.com", "youtube.com"]`
- en lista med appar: `[{"name": "GitHub", "url": "https://github.com", "icon": "🐙"}]`
- grupper: `{"Jobb": [...], "Nöje": [...]}`
- glober: `{"globes": [{"name": "Jobb", "color": "#3d8bff", "apps": [...]}]}`
- Chromes bokmärkesfil (mapparna blir glober)

Grupper kan bli egna glober (befintliga med samma namn fylls på) eller hamna i en vald glob. Adresser som redan finns hoppas över. Under "Hur filen ska se ut" finns ett exempel att ladda ner.

**Byta namn på systemet:** Inställningar → Systemets namn. Visas uppe till vänster och i fliken, alltid med "by NoirLab" under. Namnet på den installerade appen och Android-ikonen ändras inte.

**Brainstorm:** zooma in i en glob, skriv en idé, klicka på den för att gå in i den och lägga underidéer. Knappen Claude kopierar idéträdet och öppnar Claude för att utveckla det.

**Version och uppdatering:** Inställningar → Version visar vilken version du har. Sök uppdatering jämför med den senaste, och appen kollar själv en gång per dygn och säger till om en ny finns. Uppdatera nu laddar om webbappen med den nya versionen. I Android-appen laddas den nya APK:n ner, och du installerar den över den gamla.

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
- **Förhandsbilder av fönster** (Inställningar → Fönster): varje öppet fönster visas som en ruta med en levande bild, som du kan dra var som helst över skärmarna. Klicka på rutan för att visa fönstret, ✕ stänger det. Välj hur ofta bilderna uppdateras (1–10 sekunder) och storlek, eller stäng av dem om datorn blir seg. Minimerade fönster går inte att fotografera och visar sin senaste bild.
- **Minimera alla fönster** (▁ i aktivitetsfältet eller Inställningar → Fönster): lägger undan alla fönster utom V.I.C.T.O.R. Tryck igen (▣) för att visa samma fönster igen.
- **Ordna fönster** (▦ i aktivitetsfältet eller Inställningar → Fönster): välj skärm och plats (hela, halvor, hörn eller tredjedelar) per program. **Ordna nu** flyttar de öppna fönstren dit, och **Ordna automatiskt** gör det när programmet öppnas.
- **Aktivitetsfältet** längst ner visar alla öppna fönster, som Windows aktivitetsfält. Klicka för att visa ett fönster, ✕ (eller högerklick) för att stänga det, som att trycka på dess eget kryss. Flera fönster från samma program samlas, och ett klick visar en lista att välja i. Dölj fältet med ✕ längst till höger; visa det igen under Inställningar → Datorbrygga.

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
| Rekord | Dina egna poäng per spel, topplista eller bästa i varje spel. Spara direkt med 🏆 i spelfönstret | – |
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

## 7b. Drift: autostart, strömavbrott och omstart

### Starta automatiskt med datorn (gör detta först)

Utan autostart måste någon logga in och starta `node server.js` efter varje omstart. Med autostart startar programmet direkt när datorn startar, **utan att någon loggar in**, och Windows startar om det om det skulle stängas.

- **Windows:** dubbelklicka på `installera-autostart.cmd` i mappen `server` och godkänn frågan om administratörsbehörighet. Programmet körs sedan i bakgrunden utan fönster. Ta bort med `ta-bort-autostart.cmd`.
- **Linux:** `sudo sh autostart-linux.sh` (ta bort med `--remove`). Skapar en systemd-tjänst och tillåter panelen att starta om och stänga av datorn.

Panelens kort **Drift** visar "Startar med datorn: ja" när det är på. När autostarten väl är installerad kan den slås av och på i panelen under **Drift och notiser …** (ändringen gäller från nästa omstart).

**Underhållsläge** (under Drift och notiser) stänger tillfälligt av all automatik: ingen omstart vid krasch, inga schemalagda omstarter, säkerhetskopior eller uppdateringar, och inga notiser utom när datorn startar. Bra när du själv mekar med servern.

Programmet körs då som SYSTEM (Windows). Spel som sparar i användarens AppData hamnar därför i systemkontots mapp. Mallen för Valheim använder `-savedir "saves"` så att världen hamnar i serverns egen mapp.

### Efter strömavbrott

1. **Datorn måste starta av sig själv när strömmen kommer tillbaka.** Det ställs in i datorns BIOS/UEFI: tryck Del eller F2 vid start, leta efter *Restore on AC Power Loss* / *AC Back* / *Power On after Power Failure* och välj **Power On**. Det kan inte styras från panelen.
2. Med autostart startar V.I.C.T.O.R. Server av sig själv.
3. Spelservrar med **Starta med datorn** startar efter cirka 15 sekunder.
4. Du får en notis: "Servern är igång igen. Den var nere från … till …". Samma uppgift visas i kortet Drift.

### Styra datorn från panelen

Kortet **Drift** har **Starta om datorn** och **Stäng av**. Båda kräver lösenordet (och tvåstegskoden) igen. Spelservrarna stängs först och startar igen efter omstarten.

**En avstängd dator kan inte startas från panelen**, eftersom programmet inte körs då. Vill du kunna starta den på distans: slå på *Wake-on-LAN* i BIOS och nätverkskortet, och väck datorn från en enhet som alltid är på i hemnätet (många routrar har Wake-on-LAN i sitt webbgränssnitt). Datorns MAC-adress behövs, den står i Windows under Inställningar → Nätverk → Egenskaper.

Windows-uppdateringar som startar om datorn hanteras som ett strömavbrott: allt startar igen och du får en notis.

## 7c. Spelservrar: automatik och säkerhetskopior

Under **Ändra** på en spelserver:

| Inställning | Gör |
|---|---|
| Starta med datorn | Startar servern när programmet startar, t.ex. efter strömavbrott |
| Starta om automatiskt om den kraschar | Startar om efter 10 sekunder, högst tre gånger på 15 minuter. Därefter en notis i stället |
| Uppdatera automatiskt när ingen spelar | Söker uppdatering dagligen (vid omstartstiden, annars 05:00). Tar säkerhetskopia, stoppar, uppdaterar och startar. Hoppar över om någon spelar |
| Daglig omstart | Startar om servern vid vald tid |
| Daglig säkerhetskopia | Säkerhetskopierar vid vald tid |
| Mapp med spelvärlden | Det som säkerhetskopieras, relativt till serverns mapp (mallarna fyller i rätt mapp för Valheim, Palworld och Rust) |
| Antal kopior att spara | Äldre kopior tas bort automatiskt |

**Säkerhetskopior** (knappen i serverns ruta): **Säkerhetskopiera nu**, lista över kopior och **Återställ**. Återställning kräver att servern är stoppad. Det som fanns innan sparas som `<mapp>.fore-aterstallning` bredvid, så att en återställning går att ångra för hand. Före varje uppdatering tas en kopia automatiskt.

Kopiorna ligger i `server/data/backups/`. De skyddar mot trasiga uppdateringar och misstag, men inte mot en trasig disk. Kopiera mappen till en annan disk eller molnet då och då.

## 7d. Notiser till telefonen

Kortet **Drift → Drift och notiser …** (finns också under Inställningar). Där slår du av och på varje kanal, byter Discord-kanal och väljer vilka händelser som ska skickas.

- **ntfy** (enklast): installera appen *ntfy* på telefonen. Tryck **Skapa hemligt ämne** i panelen, spara, och prenumerera på samma ämne i appen. Ämnesnamnet fungerar som lösenord, så använd det slumpade.
- **Discord**: klistra in en webhook-adress (kanalens inställningar → Integrationer → Webhooks → Ny webhook → Kopiera URL). Panelen kontrollerar att webhooken finns och visar dess namn. **Byta kanal eller Discord-server:** skapa en webhook där och klistra in den nya adressen. **Koppla bort Discord** tar bort den helt.
- **Spara och skicka test** visar direkt om det fungerar.

Du får notiser när en spelserver kraschar eller inte kan startas, när disken eller minnet tar slut, när en säkerhetskopia eller uppdatering misslyckas, och när servern startat igen efter ett avbrott. Under **Skicka notis när** kryssar du i vilka typer du vill ha: krascher, disk och minne, misslyckade säkerhetskopior och uppdateringar, servern igång igen, och vanliga händelser (av som standard).

I spelserverns ruta kan **Starta med datorn**, **Omstart vid krasch** och **Autouppdatera** slås av och på direkt, utan att öppna Ändra. Allt syns också under **Händelser …** i panelen.

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
- **Ny version:** höj `APP_VERSION` i `desktop/index.html` och skriv vad som är nytt under `notes` i `desktop/version.json`. Kör sedan bygget nedan: det skriver versionen till `version.json` och APK:n. Pusha därefter. Appar med en lägre version erbjuds uppdateringen.
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
| Panelen nås inte efter omstart | Autostart är inte påslagen (avsnitt 7b), eller datorn startade inte efter strömavbrottet (BIOS-inställningen). |
| Ingen notis kommer | Tryck Spara och skicka test under Notiser. Kontrollera att telefonen prenumererar på exakt samma ntfy-ämne. |
| Säkerhetskopian misslyckas | Mappen med spelvärlden finns inte än (servern har inte sparat), eller spelet låser filerna. Stoppa servern och försök igen. |
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
- **SteamCMD:** hämtning, installation och uppdatering av riktiga spel, samt sökning efter ny version (även den automatiska uppdateringen). Start, stopp, status och spelarlista är provade med en simulerad spelserver.
- **Autostart-skripten** (Windows och Linux), omstart och avstängning av datorn från panelen, och att notiser faktiskt kommer fram till ntfy och Discord. Automatisk omstart efter krasch, start efter ett simulerat strömavbrott, säkerhetskopiering och återställning är provade lokalt.
- **Spelhallen med ett riktigt spel.** Emulatorn startar, men inget spel, ingen handkontroll och ingen telefon är provad.
- **Åtkomst via Cloudflare Tunnel** och egen HTTPS med certifikat.
- **Microsoft 365 live-data** mot en riktig Microsoft-miljö. Provad med simulerade svar.
- **C++ i Labbet** och knappen Skapa kod.
- **Lyfta fram fönster** från widgeten Öppna program.
- **Senaste versionerna på en riktig telefon.** De är provade i emulator och i webbläsare i telefonstorlek.
