#!/usr/bin/env node
// V.I.C.T.O.R. Server — agent som körs på den dedikerade servern.
// Visar system, nätverk och lyssnande portar, och sköter spelservrar via SteamCMD (installera, uppdatera, starta, stoppa).
// Inga beroenden: bara Node.js (18.15 eller nyare). Start:  node server.js   → panelen finns på http://<serverns-ip>:8787
'use strict';
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), os = require('os'),
      crypto = require('crypto'), dgram = require('dgram'), { spawn, execFile } = require('child_process');

const WIN = process.platform === 'win32';
const ROOT = __dirname, PUB = path.join(ROOT, 'public'), DATA = path.join(ROOT, 'data'), LOGS = path.join(DATA, 'logs');
fs.mkdirSync(LOGS, { recursive: true });
const CFG_FILE = path.join(DATA, 'config.json');
const PORT = +(process.env.VICTOR_PORT || 8787), BIND = process.env.VICTOR_BIND || '0.0.0.0';

// ------------------------------------------------------------------ sparad konfiguration
let cfg = { pass: null, steamcmd: '', serversDir: path.join(DATA, 'servers'), servers: [] };
try { Object.assign(cfg, JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'))); } catch { /* första start */ }
const save = () => { fs.writeFileSync(CFG_FILE + '.tmp', JSON.stringify(cfg, null, 2)); fs.renameSync(CFG_FILE + '.tmp', CFG_FILE); };

const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') });
const checkPw = pw => { if (!cfg.pass) return false;
  const h = crypto.scryptSync(String(pw), cfg.pass.salt, 32); return crypto.timingSafeEqual(h, Buffer.from(cfg.pass.hash, 'hex')); };

// node server.js --set-password <lösenord>   (för en server utan skärm, där man inte kan öppna panelen lokalt första gången)
const spw = process.argv.indexOf('--set-password');
if (spw > 0) {
  const pw = process.argv[spw + 1];
  if (!pw || pw.length < 8) { console.error('Lösenordet måste vara minst 8 tecken.'); process.exit(1); }
  cfg.pass = hashPw(pw); save(); console.log('Lösenordet är sparat.'); process.exit(0);
}

// ------------------------------------------------------------------ små hjälpare
const run = (cmd, args, opts = {}) => new Promise(res => {
  execFile(cmd, args, { windowsHide: true, timeout: 20000, maxBuffer: 16 << 20, ...opts }, (err, out) => res(err ? '' : String(out)));
});
const tail = (file, lines = 200) => { try {
  const st = fs.statSync(file), n = Math.min(st.size, 96 * 1024), b = Buffer.alloc(n), fd = fs.openSync(file, 'r');
  fs.readSync(fd, b, 0, n, st.size - n); fs.closeSync(fd);
  return b.toString('utf8').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split(/\r?\n/).slice(-lines).join('\n');
} catch { return ''; } };
const alive = pid => { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

// ------------------------------------------------------------------ system + nätverk
let cpuPrev = null, cpuPct = 0;
function sampleCpu() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) { for (const k in c.times) total += c.times[k]; idle += c.times.idle; }
  if (cpuPrev && total > cpuPrev.total) cpuPct = 100 * (1 - (idle - cpuPrev.idle) / (total - cpuPrev.total));
  cpuPrev = { idle, total };
}
// Totalt mottaget/skickat sedan start. Windows: "netstat -e" (raden med två stora tal, oberoende av språk). Linux: /proc/net/dev.
async function netTotals() {
  if (WIN) {
    const m = (await run('netstat', ['-e'])).split(/\r?\n/).map(l => l.match(/\s(\d+)\s+(\d+)\s*$/)).find(Boolean);
    return m ? { rx: +m[1], tx: +m[2] } : null;
  }
  try {
    let rx = 0, tx = 0;
    for (const l of fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2)) {
      const [name, rest] = l.split(':'); if (!rest || name.trim() === 'lo') continue;
      const f = rest.trim().split(/\s+/); rx += +f[0]; tx += +f[8];
    }
    return { rx, tx };
  } catch { return null; }
}
const net = { rx: 0, tx: 0, rxRate: 0, txRate: 0, hist: [], since: Date.now(), rx0: null, tx0: null };
let netPrev = null;
async function sampleNet() {
  const t = await netTotals(), now = Date.now(); if (!t) return;
  if (netPrev && now > netPrev.at) {
    const dt = (now - netPrev.at) / 1000;
    // räknarna kan slå runt (32 bitar på Windows) eller nollställas: hoppa över det provet
    if (t.rx >= netPrev.rx && t.tx >= netPrev.tx) {
      net.rxRate = (t.rx - netPrev.rx) / dt; net.txRate = (t.tx - netPrev.tx) / dt;
      net.rx += t.rx - netPrev.rx; net.tx += t.tx - netPrev.tx;
    }
    net.hist.push([Math.round(net.rxRate), Math.round(net.txRate)]); if (net.hist.length > 90) net.hist.shift();
  }
  netPrev = { ...t, at: now };
}
function localIps() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const a of list) if (!a.internal && a.family === 'IPv4') out.push({ name, ip: a.address });
  return out;
}
let pubIp = { ip: null, at: 0 };
function publicIp() {   // den adress omvärlden ser; frågas högst var tionde minut
  if (Date.now() - pubIp.at < 600000) return;
  pubIp.at = Date.now();
  https.get('https://api.ipify.org', { timeout: 6000 }, r => { let d = ''; r.on('data', c => d += c);
    r.on('end', () => { if (/^[\d.:a-f]+$/i.test(d.trim())) pubIp.ip = d.trim(); }); }).on('error', () => {}).on('timeout', function () { this.destroy(); });
}
async function disk() {
  try { fs.mkdirSync(cfg.serversDir, { recursive: true }); const s = await fs.promises.statfs(cfg.serversDir);
    return { total: s.blocks * s.bsize, free: s.bavail * s.bsize }; } catch { return null; }
}

// Lyssnande portar: vad den här maskinen tar emot anslutningar på. Säger inget om routern släpper in trafik utifrån.
let ports = { list: [], at: 0 }, portsBusy = false;
async function samplePorts() {
  if (portsBusy || Date.now() - ports.at < 12000) return;
  portsBusy = true;
  try {
    const list = [];
    if (WIN) {
      const [ns, tl] = await Promise.all([run('netstat', ['-ano']), run('tasklist', ['/fo', 'csv', '/nh'])]);
      const names = new Map();
      for (const l of tl.split(/\r?\n/)) { const m = l.match(/^"([^"]+)","(\d+)"/); if (m) names.set(+m[2], m[1]); }
      for (const l of ns.split(/\r?\n/)) {
        const f = l.trim().split(/\s+/); if (f[0] !== 'TCP' && f[0] !== 'UDP') continue;
        if (f[0] === 'TCP' && !/:0$/.test(f[2])) continue;   // bara lyssnande (fjärradress …:0), inte pågående anslutningar
        const pid = +f[f.length - 1], i = f[1].lastIndexOf(':');
        list.push({ proto: f[0], addr: f[1].slice(0, i), port: +f[1].slice(i + 1), pid, name: names.get(pid) || '' });
      }
    } else {
      for (const l of (await run('ss', ['-H', '-tulnp'])).split('\n')) {
        const f = l.trim().split(/\s+/); if (f.length < 5) continue;
        const i = f[4].lastIndexOf(':'), m = l.match(/users:\(\("([^"]+)",pid=(\d+)/);
        list.push({ proto: f[0].toUpperCase(), addr: f[4].slice(0, i), port: +f[4].slice(i + 1), pid: m ? +m[2] : 0, name: m ? m[1] : '' });
      }
    }
    // samma port på IPv4 och IPv6 visas som en rad; "öppen mot nätet" om den inte bara lyssnar lokalt
    const seen = new Map();
    for (const p of list) {
      if (!p.port) continue;
      const local = /^(127\.|\[?::1\]?$)/.test(p.addr), k = p.proto + p.port, o = seen.get(k);
      if (o) { if (!local) o.local = false; } else seen.set(k, { proto: p.proto, port: p.port, pid: p.pid, name: p.name, local });
    }
    ports = { list: [...seen.values()].sort((a, b) => a.port - b.port || a.proto.localeCompare(b.proto)), at: Date.now() };
  } finally { portsBusy = false; }
}

// ------------------------------------------------------------------ spelservrar
// Mallarna är startförslag: kommandon och portar går att ändra i panelen efter att servern lagts till.
const TEMPLATES = [
  { key: 'valheim', name: 'Valheim', appId: 896660, port: 2456, queryPort: 2457,
    win: 'valheim_server.exe -nographics -batchmode -name "Min server" -port 2456 -world "Dedicated" -password "byt-mig" -public 0',
    linux: './valheim_server.x86_64 -nographics -batchmode -name "Min server" -port 2456 -world "Dedicated" -password "byt-mig" -public 0' },
  { key: 'cs2', name: 'Counter-Strike 2', appId: 730, port: 27015, queryPort: 27015,
    win: 'game\\bin\\win64\\cs2.exe -dedicated -port 27015 +map de_dust2',
    linux: './game/bin/linuxsteamrt64/cs2 -dedicated -port 27015 +map de_dust2' },
  { key: 'palworld', name: 'Palworld', appId: 2394010, port: 8211, queryPort: 0,
    win: 'PalServer.exe -port=8211', linux: './PalServer.sh -port=8211' },
  { key: 'rust', name: 'Rust', appId: 258550, port: 28015, queryPort: 28016,
    win: 'RustDedicated.exe -batchmode +server.port 28015 +server.queryport 28016 +server.identity "victor" +server.hostname "Min server" +server.maxplayers 20 +server.worldsize 3000',
    linux: './RustDedicated -batchmode +server.port 28015 +server.queryport 28016 +server.identity "victor" +server.hostname "Min server" +server.maxplayers 20 +server.worldsize 3000' },
  { key: '7dtd', name: '7 Days to Die', appId: 294420, port: 26900, queryPort: 26900,
    win: '7DaysToDieServer.exe -quit -batchmode -nographics -configfile=serverconfig.xml -dedicated',
    linux: './7DaysToDieServer.x86_64 -quit -batchmode -nographics -configfile=serverconfig.xml -dedicated' },
];
const rt = new Map();   // körtidsläge per server: { job, jobText, query, latest, checkedAt, stopping }
const R = id => { if (!rt.has(id)) rt.set(id, {}); return rt.get(id); };
const sdir = s => s.dir || path.join(cfg.serversDir, s.id);
const gameLog = s => path.join(LOGS, s.id + '-game.log'), steamLog = s => path.join(LOGS, s.id + '-steam.log');

function installedBuild(s) {
  try { const m = fs.readFileSync(path.join(sdir(s), 'steamapps', `appmanifest_${s.appId}.acf`), 'utf8').match(/"buildid"\s+"(\d+)"/); return m ? m[1] : null; }
  catch { return null; }
}
function steamcmdPath() {
  const c = [cfg.steamcmd, path.join(DATA, 'steamcmd', WIN ? 'steamcmd.exe' : 'steamcmd.sh'), WIN ? 'C:\\steamcmd\\steamcmd.exe' : '/usr/games/steamcmd', '/usr/bin/steamcmd'];
  return c.find(p => p && fs.existsSync(p)) || null;
}
function steamJob(s, args, label) {   // kör SteamCMD i bakgrunden och skriv allt till serverns steam-logg
  const sc = steamcmdPath(), r = R(s.id);
  if (!sc) throw new Error('SteamCMD är inte installerat. Installera det under Inställningar.');
  if (r.job) throw new Error('SteamCMD arbetar redan med den här servern.');
  const log = fs.openSync(steamLog(s), 'w');
  const child = spawn(sc, args, { windowsHide: true, stdio: ['ignore', log, log] });
  r.job = label; r.jobText = '';
  return new Promise(res => {
    const done = code => { try { fs.closeSync(log); } catch { } r.job = null; res(code); };
    child.on('error', () => done(-1)); child.on('exit', done);
  });
}
async function updateServer(s) {
  if (alive(s.pid)) throw new Error('Stoppa servern innan den uppdateras.');
  fs.mkdirSync(sdir(s), { recursive: true });
  const code = await steamJob(s, ['+force_install_dir', sdir(s), '+login', 'anonymous', '+app_update', String(s.appId), 'validate', '+quit'], 'update');
  const r = R(s.id), ok = /Success! App '\d+' (fully installed|already up to date)/.test(tail(steamLog(s), 60));
  r.jobText = ok ? 'Klar' : `SteamCMD avslutades utan att bekräfta installationen (kod ${code}). Se loggen.`;
  if (ok) r.latest = installedBuild(s);
}
async function checkServer(s) {   // senaste version hos Steam, jämförs med den installerade
  await steamJob(s, ['+login', 'anonymous', '+app_info_update', '1', '+app_info_print', String(s.appId), '+quit'], 'check');
  const out = fs.readFileSync(steamLog(s), 'utf8'), i = out.indexOf('"branches"'), j = out.indexOf('"public"', i),
        m = i >= 0 && j >= 0 ? out.slice(j, j + 400).match(/"buildid"\s+"(\d+)"/) : null, r = R(s.id);
  r.latest = m ? m[1] : null; r.checkedAt = Date.now();
  r.jobText = m ? '' : 'Kunde inte läsa versionen från Steam. Se loggen.';
}
function startServer(s) {
  if (alive(s.pid)) throw new Error('Servern är redan igång.');
  if (R(s.id).job) throw new Error('Vänta tills SteamCMD är klar.');
  if (!s.cmd) throw new Error('Inget startkommando är angivet.');
  if (!fs.existsSync(sdir(s))) throw new Error('Servern är inte installerad än.');
  // Utskriften styrs till loggfilen av skalet självt. På Linux får servern ett eget processträd och fortsätter gå om
  // agenten startas om. På Windows går det inte ihop med loggning (en fristående process tappar sin utskrift), så där
  // delar servern konsol med agenten: stängs agentens fönster med Ctrl+C kan spelservrarna följa med.
  const child = spawn(`${s.cmd} > "${gameLog(s)}" 2>&1`, { cwd: sdir(s), shell: true, detached: !WIN, windowsHide: true, stdio: 'ignore' });
  child.on('error', () => {}); child.unref();
  s.pid = child.pid; s.startedAt = Date.now(); R(s.id).query = null; save();
}
function stopServer(s) {
  if (!alive(s.pid)) { s.pid = 0; save(); return; }
  const pid = s.pid, r = R(s.id); r.stopping = true;
  if (WIN) execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
  else {
    try { process.kill(-pid, 'SIGTERM'); } catch { }
    setTimeout(() => { if (alive(pid)) try { process.kill(-pid, 'SIGKILL'); } catch { } }, 15000);
  }
}
// "Är den online?": frågar servern själv med Steams A2S_INFO över UDP, som serverlistan i Steam gör.
function a2sAsk(port, head, type, parse, first = Buffer.alloc(0)) {   // skickar en förfrågan, svarar på en eventuell utmaning och tolkar svaret
  return new Promise(res => {
    const sock = dgram.createSocket('udp4');
    const end = v => { clearTimeout(t); try { sock.close(); } catch { } res(v); }, t = setTimeout(() => end(null), 1500);
    sock.on('error', () => end(null));
    sock.on('message', b => {
      if (b.length >= 9 && b[4] === 0x41) return sock.send(Buffer.concat([head, b.subarray(5, 9)]), port, '127.0.0.1');   // utmaning: fråga igen
      if (b.length < 6 || b[4] !== type) return;
      try { end(parse(b)); } catch { end(null); }
    });
    sock.send(Buffer.concat([head, first]), port, '127.0.0.1');
  });
}
const cstr = (b, i) => { const e = b.indexOf(0, i), z = e < 0 ? b.length : e; return [b.toString('utf8', i, z), z + 1]; };
const a2s = port => a2sAsk(port, Buffer.concat([Buffer.from([255, 255, 255, 255, 0x54]), Buffer.from('Source Engine Query ')]), 0x49, b => {
  let i = 6, name, map; [name, i] = cstr(b, i); [map, i] = cstr(b, i); [, i] = cstr(b, i); [, i] = cstr(b, i); i += 2;
  return { name, map, players: b[i], max: b[i + 1] };
});
// Vilka som är anslutna: namn, poäng och hur länge de varit inne (A2S_PLAYER). Alla spel svarar inte på den.
const a2sPlayers = port => a2sAsk(port, Buffer.from([255, 255, 255, 255, 0x55]), 0x44, b => {
  const n = b[5], list = []; let i = 6;
  for (let k = 0; k < n && i < b.length; k++) { let name; i++; [name, i] = cstr(b, i); if (i + 8 > b.length) break;
    list.push({ name: name.slice(0, 60), score: b.readInt32LE(i), secs: Math.round(b.readFloatLE(i + 4)) }); i += 8; }
  return list;
}, Buffer.from([255, 255, 255, 255]));   // spelarfrågan börjar alltid med en tom utmaning
async function sampleServers() {
  for (const s of cfg.servers) {
    const r = R(s.id);
    if (s.pid && !alive(s.pid)) { s.pid = 0; r.stopping = false; r.query = r.players = null; save(); }
    if (s.pid && s.queryPort) { r.query = await a2s(s.queryPort); r.players = r.query ? await a2sPlayers(s.queryPort) : null; }
  }
}
function serverView(s) {
  const r = R(s.id), running = alive(s.pid), installed = installedBuild(s);
  return { id: s.id, name: s.name, appId: s.appId, cmd: s.cmd, port: s.port, queryPort: s.queryPort, dir: sdir(s),
    ready: fs.existsSync(sdir(s)), running, stopping: !!r.stopping && running, startedAt: running ? s.startedAt : 0, pid: running ? s.pid : 0,
    online: running && !!r.query, query: running ? r.query || null : null, players: running && r.query ? r.players || null : null,
    job: r.job || null, jobText: r.jobText || '', installed, latest: r.latest || null, checkedAt: r.checkedAt || 0,
    updateAvailable: !!(installed && r.latest && installed !== r.latest) };
}

// SteamCMD hämtas från Valves egen adress när man trycker på knappen i panelen.
let scInstall = null;
async function installSteamcmd() {
  if (scInstall) throw new Error('Installationen pågår redan.');
  const dir = path.join(DATA, 'steamcmd'), file = path.join(dir, WIN ? 'steamcmd.zip' : 'steamcmd_linux.tar.gz');
  fs.mkdirSync(dir, { recursive: true }); scInstall = 'Hämtar SteamCMD …';
  try {
    await new Promise((ok, fail) => https.get('https://steamcdn-a.akamaihd.net/client/installer/' + path.basename(file), r => {
      if (r.statusCode !== 200) return fail(new Error('Hämtningen misslyckades (HTTP ' + r.statusCode + ').'));
      const w = fs.createWriteStream(file); r.pipe(w); w.on('finish', ok); w.on('error', fail);
    }).on('error', fail));
    scInstall = 'Packar upp …';
    if (WIN) await run('powershell', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath $env:VF -DestinationPath $env:VD -Force'], { timeout: 120000, env: { ...process.env, VF: file, VD: dir } });
    else await run('tar', ['-xzf', file, '-C', dir], { timeout: 120000 });
    fs.rmSync(file, { force: true });
    if (!steamcmdPath()) throw new Error('SteamCMD gick inte att packa upp.');
  } finally { scInstall = null; }
}

// ------------------------------------------------------------------ inloggning
const sessions = new Map();   // token → utgångstid
let fails = 0, lockedUntil = 0;
const cookieTok = req => (/(?:^|;\s*)victor=([a-f0-9]{48})/.exec(req.headers.cookie || '') || [])[1];
const authed = req => { const t = cookieTok(req), e = t && sessions.get(t); if (!e) return false; if (e < Date.now()) { sessions.delete(t); return false; } return true; };
const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
function newSession(res) {
  const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, Date.now() + 30 * 864e5);
  res.setHeader('Set-Cookie', `victor=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 86400}`);
}

// ------------------------------------------------------------------ http
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise((ok, fail) => { let d = ''; req.on('data', c => { d += c; if (d.length > 65536) { fail(new Error('För stor förfrågan.')); req.destroy(); } });
  req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { fail(new Error('Ogiltig JSON.')); } }); });
const clean = (v, max = 200) => String(v == null ? '' : v).replace(/[\r\n\0]/g, ' ').trim().slice(0, max);
const portNum = v => { const n = +v | 0; return n > 0 && n < 65536 ? n : 0; };

async function status() {
  const [d] = await Promise.all([disk(), samplePorts()]); publicIp();
  return {
    host: os.hostname(), os: `${os.type()} ${os.release()}`, platform: WIN ? 'win' : 'linux', uptime: os.uptime(),
    cpu: Math.round(cpuPct), cores: os.cpus().length, mem: { total: os.totalmem(), free: os.freemem() }, disk: d,
    net: { rx: net.rx, tx: net.tx, rxRate: net.rxRate, txRate: net.txRate, hist: net.hist, since: net.since, local: localIps(), publicIp: pubIp.ip },
    ports: ports.list, servers: cfg.servers.map(serverView), templates: TEMPLATES,
    steamcmd: { path: steamcmdPath(), installing: scInstall, error: scErr }, serversDir: cfg.serversDir,
  };
}
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (m !== 'GET') {   // skydd mot att en annan webbsida skickar kommandon via din inloggade webbläsare
    const o = req.headers.origin; if (o && new URL(o).host !== req.headers.host) return send(res, 403, { error: 'Fel ursprung.' });
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'JSON krävs.' });
  }
  if (p === '/api/session' && m === 'GET') return send(res, 200, { setup: !cfg.pass, authed: authed(req), local: isLocal(req) });
  if (p === '/api/setup' && m === 'POST') {
    if (cfg.pass) return send(res, 400, { error: 'Ett lösenord finns redan.' });
    if (!isLocal(req)) return send(res, 403, { error: 'Första lösenordet måste väljas på servern själv (http://localhost:' + PORT + '), eller med: node server.js --set-password <lösenord>' });
    const b = await body(req); if (clean(b.password).length < 8) return send(res, 400, { error: 'Minst 8 tecken.' });
    cfg.pass = hashPw(String(b.password)); save(); newSession(res); return send(res, 200, { ok: true });
  }
  if (p === '/api/login' && m === 'POST') {
    if (Date.now() < lockedUntil) return send(res, 429, { error: 'För många försök. Vänta en minut.' });
    const b = await body(req);
    if (!checkPw(b.password || '')) { if (++fails >= 5) { fails = 0; lockedUntil = Date.now() + 60000; } return send(res, 401, { error: 'Fel lösenord.' }); }
    fails = 0; newSession(res); return send(res, 200, { ok: true });
  }
  if (!authed(req)) return send(res, 401, { error: 'Inte inloggad.' });
  if (p === '/api/logout' && m === 'POST') { sessions.delete(cookieTok(req)); return send(res, 200, { ok: true }); }
  if (p === '/api/status' && m === 'GET') return send(res, 200, await status());
  if (p === '/api/settings' && m === 'POST') {
    const b = await body(req);
    if (b.steamcmd != null) cfg.steamcmd = clean(b.steamcmd, 400);
    if (b.serversDir) cfg.serversDir = path.resolve(clean(b.serversDir, 400));
    save(); return send(res, 200, { ok: true });
  }
  if (p === '/api/steamcmd/install' && m === 'POST') { scErr = ''; installSteamcmd().catch(e => { scErr = e.message; }); return send(res, 200, { ok: true }); }
  if (p === '/api/servers' && m === 'POST') {   // lägg till eller ändra
    const b = await body(req), appId = +b.appId | 0;
    if (!clean(b.name) || appId <= 0) return send(res, 400, { error: 'Namn och Steam app-ID krävs.' });
    let s = cfg.servers.find(x => x.id === b.id);
    if (!s) { s = { id: crypto.randomBytes(4).toString('hex'), pid: 0 }; cfg.servers.push(s); }
    else if (alive(s.pid) && (clean(b.cmd, 2000) !== s.cmd)) return send(res, 400, { error: 'Stoppa servern innan startkommandot ändras.' });
    Object.assign(s, { name: clean(b.name, 60), appId, cmd: clean(b.cmd, 2000), port: portNum(b.port), queryPort: portNum(b.queryPort) });
    if (b.dir !== undefined) s.dir = b.dir ? path.resolve(clean(b.dir, 400)) : '';   // utelämnad vid ändring: mappen behålls
    save(); return send(res, 200, { ok: true, id: s.id });
  }
  const sm = p.match(/^\/api\/servers\/([a-f0-9]{8})(?:\/(start|stop|update|check|log))?$/);
  if (sm) {
    const s = cfg.servers.find(x => x.id === sm[1]); if (!s) return send(res, 404, { error: 'Servern finns inte.' });
    if (!sm[2] && m === 'DELETE') {   // tar bara bort den ur panelen; spelfilerna på disken rörs inte
      if (alive(s.pid)) return send(res, 400, { error: 'Stoppa servern först.' });
      cfg.servers = cfg.servers.filter(x => x !== s); rt.delete(s.id); save(); return send(res, 200, { ok: true });
    }
    if (sm[2] === 'log' && m === 'GET') return send(res, 200, { text: tail(url.searchParams.get('kind') === 'steam' ? steamLog(s) : gameLog(s)) });
    if (m !== 'POST') return send(res, 405, { error: 'Fel metod.' });
    if (sm[2] === 'start') startServer(s);
    else if (sm[2] === 'stop') stopServer(s);
    else if (sm[2] === 'update') { if (alive(s.pid)) throw new Error('Stoppa servern innan den uppdateras.'); updateServer(s).catch(e => { R(s.id).jobText = e.message; }); }
    else if (sm[2] === 'check') checkServer(s).catch(e => { R(s.id).jobText = e.message; });
    else return send(res, 404, { error: 'Okänt kommando.' });
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Finns inte.' });
}
let scErr = '';
http.createServer(async (req, res) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer');
  if (url.pathname.startsWith('/api/')) { try { await api(req, res, url); } catch (e) { if (!res.headersSent) send(res, 400, { error: e.message }); } return; }
  const rel = url.pathname === '/' ? 'index.html' : path.normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, ''), file = path.join(PUB, rel);
  if (!file.startsWith(PUB + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Finns inte'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, BIND, () => {
  console.log(`V.I.C.T.O.R. Server igång.\n  På den här datorn:  http://localhost:${PORT}`);
  for (const a of localIps()) console.log(`  I nätverket:        http://${a.ip}:${PORT}`);
  if (!cfg.pass) console.log('Inget lösenord är valt än: öppna http://localhost:' + PORT + ' på den här datorn och välj ett.');
});

sampleCpu(); sampleNet();
setInterval(sampleCpu, 2000); setInterval(sampleNet, 2000); setInterval(() => sampleServers().catch(() => {}), 8000);
