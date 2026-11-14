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
