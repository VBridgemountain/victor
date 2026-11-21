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
// Öppna fönster, som Windows aktivitetsfält visar dem: synliga, egna (inte verktygsfönster) och inte dolda.
// En PowerShell hålls igång i bakgrunden så att listan kan läsas ofta utan att starta ett nytt program varje gång.
const WIN_CS = `
using System; using System.Text; using System.Runtime.InteropServices; using System.Drawing; using System.Drawing.Imaging; using System.Collections.Generic;
public static class VWin {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint c);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
  public static string List() {
    var sb = new StringBuilder(); var fg = GetForegroundWindow();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true;
      if ((GetWindowLong(h, -20) & 0x80) != 0) return true;
      int cl; if (DwmGetWindowAttribute(h, 14, out cl, 4) == 0 && cl != 0) return true;
      int n = GetWindowTextLength(h); if (n == 0) return true;
      var t = new StringBuilder(n + 1); GetWindowText(h, t, n + 1);
      uint pid; GetWindowThreadProcessId(h, out pid);
      sb.Append(h.ToInt64()).Append('\\t').Append(pid).Append('\\t').Append(h == fg ? 1 : 0).Append('\\t').Append(IsIconic(h) ? 1 : 0).Append('\\t').Append(t.ToString().Replace('\\t', ' ').Replace('\\r', ' ').Replace('\\n', ' ')).Append('\\n');
      return true; }, IntPtr.Zero);
    return sb.ToString();
  }
  public static bool Focus(long hw) { var h = new IntPtr(hw); if (IsIconic(h)) ShowWindowAsync(h, 9);
    keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);   // Alt-tryck: låter fönstret ta fokus från bakgrunden
    return SetForegroundWindow(h); }
  public static void Min(long hw) { ShowWindowAsync(new IntPtr(hw), 7); }       // minimera utan att flytta fokus
  public static void Restore(long hw) { ShowWindowAsync(new IntPtr(hw), 9); }
  public static bool Close(long hw) { return PostMessage(new IntPtr(hw), 0x10, IntPtr.Zero, IntPtr.Zero); }   // WM_CLOSE: som att trycka på krysset

  // ---- skärmar, placering och förhandsbilder (i riktiga bildpunkter, oberoende av skalning per skärm)
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] struct MONINFO { public int cb; public RECT mon, work; public uint flags; }
  delegate bool MonProc(IntPtr m, IntPtr dc, ref RECT r, IntPtr d);
  [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr dc, IntPtr clip, MonProc f, IntPtr d);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONINFO i);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT v, int s);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int ht, uint f);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  static void Aware() { SetThreadDpiAwarenessContext(new IntPtr(-4)); }   // per skärm (v2)
  public static string Monitors() {
    Aware(); var sb = new StringBuilder();
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr m, IntPtr dc, ref RECT r, IntPtr d) => {
      var i = new MONINFO(); i.cb = Marshal.SizeOf(typeof(MONINFO)); GetMonitorInfo(m, ref i);
      sb.Append(i.work.L).Append('\\t').Append(i.work.T).Append('\\t').Append(i.work.R - i.work.L).Append('\\t').Append(i.work.B - i.work.T).Append('\\t').Append((i.flags & 1) != 0 ? 1 : 0).Append('\\n');
      return true; }, IntPtr.Zero);
    return sb.ToString();
  }
  public static bool Place(long hw, int x, int y, int w, int ht) {
    Aware(); var h = new IntPtr(hw);
    if (IsIconic(h) || IsZoomed(h)) ShowWindow(h, 9);
    for (int k = 0; k < 2; k++) {   // två varv: ett fönster som byter skärm kan byta skalning och storlek på vägen
      RECT r, e; GetWindowRect(h, out r);
      if (DwmGetWindowAttribute(h, 9, out e, 16) != 0) e = r;   // osynliga kanter runt fönstret räknas bort
      int l = e.L - r.L, t = e.T - r.T, rr = r.R - e.R, b = r.B - e.B;
      SetWindowPos(h, IntPtr.Zero, x - l, y - t, w + l + rr, ht + t + b, 0x0014);
    }
    return true;
  }
  public static bool Thumb(long hw, string file, int maxW) {
    Aware(); var h = new IntPtr(hw); if (IsIconic(h)) return false;
    RECT r, e; GetWindowRect(h, out r); if (DwmGetWindowAttribute(h, 9, out e, 16) != 0) e = r;
    int w = r.R - r.L, ht = r.B - r.T; if (w < 20 || ht < 20 || w > 16000 || ht > 16000) return false;
    using (var bmp = new Bitmap(w, ht, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(bmp)) { var dc = g.GetHdc(); bool ok = PrintWindow(h, dc, 2); g.ReleaseHdc(dc); if (!ok) return false; }
      var crop = new Rectangle(e.L - r.L, e.T - r.T, e.R - e.L, e.B - e.T); crop.Intersect(new Rectangle(0, 0, w, ht)); if (crop.Width < 20 || crop.Height < 20) return false;
      double sc = Math.Min(1.0, (double)maxW / crop.Width); int tw = Math.Max(1, (int)(crop.Width * sc)), th = Math.Max(1, (int)(crop.Height * sc));
      using (var t = new Bitmap(tw, th)) {
        using (var g2 = Graphics.FromImage(t)) { g2.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear; g2.DrawImage(bmp, new Rectangle(0, 0, tw, th), crop, GraphicsUnit.Pixel); }
        var enc = Array.Find(ImageCodecInfo.GetImageEncoders(), c => c.MimeType == "image/jpeg"); var ps = new EncoderParameters(1); ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 72L);
        t.Save(file + ".tmp", enc, ps);
      }
    }
    if (System.IO.File.Exists(file)) System.IO.File.Delete(file); System.IO.File.Move(file + ".tmp", file);
    return true;
  }
}`;
let worker = null;
function psWorker() {   // en PowerShell som tar emot kommandon på rad och svarar med en slutmarkering
  if (worker && !worker.dead) return worker;
  const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'], { windowsHide: true });
  const w = worker = { p, buf: '', q: [], dead: false };
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => { w.buf += d; while (w.q.length) { const { id, res } = w.q[0], k = w.buf.indexOf(id); if (k < 0) break; res(w.buf.slice(0, k)); w.buf = w.buf.slice(k + id.length); w.q.shift(); } });
  p.on('exit', () => { w.dead = true; for (const { res } of w.q) res(''); w.q = []; });
  p.on('error', () => { w.dead = true; });
  const cs = path.join(DIR, 'vwin.cs'); fs.writeFileSync(cs, WIN_CS);
  p.stdin.write(`[Console]::OutputEncoding = [Text.Encoding]::UTF8; Add-Type -ReferencedAssemblies System.Drawing -Path '${cs.replace(/'/g, "''")}'\n`);
  return w;
}
function psRun(script, timeout = 15000) {
  const w = psWorker(), id = '@@SLUT' + crypto.randomBytes(6).toString('hex') + '@@';
  return new Promise(res => {
    const t = setTimeout(() => { try { w.p.kill(); } catch { } res(''); }, timeout);
    w.q.push({ id, res: v => { clearTimeout(t); res(v); } });
    w.p.stdin.write(`try { ${script} } catch { }; [Console]::Out.Write('${id}')\n`);
  });
}
let wins = { list: [], at: 0, busy: null };
const THUMBS = path.join(DIR, 'thumbs'); fs.mkdirSync(THUMBS, { recursive: true });
for (const f of fs.readdirSync(THUMBS)) fs.rmSync(path.join(THUMBS, f), { force: true });   // gamla bilder från förra körningen
// Zoner på en skärm: [vänster, topp, bredd, höjd] som andel av skärmens arbetsyta (utan Windows aktivitetsfält)
const ZONES = { full: [0, 0, 1, 1], left: [0, 0, .5, 1], right: [.5, 0, .5, 1], top: [0, 0, 1, .5], bottom: [0, .5, 1, .5],
  tl: [0, 0, .5, .5], tr: [.5, 0, .5, .5], bl: [0, .5, .5, .5], br: [.5, .5, .5, .5], l3: [0, 0, 1 / 3, 1], m3: [1 / 3, 0, 1 / 3, 1], r3: [2 / 3, 0, 1 / 3, 1] };
let mons = { list: [], at: 0 };
async function monitors() {   // skärmarna numrerade från vänster till höger
  if (Date.now() - mons.at < 10000 && mons.list.length) return mons.list;
  const out = await psRun('[Console]::Out.Write([VWin]::Monitors())', 8000);
  const list = out.split('\n').filter(Boolean).map(l => { const [x, y, w, h, pr] = l.split('\t').map(Number); return { x, y, w, h, primary: pr === 1 }; })
    .filter(m => m.w > 0 && m.h > 0).sort((a, b) => a.x - b.x || a.y - b.y);
  if (list.length) mons = { list, at: Date.now() }; return mons.list;
}
async function loadWindows() {
  if (Date.now() - wins.at < 1500) return wins.list;
  if (!wins.busy) wins.busy = psRun("$o = [VWin]::List(); $ids = @($o -split \"`n\" | Where-Object { $_ } | ForEach-Object { [int]($_.Split(\"`t\")[1]) } | Sort-Object -Unique); " +
      "$pr = @{}; Get-Process -Id $ids -ErrorAction SilentlyContinue | ForEach-Object { $pr[[string]$_.Id] = @{ n = $_.ProcessName; p = $_.Path; m = $_.WorkingSet64 } }; " +
      "[Console]::Out.Write((@{ w = $o; p = $pr } | ConvertTo-Json -Compress -Depth 4))").then(out => {
    let j = {}; try { j = JSON.parse(out); } catch { }
    const procs = j.p || {}, list = [];
    for (const line of String(j.w || '').split('\n')) {
      const [hwnd, pid, fg, mn, ...t] = line.split('\t'), title = t.join(' ').trim(), pr = procs[pid] || {};
      if (!hwnd || !title || title === 'Program Manager' || /^(TextInputHost|ShellExperienceHost|SearchHost|StartMenuExperienceHost)$/i.test(pr.n || '')) continue;
      const uwp = /^ApplicationFrameHost$/i.test(pr.n || '');   // appar från Microsoft Store visas genom ApplicationFrameHost: använd titeln som namn
      list.push({ hwnd: +hwnd, pid: +pid, fg: fg === '1', min: mn === '1', title, name: uwp ? title : (pr.n || 'okänt'), mem: pr.m || 0, icon: uwp ? '' : (pr.p || '') });
    }
    wins = { list, at: Date.now(), busy: null };
    makeIcons(list.map(p => p.icon).filter(Boolean));
    return list;
  }, () => { wins.busy = null; return wins.list; });
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
    if (p === '/thumb' && req.method === 'GET') {   // förhandsbild av ett öppet fönster (tas högst en gång per halvsekund)
      if (!tokenOk(url.searchParams.get('t'))) { res.writeHead(401); return res.end(); }
      const hwnd = +url.searchParams.get('h') || 0, w = (await loadWindows()).find(x => x.hwnd === hwnd);
      if (!w) { res.writeHead(404); return res.end(); }
      const f = path.join(THUMBS, hwnd + '.jpg'), size = Math.min(900, Math.max(160, +url.searchParams.get('w') || 400)), st = fs.existsSync(f) ? fs.statSync(f) : null;
      if (!st || Date.now() - st.mtimeMs > 500) await psRun(`[void][VWin]::Thumb(${hwnd}, '${f.replace(/'/g, "''")}', ${size})`, 8000);
      if (!fs.existsSync(f)) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }); return fs.createReadStream(f).pipe(res);
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
    if (p === '/api/monitors' && req.method === 'GET') return send(res, 200, { monitors: await monitors(), zones: Object.keys(ZONES) });
    if (p === '/api/windows' && req.method === 'GET') return send(res, 200, { windows: await loadWindows() });
    if (req.method !== 'POST') return send(res, 404, { error: 'Finns inte.' });
    const b = await body(req);
    if (p === '/api/launch') {   // startar bara program som finns i Start-menyns lista, aldrig fria kommandon
      const a = (await loadApps()).find(x => x.id === b.id); if (!a) return send(res, 404, { error: 'Programmet finns inte i Start-menyn längre.' });
      spawn('explorer.exe', ['shell:AppsFolder\\' + a.id], { detached: true, stdio: 'ignore' }).unref(); return send(res, 200, { ok: true });
    }
    if (p === '/api/arrange') {   // flytta fönster till skärmzoner enligt regler: [{name, mon, zone}]
      const mons = await monitors(), list = (wins.at = 0, await loadWindows()), only = Array.isArray(b.hwnds) ? new Set(b.hwnds.map(Number)) : null; let placed = 0;
      for (const w of list) {
        const r = (Array.isArray(b.rules) ? b.rules : []).find(x => x && x.name === w.name); if (!r || (only && !only.has(w.hwnd))) continue;
        const m = mons[+r.mon | 0], z = ZONES[r.zone]; if (!m || !z) continue;
        const x = Math.round(m.x + m.w * z[0]), y = Math.round(m.y + m.h * z[1]), ww = Math.round(m.w * z[2]), hh = Math.round(m.h * z[3]);
        await psRun(`[void][VWin]::Place(${w.hwnd}, ${x}, ${y}, ${ww}, ${hh})`, 8000); placed++;
      }
      return send(res, 200, { ok: true, placed });
    }
    if (p === '/api/minimize') {   // minimera alla fönster utom de vars titel börjar med "keep" (appen själv), eller visa dem igen
      wins.at = 0; const list = await loadWindows(), keep = String(b.keep || '').slice(0, 200);
      const pick = Array.isArray(b.restore) ? list.filter(w => b.restore.map(Number).includes(w.hwnd) && w.min)
                                            : list.filter(w => !w.min && !(keep && w.title.startsWith(keep)));
      if (pick.length) await psRun(pick.map(w => `[VWin]::${b.restore ? 'Restore' : 'Min'}(${w.hwnd})`).join('; '), 10000);
      wins.at = 0; return send(res, 200, { ok: true, hwnds: pick.map(w => w.hwnd) });
    }
    if (p === '/api/focus' || p === '/api/close') {   // visa eller stäng ett fönster som finns i listan (inga andra)
      wins.at = 0; const list = await loadWindows(), w = list.find(x => (b.hwnd ? x.hwnd === +b.hwnd : x.pid === (+b.pid | 0)));
      if (!w) return send(res, 404, { error: 'Fönstret är redan stängt.' });
      await psRun(`[void][VWin]::${p === '/api/focus' ? 'Focus' : 'Close'}(${w.hwnd})`, 8000); wins.at = 0;
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'Finns inte.' });
  } catch (e) { if (!res.headersSent) send(res, 400, { error: e.message }); }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`V.I.C.T.O.R. datorbrygga igång.\n  Öppna http://127.0.0.1:${PORT} i webbläsaren för att se kopplingskoden.`);
  loadApps();
}).on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'Bryggan är redan igång (port ' + PORT + ' används).' : e.message); process.exit(1); });

process.on('exit', () => { try { worker && worker.p.kill(); } catch { } });
