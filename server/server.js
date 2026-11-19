#!/usr/bin/env node
// V.I.C.T.O.R. Server — agent som körs på den dedikerade servern.
// Visar system, nätverk och lyssnande portar, och sköter spelservrar via SteamCMD (installera, uppdatera, starta, stoppa).
// Inga beroenden: bara Node.js (18.15 eller nyare). Start:  node server.js   → panelen finns på http://<serverns-ip>:8787
'use strict';
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), os = require('os'),
      crypto = require('crypto'), dgram = require('dgram'), { spawn, execFile } = require('child_process');

const WIN = process.platform === 'win32', SERVICE = process.argv.includes('--service');   // --service: startad av autostarten, utan fönster
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
let cpuPrev = null, cpuPct = 0, cpuAvg = 0;   // cpuAvg: utjämnat över ungefär en minut, för varningar
function sampleCpu() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) { for (const k in c.times) total += c.times[k]; idle += c.times.idle; }
  if (cpuPrev && total > cpuPrev.total) cpuPct = 100 * (1 - (idle - cpuPrev.idle) / (total - cpuPrev.total));
  cpuPrev = { idle, total }; cpuAvg += (cpuPct - cpuAvg) * 0.07;
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
  { key: 'valheim', name: 'Valheim', appId: 896660, port: 2456, queryPort: 2457, backup: 'saves',
    win: 'valheim_server.exe -nographics -batchmode -name "Min server" -port 2456 -world "Dedicated" -password "byt-mig" -public 0 -savedir "saves"',
    linux: './valheim_server.x86_64 -nographics -batchmode -name "Min server" -port 2456 -world "Dedicated" -password "byt-mig" -public 0 -savedir "saves"' },
  { key: 'cs2', name: 'Counter-Strike 2', appId: 730, port: 27015, queryPort: 27015,
    win: 'game\\bin\\win64\\cs2.exe -dedicated -port 27015 +map de_dust2',
    linux: './game/bin/linuxsteamrt64/cs2 -dedicated -port 27015 +map de_dust2' },
  { key: 'palworld', name: 'Palworld', appId: 2394010, port: 8211, queryPort: 0, backup: 'Pal/Saved',
    win: 'PalServer.exe -port=8211', linux: './PalServer.sh -port=8211' },
  { key: 'rust', name: 'Rust', appId: 258550, port: 28015, queryPort: 28016, backup: 'server',
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
  if (R(s.id).job) throw new Error('Vänta tills pågående arbete (SteamCMD eller säkerhetskopia) är klart.');
  if (!s.cmd) throw new Error('Inget startkommando är angivet.');
  if (!fs.existsSync(sdir(s))) throw new Error('Servern är inte installerad än.');
  // Utskriften styrs till loggfilen av skalet självt. På Linux får servern ett eget processträd och fortsätter gå om
  // agenten startas om. På Windows går det inte ihop med loggning (en fristående process tappar sin utskrift), så där
  // delar servern konsol med agenten: stängs agentens fönster med Ctrl+C kan spelservrarna följa med.
  const child = spawn(`${s.cmd} > "${gameLog(s)}" 2>&1`, { cwd: sdir(s), shell: true, detached: !WIN, windowsHide: true, stdio: 'ignore' });
  child.on('error', () => {}); child.unref();
  s.pid = child.pid; s.startedAt = Date.now(); s.wanted = true; R(s.id).query = null; save();   // wanted: ska vara igång, så ett oväntat stopp kan upptäckas
}
function stopServer(s) {
  s.wanted = false;
  if (!alive(s.pid)) { s.pid = 0; save(); return; }
  const pid = s.pid, r = R(s.id); r.stopping = true; save();
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
const a2s = port => a2sAsk(port, Buffer.concat([Buffer.from([255, 255, 255, 255, 0x54]), Buffer.from('Source Engine Query\0')]), 0x49, b => {
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
    if (s.pid && !alive(s.pid)) { s.pid = 0; r.stopping = false; r.query = r.players = null; save(); if (s.wanted && !r.job) crashed(s); }
    if (s.pid && s.queryPort) { r.query = await a2s(s.queryPort); r.players = r.query ? await a2sPlayers(s.queryPort) : null; }
  }
}
function serverView(s) {
  const r = R(s.id), running = alive(s.pid), installed = installedBuild(s);
  return { id: s.id, name: s.name, appId: s.appId, cmd: s.cmd, port: s.port, queryPort: s.queryPort, dir: sdir(s),
    ready: fs.existsSync(sdir(s)), running, stopping: !!r.stopping && running, startedAt: running ? s.startedAt : 0, pid: running ? s.pid : 0,
    online: running && !!r.query, query: running ? r.query || null : null, players: running && r.query ? r.players || null : null,
    job: r.job || null, jobText: r.jobText || '', installed, latest: r.latest || null, checkedAt: r.checkedAt || 0,
    updateAvailable: !!(installed && r.latest && installed !== r.latest),
    autostart: !!s.autostart, autorestart: !!s.autorestart, autoUpdate: !!s.autoUpdate, restartAt: s.restartAt >= 0 ? s.restartAt : -1,
    backupDir: s.backupDir || '', backupAt: s.backupAt >= 0 ? s.backupAt : -1, backupKeep: s.backupKeep || 7, lastBackup: s.lastBackup || 0, backups: listBackups(s).length };
}

// En spelserver som skulle vara igång har stannat. Med "starta om vid krasch" startas den igen, högst tre gånger på 15 minuter.
function crashed(s) {
  const r = R(s.id), now = Date.now(); r.crashes = (r.crashes || []).filter(t => now - t < 900000); r.crashes.push(now);
  if (cfg.maintenance) return event(`${s.name} har stannat (underhållsläge, startas inte om).`, 'info', 'crash');
  if (s.autorestart && r.crashes.length <= 3) {
    event(`${s.name} stannade oväntat och startas om.`, 'warn', 'crash');
    setTimeout(() => { try { if (!alive(s.pid) && s.wanted) startServer(s); } catch (e) { event(`${s.name} kunde inte startas om: ${e.message}`, 'bad', 'crash'); } }, 10000);
  } else event(`${s.name} har stannat oväntat` + (s.autorestart ? ' flera gånger i rad och startas inte om automatiskt.' : '.'), 'bad', 'crash');
}
// Väntar tills en server har stängts (högst en minut)
const stopAndWait = async s => { stopServer(s); for (let i = 0; i < 60 && alive(s.pid); i++) await new Promise(r => setTimeout(r, 1000)); s.pid = alive(s.pid) ? s.pid : 0; };

// ------------------------------------------------------------------ säkerhetskopior av spelvärldar
// Mappen som ska sparas anges per server (relativt till serverns mapp). Kopiorna packas med tar, som finns i både Windows 10+ och Linux.
const BACKUPS = path.join(DATA, 'backups');
const bkSrc = s => s.backupDir ? path.resolve(sdir(s), s.backupDir) : null;
const bkDir = s => path.join(BACKUPS, s.id);
const runP = (cmd, args, timeout = 3600000) => new Promise((ok, fail) => execFile(cmd, args, { windowsHide: true, timeout, maxBuffer: 8 << 20 },
  (e, out, err) => e ? fail(new Error(String(err || e.message).trim().split(/\r?\n/).slice(-2).join(' ').slice(0, 300) || 'misslyckades')) : ok(out)));
const stamp = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };
function listBackups(s) {
  try { return fs.readdirSync(bkDir(s)).filter(f => f.endsWith('.tar.gz')).map(f => { const st = fs.statSync(path.join(bkDir(s), f)); return { name: f, size: st.size, time: st.mtimeMs }; })
    .sort((a, b) => b.time - a.time); } catch { return []; }
}
async function backupServer(s, why = '') {
  const src = bkSrc(s), r = R(s.id);
  if (!src) throw new Error('Ingen mapp att säkerhetskopiera är vald för servern.');
  if (!fs.existsSync(src)) throw new Error('Mappen finns inte än: ' + src);
  if (r.job) throw new Error('Servern är upptagen just nu.');
  fs.mkdirSync(bkDir(s), { recursive: true });
  const file = path.join(bkDir(s), stamp() + (why ? '-' + why : '') + '.tar.gz');
  r.job = 'backup';
  try { await runP('tar', ['-czf', file, '-C', path.dirname(src), path.basename(src)]); }
  catch (e) { fs.rmSync(file, { force: true }); throw new Error('Säkerhetskopian misslyckades: ' + e.message); }
  finally { r.job = null; }
  const keep = Math.max(1, s.backupKeep || 7);
  for (const b of listBackups(s).slice(keep)) fs.rmSync(path.join(bkDir(s), b.name), { force: true });
  s.lastBackup = Date.now(); save();
  return path.basename(file);
}
async function restoreServer(s, name) {
  const b = listBackups(s).find(x => x.name === name), src = bkSrc(s), r = R(s.id);
  if (!b) throw new Error('Säkerhetskopian finns inte.');
  if (!src) throw new Error('Ingen mapp att säkerhetskopiera är vald för servern.');
  if (alive(s.pid)) throw new Error('Stoppa servern innan du återställer.');
  if (r.job) throw new Error('Servern är upptagen just nu.');
  r.job = 'restore';
  const old = src + '.fore-aterstallning';   // det som fanns innan sparas en gång, så att en återställning går att ångra för hand
  try {
    fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(src)) fs.renameSync(src, old);
    try { await runP('tar', ['-xzf', path.join(bkDir(s), b.name), '-C', path.dirname(src)]); }
    catch (e) { fs.rmSync(src, { recursive: true, force: true }); if (fs.existsSync(old)) fs.renameSync(old, src); throw new Error('Återställningen misslyckades, inget är ändrat: ' + e.message); }
  } finally { r.job = null; }
  event(`${s.name} återställdes till säkerhetskopian ${b.name}.`, 'info', 'info');
}

// ------------------------------------------------------------------ händelser och notiser till telefonen
// Allt viktigt skrivs till events.log (visas i panelen) och kan skickas som notis via ntfy och/eller Discord.
const EVENTS = path.join(LOGS, 'events.log');
let notifyErr = '';
// Typer: crash (spelserver stannar eller startar inte), system (disk, minne), jobs (säkerhetskopia, uppdatering),
// online (servern igång igen, omstart från panelen), info (automatiska starter, uppdateringar, återställningar).
const KINDS = { crash: true, system: true, jobs: true, online: true, info: false };
const wants = kind => { const e = (cfg.notify && cfg.notify.events) || {}; return e[kind] != null ? !!e[kind] : KINDS[kind]; };
function event(text, level = 'info', kind = 'info') {
  fs.appendFile(EVENTS, `${new Date().toISOString()}\t${level}\t${text.replace(/[\r\n\t]/g, ' ')}\n`, () => {});
  if (wants(kind) && !(cfg.maintenance && kind !== 'online')) notify(text, level).catch(() => {});   // underhållsläge: tyst, utom start/omstart av datorn
}
async function notify(text, level = 'info') {
  const n = cfg.notify || {}, title = os.hostname() + ' · ' + (level === 'bad' ? 'Åtgärd behövs' : level === 'warn' ? 'Varning' : 'Info'), jobs = [];
  const post = (url, obj) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj), signal: AbortSignal.timeout(10000) })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); });
  if (n.ntfy && n.ntfyOn !== false) { const u = new URL(n.ntfy); jobs.push(post(u.origin, { topic: u.pathname.replace(/^\/+|\/+$/g, ''), title, message: text,
    priority: level === 'bad' ? 5 : level === 'warn' ? 4 : 3, tags: [level === 'bad' ? 'rotating_light' : level === 'warn' ? 'warning' : 'information_source'] })); }
  if (n.discord && n.discordOn !== false) jobs.push(post(n.discord, { username: 'V.I.C.T.O.R. Server', content: `**${title}**\n${text}` }));
  if (!jobs.length) return;
  try { await Promise.all(jobs); notifyErr = ''; } catch (e) { notifyErr = e.message; throw e; }
}
const recentEvents = (n = 30) => tail(EVENTS, n).split('\n').filter(Boolean).reverse().map(l => { const [t, level, text] = l.split('\t'); return { t, level, text }; });

// Systemvarningar (disk, minne, processor) som både widgeten och notiserna använder
function sysAlerts(d) {
  const mem = 1 - os.freemem() / os.totalmem(), a = [], add = (level, text, key) => a.push({ level, text, key });
  if (d && d.free / d.total < 0.05) add('bad', `Disken är nästan full: ${Math.round(d.free / 1e9)} GB ledigt.`, 'disk');
  else if (d && d.free / d.total < 0.12) add('warn', `Det börjar bli ont om diskutrymme: ${Math.round(d.free / 1e9)} GB ledigt.`, 'disk');
  if (mem > 0.93) add('bad', `Minnet är nästan slut (${Math.round(mem * 100)} % används).`, 'mem'); else if (mem > 0.85) add('warn', `Högt minnestryck (${Math.round(mem * 100)} % används).`, 'mem');
  if (cpuAvg > 90) add('warn', `Processorn har legat på ${Math.round(cpuAvg)} % en längre stund.`, 'cpu');
  return a;
}
const alerted = new Set();
async function watchSystem() {   // meddelar en allvarlig systemvarning en gång, och igen först när den har gått över
  const bad = sysAlerts(await disk()).filter(x => x.level === 'bad');
  for (const x of bad) if (!alerted.has(x.key)) { alerted.add(x.key); event(x.text, 'bad', 'system'); }
  for (const k of [...alerted]) if (!bad.some(x => x.key === k)) alerted.delete(k);
}

// ------------------------------------------------------------------ schema: daglig omstart, säkerhetskopia och uppdatering
const ran = new Map();   // vad som redan körts i dag, så att inget körs två gånger
const today = () => new Date().toDateString();
async function scheduler() {
  if (cfg.maintenance) return;
  const now = new Date(), hr = now.getHours();
  for (const s of cfg.servers) {
    const once = (what, fn) => { const k = s.id + what; if (ran.get(k) === today()) return; ran.set(k, today()); fn().catch(e => event(`${s.name}: ${e.message}`, 'bad', 'jobs')); };
    if (s.backupAt >= 0 && s.backupAt === hr && s.backupDir) once('backup', async () => { await backupServer(s, 'daglig'); });
    if (s.restartAt >= 0 && s.restartAt === hr && alive(s.pid)) once('restart', async () => { await stopAndWait(s); startServer(s); event(`${s.name} startades om enligt schemat.`, 'info', 'info'); });
    if (s.autoUpdate && hr === (s.restartAt >= 0 ? s.restartAt : 5)) once('update', () => autoUpdate(s));
  }
}
async function autoUpdate(s) {   // uppdaterar bara när ingen spelar; tar en säkerhetskopia först
  const r = R(s.id);
  await checkServer(s); const v = serverView(s);
  if (!v.updateAvailable) return;
  if (v.running && v.query && v.query.players > 0) { event(`${s.name} har en uppdatering men ${v.query.players} spelar just nu. Försöker igen i morgon.`, 'warn', 'jobs'); return; }
  const was = v.running;
  if (s.backupDir) await backupServer(s, 'fore-uppdatering');
  if (was) await stopAndWait(s);
  await updateServer(s);
  if (r.jobText !== 'Klar') throw new Error('uppdateringen misslyckades: ' + r.jobText);
  if (was) { s.wanted = true; startServer(s); }
  event(`${s.name} uppdaterades till build ${installedBuild(s)}.`, 'info', 'info');
}

// ------------------------------------------------------------------ datorn: start, avbrott, omstart och avstängning
// Agenten skriver en livstecken-fil varje minut. Vid start jämförs den med datorns starttid för att se hur länge servern var nere och varför.
const HEART = path.join(DATA, 'heartbeat'), bootTime = Date.now() - os.uptime() * 1000, agentStart = Date.now();
let power = { bootTime, agentStart, downFrom: 0, reason: '' };
function startup() {
  let last = 0; try { last = +fs.readFileSync(HEART, 'utf8') || 0; } catch { }
  const planned = cfg.plannedPower && Date.now() - cfg.plannedPower.at < 30 * 60000 ? cfg.plannedPower : null;
  delete cfg.plannedPower;
  for (const s of cfg.servers) if (s.pid && (s.startedAt || 0) < bootTime) s.pid = 0;   // processnummer från före omstarten gäller inte längre
  save();
  const fmt = t => new Date(t).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
  if (last && bootTime > last) {
    power = { bootTime, agentStart, downFrom: last, reason: planned ? (planned.action === 'restart' ? 'omstart från panelen' : 'avstängning från panelen') : 'oväntad omstart, t.ex. strömavbrott eller Windows-uppdatering' };
    event(`Servern är igång igen. Den var nere från ${fmt(last)} till ${fmt(bootTime)} (${power.reason}).`, planned ? 'info' : 'warn', 'online');
  } else if (last && Date.now() - last > 180000) {
    power = { bootTime, agentStart, downFrom: last, reason: 'programmet var stoppat' };
    event(`V.I.C.T.O.R. Server startades igen efter att ha varit stoppad sedan ${fmt(last)}.`, 'info', 'online');
  }
  // spelservrar som ska starta med datorn, eller som var igång och ska startas om
  const due = cfg.servers.filter(s => !alive(s.pid) && fs.existsSync(sdir(s)) && (s.autostart || (s.wanted && s.autorestart)));
  if (due.length) setTimeout(() => { const ok = [];
    for (const s of due) try { startServer(s); ok.push(s.name); } catch (e) { event(`${s.name} kunde inte startas: ${e.message}`, 'bad', 'crash'); }
    if (ok.length) event('Startade automatiskt: ' + ok.join(', ') + '.', 'info', 'info'); }, 15000);
}
const beat = () => fs.writeFile(HEART, String(Date.now()), () => {});
// Startar agenten automatiskt med datorn? (Windows: schemalagd uppgift, Linux: systemd-tjänst)
let autostart = { on: null, at: 0 };
async function checkAutostart() {
  if (Date.now() - autostart.at < 300000 && autostart.on != null) return autostart.on;
  const on = WIN ? await new Promise(r => execFile('schtasks', ['/Query', '/TN', 'VICTOR Server'], { windowsHide: true }, e => r(!e)))
                 : (await run('systemctl', ['is-enabled', 'victor-server'])).trim() === 'enabled';
  autostart = { on, at: Date.now() }; return on;
}
let isAdmin = null;
async function adminRights() {
  if (isAdmin != null) return isAdmin;
  isAdmin = WIN ? await new Promise(r => execFile('net', ['session'], { windowsHide: true }, e => r(!e))) : process.getuid && process.getuid() === 0;
  return isAdmin;
}
async function setAutostart(on) {
  if (!(await adminRights())) throw new Error(WIN ? 'Programmet saknar administratörsbehörighet. Kör ' + (on ? 'installera-autostart.cmd' : 'ta-bort-autostart.cmd') + ' på serverdatorn en gång; därefter går det att ändra här.'
                                                  : 'Kräver root. Kör sudo sh autostart-linux.sh' + (on ? '' : ' --remove') + ' på serverdatorn.');
  if (WIN) await runP('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'autostart-windows.ps1'), '-Quiet', ...(on ? [] : ['-Remove'])], 120000);
  else await runP('sh', [path.join(ROOT, 'autostart-linux.sh'), ...(on ? [] : ['--remove'])], 120000);
  autostart.at = 0; event(on ? 'Autostart med datorn slogs på från panelen.' : 'Autostart med datorn stängdes av från panelen.', 'info', 'info');
}
function powerAction(action) {
  cfg.plannedPower = { action, at: Date.now() }; save();
  event(action === 'restart' ? 'Datorn startas om från panelen.' : 'Datorn stängs av från panelen.', 'info', 'online');
  for (const s of cfg.servers) if (alive(s.pid)) { const w = s.wanted; stopServer(s); s.wanted = w; }   // "wanted" behålls, så att de startar igen efteråt
  save();
  setTimeout(() => {
    const [cmd, args] = WIN ? ['shutdown', [action === 'restart' ? '/r' : '/s', '/t', '5', '/c', 'V.I.C.T.O.R. Server']]
                            : ['systemctl', [action === 'restart' ? 'reboot' : 'poweroff']];
    execFile(cmd, args, { windowsHide: true }, e => { if (e) { delete cfg.plannedPower; save(); event('Datorn kunde inte ' + (action === 'restart' ? 'startas om' : 'stängas av') + ': ' + e.message, 'bad', 'online'); } });
  }, 4000);
}
const macs = () => Object.entries(os.networkInterfaces()).flatMap(([name, l]) => l.filter(a => !a.internal && a.family === 'IPv4' && a.mac && a.mac !== '00:00:00:00:00:00').map(a => ({ name, ip: a.address, mac: a.mac })));

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

// ------------------------------------------------------------------ labbet: kodprojekt, terminal, anslutningar
const PROJ = path.join(DATA, 'projects');
function labPath(rel) {   // allt i labbet håller sig inom projektmappen
  const p = path.resolve(PROJ, String(rel || '').replace(/\0/g, ''));
  if (p !== PROJ && !p.startsWith(PROJ + path.sep)) throw new Error('Ogiltig sökväg.');
  return p;
}
function labTree() {
  fs.mkdirSync(PROJ, { recursive: true });
  let left = 1500;
  const walk = (dir, rel) => fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '__pycache__')
    .sort((a, b) => b.isDirectory() - a.isDirectory() || a.name.localeCompare(b.name))
    .flatMap(e => { if (left-- <= 0) return [];
      const r = rel ? rel + '/' + e.name : e.name;
      return e.isDirectory() ? [{ path: r, dir: true }, ...walk(path.join(dir, e.name), r)] : e.isFile() ? [{ path: r }] : []; });
  return fs.readdirSync(PROJ, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => ({ name: e.name, files: walk(path.join(PROJ, e.name), '') }));
}
// Kommandoterminal: ett skal med rörledningar (ingen riktig tty, så helskärmsprogram som vim fungerar inte).
const terms = new Map();
function termStart(project) {
  const cwd = labPath(project); if (!fs.existsSync(cwd)) throw new Error('Projektet finns inte.');
  if (terms.size >= 4) termKill(terms.keys().next().value);
  const id = crypto.randomBytes(6).toString('hex');
  const env = { ...process.env, TERM: 'dumb', PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' };   // rätt åäö och utskrift direkt från Python
  const p = WIN ? spawn('cmd.exe', ['/Q', '/K', 'chcp 65001>nul'], { cwd, windowsHide: true, env })
                : spawn('bash', ['--noprofile', '--norc'], { cwd, detached: true, env });
  const t = { p, buf: '', subs: new Set(), alive: true };
  const out = d => { const s = d.toString('utf8').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''); t.buf = (t.buf + s).slice(-60000);
    for (const r of t.subs) r.write(`data: ${JSON.stringify(s)}\n\n`); };
  p.stdout.on('data', out); p.stderr.on('data', out); p.on('error', e => out('\n[' + e.message + ']\n'));
  p.on('exit', () => { t.alive = false; out('\n[terminalen avslutades]\n'); for (const r of t.subs) r.end(); terms.delete(id); });
  terms.set(id, t); return id;
}
function termKill(id) {
  const t = terms.get(id); if (!t) return;
  if (WIN) execFile('taskkill', ['/PID', String(t.p.pid), '/T', '/F'], { windowsHide: true }, () => {});
  else try { process.kill(-t.p.pid, 'SIGKILL'); } catch { }
}
process.on('exit', () => { for (const id of terms.keys()) termKill(id); });
let toolsCache = null;
async function labTools() {   // vilka språk och verktyg som finns installerade på den här maskinen
  if (toolsCache && Date.now() - toolsCache.at < 60000) return toolsCache.v;
  const ver = async (cmd, args = ['--version']) => { const o = await run(cmd, args, { timeout: 6000, shell: WIN }); const m = o.match(/\d+\.\d+(\.\d+)?/); return o.trim() ? (m ? m[0] : 'finns') : null; };
  const [py3, py, node, gpp, gcc, git, ard] = await Promise.all([ver('python3'), ver('python'), ver('node'), ver('g++'), ver('gcc'), ver('git'), ver('arduino-cli', ['version'])]);
  const v = { python: py3 ? { cmd: 'python3', v: py3 } : py ? { cmd: 'python', v: py } : null, node: node && { cmd: 'node', v: node },
    'g++': gpp && { cmd: 'g++', v: gpp }, gcc: gcc && { cmd: 'gcc', v: gcc }, git: git && { cmd: 'git', v: git }, 'arduino-cli': ard && { cmd: 'arduino-cli', v: ard } };
  toolsCache = { at: Date.now(), v }; return v;
}
async function serialPorts() {   // inkopplade kort (Arduino, ESP32 …) syns som serieportar
  if (WIN) return (await run('powershell', ['-NoProfile', '-Command',
    "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | ForEach-Object { $_.Name }"])).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const out = [];
  try { for (const n of fs.readdirSync('/dev/serial/by-id')) out.push(n + ' → ' + path.basename(fs.realpathSync('/dev/serial/by-id/' + n))); } catch { }
  if (!out.length) try { for (const n of fs.readdirSync('/dev')) if (/^tty(USB|ACM)\d+$/.test(n)) out.push('/dev/' + n); } catch { }
  return out;
}
const tcpCheck = (host, port) => new Promise(res => {   // går det att ansluta till en enhet eller tjänst?
  const t0 = Date.now(), s = require('net').connect({ host, port, timeout: 3000 });
  const end = (ok, why) => { s.destroy(); res({ ok, why, ms: Date.now() - t0 }); };
  s.on('connect', () => end(true, 'öppen')); s.on('timeout', () => end(false, 'inget svar'));
  s.on('error', e => end(false, e.code === 'ECONNREFUSED' ? 'stängd (nekad)' : e.code === 'ENOTFOUND' ? 'okänd adress' : e.code || 'fel'));
});
async function labApi(req, res, url, m) {
  const p = url.pathname, q = url.searchParams;
  if (p === '/api/lab/tree' && m === 'GET') return send(res, 200, { projects: labTree(), root: PROJ });
  if (p === '/api/lab/tools' && m === 'GET') return send(res, 200, { tools: await labTools(), serial: await serialPorts(), platform: WIN ? 'win' : 'linux' });
  if (p === '/api/lab/file' && m === 'GET') {
    const f = labPath(q.get('path')), st = fs.statSync(f);
    if (st.size > 1 << 20) return send(res, 400, { error: 'Filen är för stor för redigeraren (över 1 MB).' });
    const b = fs.readFileSync(f); if (b.includes(0)) return send(res, 400, { error: 'Filen är inte en textfil.' });
    return send(res, 200, { text: b.toString('utf8') });
  }
  if (p === '/api/lab/term/stream' && m === 'GET') {
    const t = terms.get(q.get('id')); if (!t) return send(res, 404, { error: 'Terminalen finns inte.' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    res.write(`data: ${JSON.stringify(t.buf)}\n\n`); t.subs.add(res); req.on('close', () => t.subs.delete(res)); return;
  }
  if (m !== 'POST') return send(res, 404, { error: 'Finns inte.' });
  const b = await body(req, 2 << 20);
  if (p === '/api/lab/file') { const f = labPath(b.path); if (f === PROJ) throw new Error('Ogiltig sökväg.');
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, String(b.text == null ? '' : b.text)); return send(res, 200, { ok: true }); }
  if (p === '/api/lab/project') { const n = clean(b.name, 40); if (!/^[\p{L}\p{N} _-]+$/u.test(n)) throw new Error('Namnet får bara innehålla bokstäver, siffror, mellanslag, - och _.');
    const d = labPath(n); if (fs.existsSync(d)) throw new Error('Det finns redan ett projekt med det namnet.'); fs.mkdirSync(d, { recursive: true }); return send(res, 200, { ok: true }); }
  if (p === '/api/lab/delete') { const f = labPath(b.path); if (f === PROJ) throw new Error('Ogiltig sökväg.'); fs.rmSync(f, { recursive: true, force: true }); return send(res, 200, { ok: true }); }
  if (p === '/api/lab/term') return send(res, 200, { id: termStart(b.project) });
  if (p === '/api/lab/term/input') { const t = terms.get(b.id); if (!t || !t.alive) return send(res, 404, { error: 'Terminalen är avslutad.' }); t.p.stdin.write(String(b.text).slice(0, 4000) + '\n'); return send(res, 200, { ok: true }); }
  if (p === '/api/lab/term/kill') { termKill(b.id); return send(res, 200, { ok: true }); }
  if (p === '/api/lab/check') { const host = clean(b.host, 120), port = portNum(b.port);
    if (!/^[a-z0-9.:-]+$/i.test(host) || !port) throw new Error('Ange adress och port.'); return send(res, 200, await tcpCheck(host, port)); }
  send(res, 404, { error: 'Finns inte.' });
}

// ------------------------------------------------------------------ inloggning
const sessions = new Map();   // token → utgångstid
const cookieTok = req => (/(?:^|;\s*)victor=([a-f0-9]{48})/.exec(req.headers.cookie || '') || [])[1];
const authed = req => { const t = cookieTok(req), e = t && sessions.get(t); if (!e) return false; if (e < Date.now()) { sessions.delete(t); return false; } return true; };
// Bakom en tunnel eller omvänd proxy (Cloudflare Tunnel, Tailscale Funnel, nginx) kommer alla anrop från den egna maskinen.
// Då står besökarens riktiga adress i ett huvud, och anropet räknas inte som lokalt.
const loopback = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const fwd = req => req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
const isLocal = req => loopback(req) && !fwd(req);
const clientIp = req => clean((loopback(req) && fwd(req)) || req.socket.remoteAddress || '?', 60);
const isHttps = req => !!req.socket.encrypted || (loopback(req) && req.headers['x-forwarded-proto'] === 'https');
function newSession(req, res) {
  const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, Date.now() + 30 * 864e5);
  res.setHeader('Set-Cookie', `victor=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 86400}${isHttps(req) ? '; Secure' : ''}`);
}
// Spärr per besökare: fem fel ger en minuts väntan, och väntan fördubblas för varje ny omgång (högst en timme).
const tries = new Map();
function locked(ip) { const t = tries.get(ip); return t && t.until > Date.now() ? Math.ceil((t.until - Date.now()) / 1000) : 0; }
function failed(ip) { const t = tries.get(ip) || { n: 0, rounds: 0, until: 0 };
  if (++t.n >= 5) { t.n = 0; t.until = Date.now() + Math.min(3600, 60 * 2 ** t.rounds++) * 1000; }
  tries.set(ip, t); if (tries.size > 5000) tries.delete(tries.keys().next().value); }
const ACCESS = path.join(LOGS, 'access.log');
const logAccess = (req, what) => fs.appendFile(ACCESS, `${new Date().toISOString()}\t${clientIp(req)}\t${what}\n`, () => {});
// Tvåstegsinloggning (TOTP, samma som Google Authenticator, Microsoft Authenticator, Aegis m.fl.)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = buf => { let bits = '', out = ''; for (const x of buf) bits += x.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
const b32dec = s => { let bits = ''; for (const c of s) bits += B32.indexOf(c).toString(2).padStart(5, '0'); return Buffer.from((bits.match(/.{8}/g) || []).map(b => parseInt(b, 2))); };
function totpAt(secret, step) { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', b32dec(secret)).update(c).digest(), o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0'); }
function totpOk(secret, code) { code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return false;
  const now = Math.floor(Date.now() / 30000); return [-1, 0, 1].some(d => crypto.timingSafeEqual(Buffer.from(totpAt(secret, now + d)), Buffer.from(code))); }
let totpPending = null;

// ------------------------------------------------------------------ spelhallen: egna spelfiler som spelas i webbläsaren
// Emulatorn (EmulatorJS) körs i en egen webbadress (porten efter panelens), skild från panelen, så att emulatorns kod
// aldrig kan nå panelens inloggning. Spelfilerna hämtas dit med en tidsbegränsad nyckel i adressen.
const ROMS = path.join(DATA, 'roms'), APORT = +(process.env.VICTOR_ARCADE_PORT || PORT + 1);
const SYSTEMS = [
  { key: 'psx', name: 'PlayStation', exts: ['chd', 'pbp', 'iso', 'bin', 'cue', 'img'] },
  { key: 'n64', name: 'Nintendo 64', exts: ['z64', 'n64', 'v64'] },
  { key: 'snes', name: 'Super Nintendo', exts: ['sfc', 'smc'] },
  { key: 'nes', name: 'Nintendo (NES)', exts: ['nes'] },
  { key: 'gba', name: 'Game Boy Advance', exts: ['gba'] },
  { key: 'gb', name: 'Game Boy / Color', exts: ['gb', 'gbc'] },
  { key: 'nds', name: 'Nintendo DS', exts: ['nds'] },
  { key: 'segaMD', name: 'Sega Mega Drive', exts: ['md', 'gen', 'smd', 'bin'] },
  { key: 'segaMS', name: 'Sega Master System', exts: ['sms'] },
  { key: 'segaGG', name: 'Sega Game Gear', exts: ['gg'] },
  { key: 'atari2600', name: 'Atari 2600', exts: ['a26'] },
];
if (!cfg.secret) { cfg.secret = crypto.randomBytes(32).toString('hex'); save(); }
const sign = s => crypto.createHmac('sha256', cfg.secret).update(s).digest('base64url');
const romToken = rel => { const b = Buffer.from(JSON.stringify({ p: rel, e: Date.now() + 12 * 3600e3 })).toString('base64url'); return b + '.' + sign(b); };
function romFromToken(tok) { const [b, sig] = String(tok).split('.'); if (!b || !sig || sig.length !== sign(b).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(b)))) return null;
  try { const j = JSON.parse(Buffer.from(b, 'base64url')); return j.e > Date.now() ? j.p : null; } catch { return null; } }
const romName = n => { const s = path.basename(String(n || '')).replace(/[^\p{L}\p{N} ._()\[\]!&',+-]/gu, '_').trim().slice(0, 120); return /^[^.]/.test(s) ? s : ''; };
function romPath(system, name) { const sys = SYSTEMS.find(s => s.key === system), n = romName(name);
  if (!sys || !n) throw new Error('Okänt system eller filnamn.');
  const ext = n.split('.').pop().toLowerCase(); if (![...sys.exts, 'zip', '7z'].includes(ext)) throw new Error(`Filtypen .${ext} hör inte till ${sys.name}.`);
  return path.join(ROMS, sys.key, n); }
function arcadeList() {
  const games = [];
  for (const s of SYSTEMS) { let files = []; try { files = fs.readdirSync(path.join(ROMS, s.key)); } catch { }
    for (const f of files.sort((a, b) => a.localeCompare(b))) { const ext = f.split('.').pop().toLowerCase(); if (ext === 'cue' || ![...s.exts, 'zip', '7z'].includes(ext)) continue;
      games.push({ system: s.key, name: f, size: fs.statSync(path.join(ROMS, s.key, f)).size, token: romToken(s.key + '/' + f) }); } }
  let bios = []; try { bios = fs.readdirSync(path.join(ROMS, 'bios')).filter(f => /\.bin$/i.test(f)).map(f => ({ system: f.replace(/\.bin$/i, ''), token: romToken('bios/' + f) })); } catch { }
  return { systems: SYSTEMS, games, bios, port: APORT, url: cfg.arcadeUrl || '', root: ROMS };
}
function arcadeUpload(req, res, url) {   // tar emot filen som en ström rakt till disk
  const f = romPath(url.searchParams.get('system'), url.searchParams.get('name')), tmp = f + '.del';
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const w = fs.createWriteStream(tmp); let n = 0, dead = false;
  const fail = msg => { if (dead) return; dead = true; w.destroy(); fs.rm(tmp, { force: true }, () => {}); if (!res.headersSent) send(res, 400, { error: msg }); req.destroy(); };
  req.on('data', c => { n += c.length; if (n > 4 * 2 ** 30) fail('Filen är större än 4 GB.'); });
  req.on('aborted', () => fail('Uppladdningen avbröts.')); w.on('error', e => fail(e.message));
  req.pipe(w); w.on('finish', () => { if (dead) return; fs.renameSync(tmp, f); send(res, 200, { ok: true }); });
}
function arcadeServer(req, res) {   // spelarens egen adress: bara spelarsidan och spelfiler med giltig nyckel
  let url; try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  if (url.pathname === '/player.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache',
      'Content-Security-Policy': "default-src 'self' https://cdn.emulatorjs.org blob: data: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob:" });
    return fs.createReadStream(path.join(ROOT, 'arcade', 'player.html')).pipe(res);
  }
  const m = url.pathname.match(/^\/rom\/([\w.-]+)\//), rel = m && romFromToken(m[1]), file = rel && path.join(ROMS, rel);
  if (!file || !file.startsWith(ROMS + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Finns inte'); }
  res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'private, max-age=3600' });
  fs.createReadStream(file).pipe(res);
}

// ------------------------------------------------------------------ http
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const body = (req, max = 65536) => new Promise((ok, fail) => { let d = ''; req.on('data', c => { d += c; if (d.length > max) { fail(new Error('För stor förfrågan.')); req.destroy(); } });
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
    steamcmd: { path: steamcmdPath(), installing: scInstall, error: scErr }, serversDir: cfg.serversDir, arcadePort: APORT,
    power: { ...power, autostart: await checkAutostart(), service: SERVICE, macs: macs() }, events: recentEvents(12), totpOn: !!cfg.totp,
    notify: (n => ({ ntfy: n.ntfy || '', ntfyOn: n.ntfyOn !== false, discord: !!n.discord, discordName: n.discordName || '', discordOn: n.discordOn !== false,
      events: Object.fromEntries(Object.keys(KINDS).map(k => [k, wants(k)])), error: notifyErr }))(cfg.notify || {}),
    maintenance: !!cfg.maintenance, admin: await adminRights(),
  };
}
// Översikt för V.I.C.T.O.R.-widgeten på dator och telefon: bara läsning, med en egen läsnyckel i stället för inloggning.
// Det som behöver åtgärdas samlas i "alerts" (level: 'bad' = åtgärd behövs, 'warn' = håll koll).
async function summary(req) {
  const d = await disk(), mem = 1 - os.freemem() / os.totalmem(), alerts = sysAlerts(d).map(({ level, text }) => ({ level, text })), add = (level, text) => alerts.push({ level, text });
  if (Date.now() - agentStart < 3600000 && power.downFrom && power.reason !== 'programmet var stoppat') add('warn', `Servern startades nyss igen efter ${power.reason}.`);
  const servers = cfg.servers.map(s => { const v = serverView(s);
    if (s.wanted && !v.running) add('bad', `${v.name} har stannat oväntat.`);
    else if (v.running && v.queryPort && !v.online && Date.now() - v.startedAt > 180000) add('warn', `${v.name} är igång men svarar inte på statusförfrågan.`);
    if (v.updateAvailable) add('warn', `${v.name} har en uppdatering att installera.`);
    if (v.jobText && v.jobText !== 'Klar' && !v.job) add('warn', `${v.name}: ${v.jobText}`);
    return { name: v.name, running: v.running, online: v.online, busy: !!v.job || v.stopping, players: v.query ? v.query.players : null, max: v.query ? v.query.max : null, port: v.port, update: v.updateAvailable }; });
  if (!cfg.totp && loopback(req) && fwd(req)) add('warn', 'Servern nås via nätet utan tvåstegsinloggning.');
  publicIp();
  return { host: os.hostname(), platform: WIN ? 'Windows' : 'Linux', uptime: os.uptime(), time: Date.now(), cpu: Math.round(cpuPct), mem: Math.round(mem * 100),
    disk: d ? { free: d.free, total: d.total } : null, net: { rxRate: Math.round(net.rxRate), txRate: Math.round(net.txRate), publicIp: pubIp.ip, local: localIps().map(a => a.ip) },
    ports: ports.list.filter(x => !x.local).length, servers, alerts };
}
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (p === '/api/summary') {   // nås från en annan webbadress (skrivbordsappen), därför egna CORS-huvuden och nyckel i stället för kaka
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Authorization'); res.setHeader('Access-Control-Max-Age', '600');
    if (m === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (m !== 'GET') return send(res, 405, { error: 'Fel metod.' });
    const ip = clientIp(req), key = Buffer.from((req.headers.authorization || '').replace(/^Bearer\s+/i, '')), want = Buffer.from(cfg.readKey || '');
    if (locked(ip)) return send(res, 429, { error: 'För många försök. Vänta en stund.' });
    if (!cfg.readKey) return send(res, 403, { error: 'Ingen läsnyckel är skapad på servern.' });
    if (key.length !== want.length || !crypto.timingSafeEqual(key, want)) { failed(ip); return send(res, 401, { error: 'Fel läsnyckel.' }); }
    return send(res, 200, await summary(req));
  }
  if (m !== 'GET') {   // skydd mot att en annan webbsida skickar kommandon via din inloggade webbläsare
    const o = req.headers.origin; if (o && new URL(o).host !== req.headers.host) return send(res, 403, { error: 'Fel ursprung.' });
    if (p === '/api/arcade/upload') { if (!o) return send(res, 403, { error: 'Fel ursprung.' }); }   // filuppladdning: rå data, men bara från panelens egen sida
    else if (!/^application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'JSON krävs.' });
  }
  if (p === '/api/session' && m === 'GET') return send(res, 200, { setup: !cfg.pass, authed: authed(req), local: isLocal(req), totp: !!cfg.totp });
  if (p === '/api/setup' && m === 'POST') {
    if (cfg.pass) return send(res, 400, { error: 'Ett lösenord finns redan.' });
    if (!isLocal(req)) return send(res, 403, { error: 'Första lösenordet måste väljas på servern själv (http://localhost:' + PORT + '), eller med: node server.js --set-password <lösenord>' });
    const b = await body(req); if (clean(b.password).length < 8) return send(res, 400, { error: 'Minst 8 tecken.' });
    cfg.pass = hashPw(String(b.password)); save(); newSession(req, res); return send(res, 200, { ok: true });
  }
  if (p === '/api/login' && m === 'POST') {
    const ip = clientIp(req), wait = locked(ip);
    if (wait) return send(res, 429, { error: `För många försök. Vänta ${wait > 90 ? Math.ceil(wait / 60) + ' minuter' : wait + ' sekunder'}.` });
    const b = await body(req);
    if (!checkPw(b.password || '') || (cfg.totp && !totpOk(cfg.totp, b.code))) { failed(ip); logAccess(req, 'misslyckad inloggning');
      return send(res, 401, { error: cfg.totp ? 'Fel lösenord eller kod.' : 'Fel lösenord.' }); }
    tries.delete(ip); logAccess(req, 'inloggad'); newSession(req, res); return send(res, 200, { ok: true });
  }
  if (!authed(req)) return send(res, 401, { error: 'Inte inloggad.' });
  if (p === '/api/security' && m === 'GET') return send(res, 200, { totp: !!cfg.totp, https: isHttps(req), viaProxy: loopback(req) && !!fwd(req), you: clientIp(req),
    recent: tail(ACCESS, 12).split('\n').filter(Boolean).reverse(), arcadeUrl: cfg.arcadeUrl || '', readKey: cfg.readKey || '' });
  if (p === '/api/readkey' && m === 'POST') { const b = await body(req);
    if (b.action === 'off') delete cfg.readKey; else cfg.readKey = crypto.randomBytes(24).toString('base64url');
    save(); logAccess(req, b.action === 'off' ? 'läsnyckel borttagen' : 'ny läsnyckel'); return send(res, 200, { readKey: cfg.readKey || '' }); }
  if (p === '/api/2fa/start' && m === 'POST') { totpPending = b32enc(crypto.randomBytes(20));
    return send(res, 200, { secret: totpPending, uri: `otpauth://totp/V.I.C.T.O.R.%20Server:${encodeURIComponent(os.hostname())}?secret=${totpPending}&issuer=V.I.C.T.O.R.%20Server` }); }
  if (p === '/api/2fa/enable' && m === 'POST') { const b = await body(req);
    if (!totpPending || !totpOk(totpPending, b.code)) return send(res, 400, { error: 'Koden stämmer inte. Kontrollera att klockan i telefonen går rätt och försök igen.' });
    cfg.totp = totpPending; totpPending = null; save(); logAccess(req, 'tvåstegsinloggning påslagen'); return send(res, 200, { ok: true }); }
  if (p === '/api/2fa/disable' && m === 'POST') { const b = await body(req);
    if (!checkPw(b.password || '')) return send(res, 401, { error: 'Fel lösenord.' });
    delete cfg.totp; save(); logAccess(req, 'tvåstegsinloggning avstängd'); return send(res, 200, { ok: true }); }
  if (p === '/api/arcade/list' && m === 'GET') return send(res, 200, arcadeList());
  if (p === '/api/arcade/upload' && m === 'POST') return arcadeUpload(req, res, url);
  if (p === '/api/arcade/delete' && m === 'POST') { const b = await body(req); fs.rmSync(romPath(b.system, b.name), { force: true }); return send(res, 200, { ok: true }); }
  if (p === '/api/logout' && m === 'POST') { sessions.delete(cookieTok(req)); return send(res, 200, { ok: true }); }
  if (p === '/api/status' && m === 'GET') return send(res, 200, await status());
  if (p.startsWith('/api/lab/')) return labApi(req, res, url, m);
  if (p === '/api/settings' && m === 'POST') {
    const b = await body(req);
    if (b.steamcmd != null) cfg.steamcmd = clean(b.steamcmd, 400);
    if (b.serversDir) cfg.serversDir = path.resolve(clean(b.serversDir, 400));
    if (b.arcadeUrl != null) { const u = clean(b.arcadeUrl, 200).replace(/\/+$/, ''); if (u && !/^https?:\/\/[\w.:-]+$/.test(u)) throw new Error('Spelhallens adress ska se ut som https://namn.exempel.se'); cfg.arcadeUrl = u; }
    save(); return send(res, 200, { ok: true });
  }
  if (p === '/api/notify' && m === 'POST') {   // notisinställningar
    const b = await body(req), n = cfg.notify = cfg.notify || {};
    if (b.ntfyOn != null) n.ntfyOn = !!b.ntfyOn;
    if (b.discordOn != null) n.discordOn = !!b.discordOn;
    if (b.events && typeof b.events === 'object') { n.events = n.events || {}; for (const k of Object.keys(KINDS)) if (b.events[k] != null) n.events[k] = !!b.events[k]; }
    if (b.ntfy != null) { const u = clean(b.ntfy, 300); if (u && !/^https:\/\/[\w.-]+(:\d+)?\/[\w-]{6,64}\/?$/.test(u)) throw new Error('ntfy-adressen ska se ut som https://ntfy.sh/ditt-hemliga-amne'); n.ntfy = u; }
    if (b.discord != null) { const u = clean(b.discord, 300); if (u && !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(u)) throw new Error('Det ser inte ut som en Discord-webhook.');
      if (u) {   // fråga Discord om webhooken finns, och spara dess namn så att panelen kan visa vart notiserna går
        const r = await fetch(u, { signal: AbortSignal.timeout(10000) }).catch(() => null);
        if (!r || !r.ok) throw new Error('Discord känner inte igen webhooken. Kontrollera att adressen är hela och att webhooken inte är borttagen.');
        const j = await r.json().catch(() => ({})); n.discordName = String(j.name || 'webhook').slice(0, 60); n.discordOn = true;
      } else delete n.discordName;
      n.discord = u; }
    if (b.all != null) n.all = !!b.all;
    save();
    if (b.test) { try { await notify('Testnotis från V.I.C.T.O.R. Server. Notiserna fungerar.', 'info'); } catch (e) { throw new Error('Notisen gick inte fram: ' + e.message); } }
    return send(res, 200, { ok: true });
  }
  if (p === '/api/power' && m === 'POST') {   // starta om eller stäng av datorn: kräver lösenordet (och koden) igen
    const b = await body(req), ip = clientIp(req);
    if (locked(ip)) return send(res, 429, { error: 'För många försök. Vänta en stund.' });
    if (!checkPw(b.password || '') || (cfg.totp && !totpOk(cfg.totp, b.code))) { failed(ip); return send(res, 401, { error: cfg.totp ? 'Fel lösenord eller kod.' : 'Fel lösenord.' }); }
    if (!['restart', 'shutdown'].includes(b.action)) return send(res, 400, { error: 'Okänd åtgärd.' });
    logAccess(req, b.action === 'restart' ? 'omstart av datorn' : 'avstängning av datorn'); powerAction(b.action);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/drift' && m === 'POST') {   // underhållsläge och autostart
    const b = await body(req);
    if (b.maintenance != null) { cfg.maintenance = !!b.maintenance; save(); event(cfg.maintenance ? 'Underhållsläge påslaget: ingen automatisk omstart eller schemalagt arbete.' : 'Underhållsläge avslaget.', 'info', 'info'); }
    if (b.autostart != null) await setAutostart(!!b.autostart);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/events' && m === 'GET') return send(res, 200, { events: recentEvents(200) });
  if (p === '/api/steamcmd/install' && m === 'POST') { scErr = ''; installSteamcmd().catch(e => { scErr = e.message; }); return send(res, 200, { ok: true }); }
  if (p === '/api/servers' && m === 'POST') {   // lägg till eller ändra
    const b = await body(req), appId = +b.appId | 0;
    if (!clean(b.name) || appId <= 0) return send(res, 400, { error: 'Namn och Steam app-ID krävs.' });
    let s = cfg.servers.find(x => x.id === b.id);
    if (!s) { s = { id: crypto.randomBytes(4).toString('hex'), pid: 0 }; cfg.servers.push(s); }
    else if (alive(s.pid) && (clean(b.cmd, 2000) !== s.cmd)) return send(res, 400, { error: 'Stoppa servern innan startkommandot ändras.' });
    Object.assign(s, { name: clean(b.name, 60), appId, cmd: clean(b.cmd, 2000), port: portNum(b.port), queryPort: portNum(b.queryPort) });
    if (b.dir !== undefined) s.dir = b.dir ? path.resolve(clean(b.dir, 400)) : '';   // utelämnad vid ändring: mappen behålls
    const hour = v => { const n = parseInt(v, 10); return n >= 0 && n <= 23 ? n : -1; };
    if (b.backupDir !== undefined) { const d = clean(b.backupDir, 300); if (/(^|[\\/])\.\.([\\/]|$)/.test(d)) throw new Error('Mappen för säkerhetskopior får inte gå uppåt med ..'); s.backupDir = d; }
    for (const k of ['autostart', 'autorestart', 'autoUpdate']) if (b[k] !== undefined) s[k] = !!b[k];
    if (b.restartAt !== undefined) s.restartAt = hour(b.restartAt);
    if (b.backupAt !== undefined) s.backupAt = hour(b.backupAt);
    if (b.backupKeep !== undefined) s.backupKeep = Math.min(100, Math.max(1, parseInt(b.backupKeep, 10) || 7));
    save(); return send(res, 200, { ok: true, id: s.id });
  }
  const sm = p.match(/^\/api\/servers\/([a-f0-9]{8})(?:\/(start|stop|update|check|log|backups|backup|restore))?$/);
  if (sm) {
    const s = cfg.servers.find(x => x.id === sm[1]); if (!s) return send(res, 404, { error: 'Servern finns inte.' });
    if (!sm[2] && m === 'PATCH') { const b = await body(req); for (const k of ['autostart', 'autorestart', 'autoUpdate']) if (b[k] != null) s[k] = !!b[k]; save(); return send(res, 200, { ok: true }); }
    if (!sm[2] && m === 'DELETE') {   // tar bara bort den ur panelen; spelfilerna på disken rörs inte
      if (alive(s.pid)) return send(res, 400, { error: 'Stoppa servern först.' });
      cfg.servers = cfg.servers.filter(x => x !== s); rt.delete(s.id); save(); return send(res, 200, { ok: true });
    }
    if (sm[2] === 'log' && m === 'GET') return send(res, 200, { text: tail(url.searchParams.get('kind') === 'steam' ? steamLog(s) : gameLog(s)) });
    if (sm[2] === 'backups' && m === 'GET') return send(res, 200, { backups: listBackups(s), source: bkSrc(s) || '' });
    if (sm[2] === 'backup' && m === 'POST') { const name = await backupServer(s, 'manuell'); return send(res, 200, { ok: true, name }); }
    if (sm[2] === 'restore' && m === 'POST') { const b = await body(req); await restoreServer(s, String(b.name || '')); return send(res, 200, { ok: true }); }
    if (m !== 'POST') return send(res, 405, { error: 'Fel metod.' });
    if (sm[2] === 'start') startServer(s);
    else if (sm[2] === 'stop') stopServer(s);
    else if (sm[2] === 'update') { if (alive(s.pid)) throw new Error('Stoppa servern innan den uppdateras.');
      (async () => { if (s.backupDir && fs.existsSync(bkSrc(s))) await backupServer(s, 'fore-uppdatering').catch(e => event(`${s.name}: ${e.message}`, 'warn', 'jobs')); await updateServer(s); })().catch(e => { R(s.id).jobText = e.message; }); }
    else if (sm[2] === 'check') checkServer(s).catch(e => { R(s.id).jobText = e.message; });
    else return send(res, 404, { error: 'Okänt kommando.' });
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Finns inte.' });
}
let scErr = '';
// Egen HTTPS: lägg cert.pem och key.pem i data/tls. Annars vanlig HTTP (bakom VPN eller en tunnel som sköter HTTPS).
let tls = null; try { tls = { cert: fs.readFileSync(path.join(DATA, 'tls', 'cert.pem')), key: fs.readFileSync(path.join(DATA, 'tls', 'key.pem')) }; } catch { }
const mkServer = fn => tls ? https.createServer(tls, fn) : http.createServer(fn), SCHEME = tls ? 'https' : 'http';
mkServer(arcadeServer).listen(APORT, BIND).on('error', e => console.error('Spelhallen kunde inte starta på port ' + APORT + ': ' + e.message));
mkServer(async (req, res) => {
  let url; try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer');
  if (url.pathname.startsWith('/api/')) { try { await api(req, res, url); } catch (e) { if (!res.headersSent) send(res, 400, { error: e.message }); } return; }
  const rel = url.pathname === '/' ? 'index.html' : path.normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, ''), file = path.join(PUB, rel);
  if (!file.startsWith(PUB + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Finns inte'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, BIND, () => {
  console.log(`V.I.C.T.O.R. Server igång.\n  På den här datorn:  ${SCHEME}://localhost:${PORT}`);
  for (const a of localIps()) console.log(`  I nätverket:        ${SCHEME}://${a.ip}:${PORT}`);
  console.log(`  Spelhallens spelare använder port ${APORT}.`);
  if (!cfg.pass) console.log('Inget lösenord är valt än: öppna ' + SCHEME + '://localhost:' + PORT + ' på den här datorn och välj ett.');
});

sampleCpu(); sampleNet(); startup(); beat();
setInterval(sampleCpu, 2000); setInterval(sampleNet, 2000); setInterval(() => sampleServers().catch(() => {}), 8000);
setInterval(beat, 60000); setInterval(() => scheduler().catch(() => {}), 60000); setInterval(() => watchSystem().catch(() => {}), 300000);
