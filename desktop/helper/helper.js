#!/usr/bin/env node
// V.I.C.T.O.R. datorbrygga — litet hjälpprogram för Windows som låter V.I.C.T.O.R. i webbläsaren
// se datorns installerade program, starta dem och visa vilka fönster som är öppna.
// En webbsida får inte göra det själv, så bryggan körs lokalt och svarar bara den här datorn (127.0.0.1).
//
//   node helper.js                 startar bryggan (öppna sedan http://127.0.0.1:8770 för kopplingskoden)
//   node helper.js --autostart     startar bryggan automatiskt när du loggar in i Windows
//   node helper.js --no-autostart  tar bort autostarten
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), { execFile, spawn } = require('child_process');

if (process.platform !== 'win32') { console.error('Datorbryggan är gjord för Windows.'); process.exit(1); }
const PORT = +(process.env.VICTOR_HELPER_PORT || 8770);
const DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), 'victor-brygga'), ICONS = path.join(DIR, 'icons');
fs.mkdirSync(ICONS, { recursive: true });
const CFG = path.join(DIR, 'config.json');
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch { }
if (!cfg.token) { cfg.token = crypto.randomBytes(18).toString('base64url'); fs.writeFileSync(CFG, JSON.stringify(cfg)); }
// Bara V.I.C.T.O.R.s egna adresser får anropa bryggan från en webbläsare. Lägg till fler med VICTOR_HELPER_ORIGINS (kommaseparerat).
const ORIGINS = new Set(['https://vbridgemountain.github.io', 'http://localhost:8765', 'http://127.0.0.1:8765',
  ...(process.env.VICTOR_HELPER_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)]);

const STARTUP = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'victor-brygga.vbs');
if (process.argv.includes('--autostart')) {   // dolt fönster vid inloggning
  fs.writeFileSync(STARTUP, `CreateObject("WScript.Shell").Run """${process.execPath}"" ""${__filename}""", 0, False\r\n`);
  console.log('Bryggan startar nu automatiskt vid inloggning.\n' + STARTUP); process.exit(0);
}
if (process.argv.includes('--no-autostart')) { fs.rmSync(STARTUP, { force: true }); console.log('Autostarten är borttagen.'); process.exit(0); }

const ps = (script, args = [], timeout = 30000) => new Promise(res => {
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' + script, ...args], { windowsHide: true, timeout, maxBuffer: 16 << 20 }, (e, out) => res(e ? '' : String(out)));
});
const arr = s => { try { const j = JSON.parse(s || '[]'); return Array.isArray(j) ? j : [j]; } catch { return []; } };
const iconFile = key => path.join(ICONS, crypto.createHash('sha1').update(key.toLowerCase()).digest('hex') + '.png');

// Installerade program: samma lista som Start-menyn (både vanliga program och appar från Microsoft Store)
let apps = { list: [], at: 0, busy: null };
async function loadApps() {
  if (apps.list.length && Date.now() - apps.at < 300000) return apps.list;
  if (!apps.busy) apps.busy = ps('Get-StartApps | Sort-Object Name | Select-Object Name, AppID | ConvertTo-Json -Compress').then(out => {
    const seen = new Set(), list = [];
    for (const a of arr(out)) { if (!a.Name || !a.AppID || seen.has(a.AppID) || /uninstall|avinstallera/i.test(a.Name)) continue; seen.add(a.AppID); list.push({ id: a.AppID, name: a.Name }); }
    if (list.length) apps = { list, at: Date.now(), busy: null }; else apps.busy = null;
    makeIcons(list.map(a => 'shell:AppsFolder\\' + a.id));
    return apps.list;
  });
  return apps.busy;
}
// Öppna fönster: processer som har ett synligt huvudfönster
let wins = { list: [], at: 0, busy: null };
async function loadWindows() {
  if (Date.now() - wins.at < 3000) return wins.list;
  if (!wins.busy) wins.busy = ps("Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, MainWindowTitle, Path, @{n='Mem';e={$_.WorkingSet64}} | ConvertTo-Json -Compress", [], 15000).then(out => {
    const list = arr(out).filter(p => p.MainWindowTitle && !/^(TextInputHost|ApplicationFrameHost|SystemSettings)$/i.test(p.ProcessName))
      .map(p => ({ pid: p.Id, name: p.ProcessName, title: p.MainWindowTitle, mem: p.Mem || 0, icon: p.Path || '' }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.title.localeCompare(b.title));
    wins = { list, at: Date.now(), busy: null };
    makeIcons(list.map(p => p.icon).filter(Boolean));
    return list;
  });
  return wins.busy;
}
// Ikoner hämtas från Windows på samma sätt som Utforskaren gör, och sparas som PNG. Körs i bakgrunden, några åt gången.
const ICON_PS = `
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class VIcon {
  [StructLayout(LayoutKind.Sequential)] public struct SIZE { public int cx, cy; }
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  public static bool Save(string item, string file) {
    try {
      IShellItemImageFactory f; SHCreateItemFromParsingName(item, IntPtr.Zero, new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), out f);
      IntPtr h; SIZE s; s.cx = 64; s.cy = 64; if (f.GetImage(s, 0, out h) != 0) return false;
      using (Bitmap b = Image.FromHbitmap(h)) {
        Rectangle r = new Rectangle(0, 0, b.Width, b.Height); BitmapData d = b.LockBits(r, ImageLockMode.ReadOnly, b.PixelFormat);
        using (Bitmap a = new Bitmap(b.Width, b.Height, d.Stride, PixelFormat.Format32bppArgb, d.Scan0)) using (Bitmap o = new Bitmap(a)) { o.Save(file, ImageFormat.Png); }
        b.UnlockBits(d);
      }
      DeleteObject(h); return true;
    } catch { return false; }
  }
}
'@
foreach ($l in [IO.File]::ReadAllLines($args[0])) { $p = $l.Split("\`t"); if ($p.Length -eq 2) { [void][VIcon]::Save($p[0], $p[1]) } }`;
const iconQueue = new Set(); let iconBusy = false;
function makeIcons(keys) {
  for (const k of keys) if (!fs.existsSync(iconFile(k))) iconQueue.add(k);
  if (iconBusy || !iconQueue.size) return;
  iconBusy = true;
  const batch = [...iconQueue].slice(0, 60), list = path.join(DIR, 'icons.txt');
  fs.writeFileSync(list, batch.map(k => k + '\t' + iconFile(k)).join('\r\n'), 'utf8');
  const script = path.join(DIR, 'icons.ps1'); fs.writeFileSync(script, ICON_PS);
  new Promise(res => execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, list], { windowsHide: true, timeout: 120000 }, () => res())).then(() => {
    for (const k of batch) { iconQueue.delete(k); if (!fs.existsSync(iconFile(k))) fs.writeFileSync(iconFile(k), ''); }   // tom fil = ingen ikon fanns, försök inte igen
    iconBusy = false; makeIcons([]);
  });
}

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise((ok, fail) => { let d = ''; req.on('data', c => { d += c; if (d.length > 8192) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { fail(new Error('Ogiltig JSON.')); } }); });
const tokenOk = t => { const a = Buffer.from(String(t || '')), b = Buffer.from(cfg.token); return a.length === b.length && crypto.timingSafeEqual(a, b); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname, o = req.headers.origin;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (o) {   // anrop från en webbsida: bara V.I.C.T.O.R. släpps in
    if (!ORIGINS.has(o)) { res.writeHead(403); return res.end(); }
    res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Private-Network', 'true'); res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  try {
    if (p === '/' && req.method === 'GET' && !o) {   // sidan med kopplingskoden, bara för den som sitter vid datorn
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' });
      return res.end(`<!DOCTYPE html><html lang="sv"><meta charset="utf-8"><title>V.I.C.T.O.R. datorbrygga</title>
<body style="background:#02060b;color:#cfe6ef;font:16px 'Segoe UI',sans-serif;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center;max-width:520px;padding:20px">
<h1 style="font:600 15px Consolas,monospace;letter-spacing:.4em;color:#00d8ff">V.I.C.T.O.R. DATORBRYGGA</h1><p>Bryggan är igång. Klistra in den här koden i V.I.C.T.O.R. under Inställningar → Datorbrygga:</p>
<p id="t" style="font:600 20px Consolas,monospace;color:#fff;user-select:all;overflow-wrap:anywhere">${cfg.token}</p>
<button onclick="navigator.clipboard.writeText(document.getElementById('t').textContent).then(()=>this.textContent='Kopierad')" style="font:inherit;padding:8px 18px;background:#04303c;color:#fff;border:1px solid #00d8ff;cursor:pointer">Kopiera koden</button>
<p style="color:#7fa3b3;font-size:13px">Koden låter V.I.C.T.O.R. i din webbläsare starta program och se öppna fönster på den här datorn. Dela den inte.</p></div></body></html>`);
    }
    if (p === '/icon' && req.method === 'GET') {   // bilder kan inte skicka huvuden, så koden ligger i adressen
      if (!tokenOk(url.searchParams.get('t'))) { res.writeHead(401); return res.end(); }
      const f = iconFile(String(url.searchParams.get('k') || ''));
      if (!fs.existsSync(f) || !fs.statSync(f).size) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400' }); return fs.createReadStream(f).pipe(res);
    }
    if (!p.startsWith('/api/')) { res.writeHead(404); return res.end(); }
    if (!tokenOk((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) return send(res, 401, { error: 'Fel kopplingskod.' });
    if (p === '/api/ping' && req.method === 'GET') return send(res, 200, { ok: true, host: os.hostname() });
    if (p === '/api/apps' && req.method === 'GET') return send(res, 200, { apps: await loadApps() });
    if (p === '/api/windows' && req.method === 'GET') return send(res, 200, { windows: await loadWindows() });
    if (req.method !== 'POST') return send(res, 404, { error: 'Finns inte.' });
    const b = await body(req);
    if (p === '/api/launch') {   // startar bara program som finns i Start-menyns lista, aldrig fria kommandon
      const a = (await loadApps()).find(x => x.id === b.id); if (!a) return send(res, 404, { error: 'Programmet finns inte i Start-menyn längre.' });
      spawn('explorer.exe', ['shell:AppsFolder\\' + a.id], { detached: true, stdio: 'ignore' }).unref(); return send(res, 200, { ok: true });
    }
    if (p === '/api/focus') {   // lyfter fram ett öppet fönster
      const pid = +b.pid | 0; if (!(await loadWindows()).some(w => w.pid === pid)) return send(res, 404, { error: 'Fönstret är stängt.' });
      ps(`[void](New-Object -ComObject WScript.Shell).AppActivate(${pid})`, [], 8000); return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'Finns inte.' });
  } catch (e) { if (!res.headersSent) send(res, 400, { error: e.message }); }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`V.I.C.T.O.R. datorbrygga igång.\n  Öppna http://127.0.0.1:${PORT} i webbläsaren för att se kopplingskoden.`);
  loadApps();
}).on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'Bryggan är redan igång (port ' + PORT + ' används).' : e.message); process.exit(1); });
