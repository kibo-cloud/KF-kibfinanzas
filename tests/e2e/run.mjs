// Dependency-free headless-browser E2E for TuGasto (Node >= 22, ESM). Run: npm run test:e2e
// Exit codes: 0 all pass, 1 failure, 2 skipped (no browser found).
//
// Safety/design:
//  - The site is COPIED to a fresh temp dir; the repo is never written to.
//  - The test hook (window.__kf) is injected into the COPY of index.html only.
//  - Date is pinned (in the COPY only) to 2026-10-04T12:00:00 local by a tiny script placed at
//    the very start of <head>, because the checks assume "today" is in October (month index 9).
//    The subclass keeps Date.now(), new Date() and new Date(args) working.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const UI = createRequire(import.meta.url)('../ui-textos.js');   // the jargon / English word lists the L2 checks share with the unit test

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MARKER = '})();\n</script>';
const HOOK = 'window.__kf={get D(){return D},get mes(){return mes},calc:calc,serie:serie,ranking:ranking,datosTorta:datosTorta,guardar:guardar,activarSaldos:activarSaldos,armarCopia:armarCopia,restaurarTexto:restaurarTexto,get pendiente(){return pendiente},get obsoleta(){return obsoleta},set obsoleta(v){obsoleta=v},get sucio(){return sucio},set sucio(v){sucio=v},APPVER:APPVER,exportarCSV:exportarCSV,patrimonio:patrimonio,patrimonioPantalla:patrimonioPantalla,hoyApp:hoyApp,fARS:fARS,fUSD:fUSD,plain:function(x){return JSON.parse(JSON.stringify(x))}};\n})();\n</script>';
const DATE_PIN = '<script>(function(){var R=Date,T=new R(2026,9,4,12,0,0).getTime();' +
  'class FD extends R{constructor(...a){if(a.length===0)super(T);else super(...a);}static now(){return T;}}' +
  'window.Date=FD;' +
  'document.addEventListener("securitypolicyviolation",function(e){if(window.__cspProbe){window.__cspProbe.push(e.violatedDirective);return;}setTimeout(function(){throw new Error("CSP violation: "+e.violatedDirective+" "+e.blockedURI);});});' +
  '})();</script>';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.css': 'text/css; charset=utf-8' };

function findBrowser(){
  const c = [process.env.TUGASTO_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
  return c.find(p => p && fs.existsSync(p));
}

// L8: the sha256 of every executable inline script (as the browser hashes it: CRLF/CR read as LF), written into script-src
function hashesDe(html){
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g, out = []; let m;
  while((m = re.exec(html))) if(!/type="application\/json"/.test(m[1] || '')) out.push(`'sha256-${crypto.createHash('sha256').update(m[2].replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`);
  return out;
}
function conHashes(html){
  const n = html.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*script-src )[^;"]*/, (t, a) => a + "'self' " + hashesDe(html).join(' '));
  if(n === html) throw new Error('script-src not found in the CSP meta');
  return n;
}
// Copies the site into dir, injects hook + date pin into the COPY, returns the APPVER declared in the repo's index.html.
function prepareSite(dir){
  for(const f of fs.readdirSync(ROOT)){
    if(/\.png$/.test(f) || ['index.html', 'sw.js', 'manifest.webmanifest', 'privacidad.html'].includes(f)) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  const original = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const k = original.lastIndexOf(MARKER);
  if(k < 0) throw new Error('hook marker not found in index.html: ' + JSON.stringify(MARKER));
  let html = original.slice(0, k) + HOOK + original.slice(k + MARKER.length);
  if(html.indexOf('<head>') < 0) throw new Error('<head> not found in index.html');
  html = html.replace('<head>', '<head>' + DATE_PIN);
  html = conHashes(html);   // L8: the hook changes the app script, so the COPY's CSP lists the hashes of its own scripts (the real ones: tests/l8.csp.test.js)
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'real.html'), original);   // L8/L9: the unmodified build, to prove it runs under its own CSP
  const m = /var APPVER\s*=\s*'([^']+)'/.exec(original);
  if(!m) throw new Error('APPVER not found in index.html');
  return m[1];
}

function serve(dir){
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if(p === '/') p = '/index.html';
    const f = path.join(dir, path.normalize(p));
    if(!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

const tmpDirs = []; let srv = null, br = null, ws = null, PORT = 0;
const pageErrs = []; let id = 0; const pend = new Map();
const results = []; let fails = 0;
const CDP_TIMEOUT_MS = 15000;
// Every CDP call rejects after CDP_TIMEOUT_MS and when the socket errors or closes, so a hung browser fails the run instead of hanging it.
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  const t = setTimeout(() => { pend.delete(i); rej(new Error(`CDP timeout (${CDP_TIMEOUT_MS} ms): ${method}`)); }, CDP_TIMEOUT_MS);
  pend.set(i, { res: m => { clearTimeout(t); res(m); }, rej: e => { clearTimeout(t); rej(e); } });
  try{ ws.send(JSON.stringify({ id: i, method, params })); }catch(e){ clearTimeout(t); pend.delete(i); rej(e); }
});
function failPending(err){ for(const [i, p] of pend){ pend.delete(i); p.rej(err); } }
const loadWaiters = [];
// resolves on the next Page.loadEventFired (register BEFORE navigating)
const nextLoad = () => new Promise((res, rej) => {
  const w = { res: () => { clearTimeout(t); res(); } };
  const t = setTimeout(() => { const k = loadWaiters.indexOf(w); if(k >= 0) loadWaiters.splice(k, 1); rej(new Error(`page load timeout (${CDP_TIMEOUT_MS} ms)`)); }, CDP_TIMEOUT_MS);
  loadWaiters.push(w);
});
async function ev(expr){
  const r = await send('Runtime.evaluate', { expression: '(function(){with(window.__kf||{}){return eval(' + JSON.stringify(expr) + ')}})()', returnByValue: true, awaitPromise: true });
  if(r.result.exceptionDetails) throw new Error(expr + ' -> ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result.result.value;
}
let URL_APP = '';
async function nav(u){ const loaded = nextLoad(); await send('Page.navigate', { url: u }); await loaded; await sleep(300); }   // load event + a short settle for the app's own start-up timers
// Condition wait: polls expr until its value equals want or ms pass; returns the last value seen, so check() reports it on a failure.
async function waitFor(expr, want, ms = 4000, evf = ev){
  const end = Date.now() + ms;
  for(;;){ const v = await evf(expr); if(JSON.stringify(v) === JSON.stringify(want) || Date.now() > end) return v; await sleep(50); }
}
let total = 0;
function check(name, got, want){ total++; const ok = JSON.stringify(got) === JSON.stringify(want); if(!ok) fails++; results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : ' want=' + JSON.stringify(want)}`); }

async function connect(userDir){
  let port = 0;
  for(let t = 0; t < 100 && !port; t++){
    try{ port = parseInt(fs.readFileSync(path.join(userDir, 'DevToolsActivePort'), 'utf8').split('\n')[0], 10) || 0; }catch{}
    if(!port) await sleep(200);
  }
  if(!port) throw new Error('browser did not publish DevToolsActivePort');
  PORT = port;
  for(let t = 0; t < 50 && !ws; t++){
    try{
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find(x => x.type === 'page');
      if(p) ws = new WebSocket(p.webSocketDebuggerUrl);
    }catch{}
    if(!ws) await sleep(200);
  }
  if(!ws) throw new Error('could not find a page target');
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('websocket error')); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if(m.method === 'Runtime.exceptionThrown') pageErrs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if(m.method === 'Page.loadEventFired') loadWaiters.splice(0).forEach(w => w.res());
    if(m.id && pend.has(m.id)){ pend.get(m.id).res(m); pend.delete(m.id); }
  };
  ws.onerror = () => failPending(new Error('websocket error'));
  ws.onclose = () => failPending(new Error('websocket closed'));
}

// A SECOND tab (its own CDP target and websocket) on the same origin: the same localStorage, like two browser tabs of the real app.
async function openTab(url){
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${url}`, { method: 'PUT' })).json();
  const w = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { w.onopen = res; w.onerror = () => rej(new Error('websocket error (second tab)')); });
  let n = 0; const waiting = new Map();
  w.onmessage = e => {
    const m = JSON.parse(e.data);
    if(m.method === 'Runtime.exceptionThrown') pageErrs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if(m.id && waiting.has(m.id)){ waiting.get(m.id)(m); waiting.delete(m.id); }
  };
  const sendT = (method, params = {}) => new Promise((res, rej) => {
    const k = ++n;
    const to = setTimeout(() => { waiting.delete(k); rej(new Error(`CDP timeout (second tab): ${method}`)); }, CDP_TIMEOUT_MS);
    waiting.set(k, m => { clearTimeout(to); res(m); });
    w.send(JSON.stringify({ id: k, method, params }));
  });
  await sendT('Runtime.enable');
  const evT = async expr => {
    const r = await sendT('Runtime.evaluate', { expression: '(function(){with(window.__kf||{}){return eval(' + JSON.stringify(expr) + ')}})()', returnByValue: true, awaitPromise: true });
    if(r.result.exceptionDetails) throw new Error(expr + ' -> ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
    return r.result.result.value;
  };
  for(let i = 0; i < 50; i++){ try{ if(await evT('typeof guardar') === 'function') break; }catch{} await sleep(200); }
  await sleep(300);
  return { ev: evT, close: async () => { try{ w.close(); }catch{} try{ await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); }catch{} } };
}

async function cleanup(){
  try{ ws && ws.readyState === 1 && ws.send(JSON.stringify({ id: ++id, method: 'Browser.close' })); }catch{} // graceful: closes every browser process
  await sleep(1500);
  try{ ws && ws.close(); }catch{}
  if(br){ const done = new Promise(r => br.once('exit', r)); br.kill(); await Promise.race([done, sleep(3000)]); }
  if(srv) await new Promise(r => { srv.close(r); srv.closeAllConnections?.(); });
  for(const d of tmpDirs) try{ fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }catch{}
}

const browser = findBrowser();
if(!browser){ console.log('SKIP: no browser found'); process.exit(2); }

let APPVER_EXPECTED = '';
try{
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'tugasto-e2e-site-')); tmpDirs.push(site);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'tugasto-e2e-prof-')); tmpDirs.push(prof);
  APPVER_EXPECTED = prepareSite(site);
  srv = await serve(site);
  URL_APP = `http://127.0.0.1:${srv.address().port}/index.html`;
  br = spawn(browser, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  await connect(prof);
  await send('Page.enable'); await send('Runtime.enable');
  const it = (nombre, monto, pagado) => pagado === undefined ? {nombre, monto} : {nombre, monto, pagado};
  const mes = (ing, fij, vari, deu) => ({ingresos:ing, gastosFijos:fij, gastosVariables:vari, deudas:deu});
  const meses = [];
  for(let i=0;i<12;i++) meses.push(mes([], [], [], []));
  meses[0] = mes([it('Sueldo',100000)], [it('Alquiler',30000), it('Luz',5000,false)], [it('Super',8000)], [it('Préstamo',10000)]);
  meses[9] = mes([it('Sueldo',200000), it('Otros ingresos',0)], [it('Alquiler',50000)], [it('Super',0)], []);
  meses[11] = mes([it('Sueldo',200000)], [it('Alquiler',50000)], [], []);
  const legacy = {anio: 2026, meses};
  
  const bigFinal = `document.getElementById('bigFinal') && document.getElementById('bigFinal').textContent`;
  const flags = (j,k) => `D.meses[${j}].${k}.map(function(x){return x.pagado})`;
  

  await nav(URL_APP);
  await ev(`localStorage.clear(); localStorage.setItem('kibo.anio','2026'); localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(legacy))}); true`);
  await nav(URL_APP);

  check('app version (read from index.html)', await ev('APPVER'), APPVER_EXPECTED);
  check('current month index (Oct)', await ev('mes'), 9);
  // legacy migration
  check('migration marker', await ev('D.pagoExplicito'), true);
  check('Jan ingresos flags (past, monto>0 -> true)', await ev(flags(0,'ingresos')), [true]);
  check('Jan fijos flags (explicit false kept)', await ev(flags(0,'gastosFijos')), [true,false]);
  check('Oct ingresos flags (monto 0 -> false)', await ev(flags(9,'ingresos')), [true,false]);
  check('Dec flags (future -> false)', await ev(flags(11,'ingresos')), [false]);
  check('Jan disponibleFinal (100000-30000-8000-10000; Luz unticked excluded)', await ev('calc(D.meses[0]).disponibleFinal'), 52000);
  check('Jan pendienteFijos', await ev('calc(D.meses[0]).pendienteFijos'), 5000);
  check('Dec disponibleFinal (all pending)', await ev('calc(D.meses[11]).disponibleFinal'), 0);
  check('Dec pendienteIngresos', await ev('calc(D.meses[11]).pendienteIngresos'), 200000);
  await sleep(1300);   // the big number counts up: let the animation finish before reading the screen
  check('Oct big number on screen', await ev(`(${bigFinal}).replace(/\\D/g,'')`), '150000');
  // checkboxes rendered for all 4 sections
  check('check on ingresos rows', await ev(`document.querySelectorAll('[data-act=pagar][data-k=ingresos]').length`), 2);
  check('check on gastosVariables rows', await ev(`document.querySelectorAll('[data-act=pagar][data-k=gastosVariables]').length`), 1);
  check('ingresos aria uses cobrado', await ev(`document.querySelector('[data-act=pagar][data-k=ingresos]').getAttribute('aria-label')`), 'Marcar como no cobrado');

  const click = (k,i) => ev(`document.querySelector('[data-act=pagar][data-k=${k}][data-i="${i}"]').click(); true`);
  const disp = () => ev('calc(D.meses[9]).disponibleFinal');
  // toggle sueldo off/on
  await click('ingresos',0);
  check('sueldo unticked -> disponible', await disp(), -50000);
  await sleep(2000);
  const rawNeg = await ev(bigFinal);
  results.push('INFO  raw bigFinal after untick: ' + JSON.stringify(rawNeg) + ' class=' + JSON.stringify(await ev(`document.getElementById('bigFinal').className`)));
  check('screen after untick (after animation)', rawNeg, '($50.000)');
  await click('ingresos',0);
  check('sueldo ticked again -> disponible', await disp(), 150000);
  // repeated toggles: even number returns to same value, no accumulation
  for(let n=0;n<4;n++) await click('gastosFijos',0);
  check('alquiler toggled 4x -> unchanged', await disp(), 150000);
  // edit pending amount: untick alquiler, change amount, saldo must not change
  await click('gastosFijos',0);
  check('alquiler pending -> disponible', await disp(), 200000);
  await ev(`(function(){ var x=document.querySelector('input.monto[data-k=gastosFijos][data-i="0"]'); x.value='70000'; x.dispatchEvent(new Event('input',{bubbles:true})); x.dispatchEvent(new Event('change',{bubbles:true})); x.dispatchEvent(new Event('blur')); return true; })()`);
  check('alquiler monto edited', await ev('D.meses[9].gastosFijos[0].monto'), 70000);
  check('edit pending -> disponible unchanged', await disp(), 200000);
  await click('gastosFijos',0);
  check('tick edited alquiler -> 200000-70000', await disp(), 130000);
  // edit paid amount
  await ev(`(function(){ var x=document.querySelector('input.monto[data-k=gastosFijos][data-i="0"]'); x.value='60000'; x.dispatchEvent(new Event('input',{bubbles:true})); x.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  check('edit paid -> disponible reflects difference', await disp(), 140000);
  // new variable expense: create via data model path used by crearItem? use super row, type amount pending
  await ev(`(function(){ var x=document.querySelector('input.monto[data-k=gastosVariables][data-i="0"]'); x.value='12000'; x.dispatchEvent(new Event('input',{bubbles:true})); x.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  check('variable typed but unticked -> no impact', await disp(), 140000);
  await click('gastosVariables',0);
  check('variable ticked -> impact', await disp(), 128000);

  // persistence: reload
  if(typeof (await ev('typeof guardar')) === 'string') await ev('guardar(); true');
  await nav(URL_APP);
  check('after reload flags Oct fijos', await ev(flags(9,'gastosFijos')), [true]);
  check('after reload flags Oct variables', await ev(flags(9,'gastosVariables')), [true]);
  check('after reload Jan explicit false kept', await ev(flags(0,'gastosFijos')), [true,false]);
  check('after reload disponible', await ev('calc(D.meses[9]).disponibleFinal'), 128000);
  await sleep(1300);
  check('after reload screen', await ev(`(${bigFinal}).replace(/[^\\d-]/g,'')`), '128000');
  // untick then reload: stays pending
  await ev(`document.querySelector('[data-act=pagar][data-k=gastosVariables][data-i="0"]').click(); true`);
  await nav(URL_APP);
  check('pending survives reload', await ev(flags(9,'gastosVariables')), [false]);
  check('pending after reload disponible', await ev('calc(D.meses[9]).disponibleFinal'), 140000);

  // Año view sanity: serie totals realized
  check('serie Oct totalGastos realized', await ev('serie(D)[9].totalGastos'), 60000);
  // ── composition views: ranking (Año) and pie (Mes) count only paid ──
  // state now: Oct Sueldo paid, Alquiler 60000 paid, Super 12000 pending; Jan Alquiler 30000 paid,
  // Luz 5000 explicit false, Super 8000 paid (migrated), Prestamo 10000 paid; Dec Alquiler 50000 pending
  const tortaDom = () => ev(`Array.prototype.map.call(document.querySelectorAll('#cardTorta .tg-fila'), function(r){ return r.querySelector('.tg-n').textContent + '=' + r.querySelector('.tg-m').textContent.replace(/\\D/g,''); })`);
  const tortaTotal = () => ev(`document.querySelector('#cardTorta .tg-centro b') && document.querySelector('#cardTorta .tg-centro b').textContent.replace(/\\D/g,'')`);
  const rankDom = async () => { await ev(`document.querySelector('[data-act=tab][data-t=anio]').click(); true`); await sleep(300);
    const r = await ev(`Array.prototype.map.call(document.querySelectorAll('.rank .rk small'), function(s){ var sp=s.querySelectorAll('span'); return sp[0].textContent + '=' + sp[1].textContent.replace(/\\D/g,''); })`);
    await ev(`document.querySelector('[data-act=tab][data-t=mes]').click(); true`); await sleep(300); return r; };
  check('pie data: only paid (pending Super excluded)', await ev('plain(datosTorta(D.meses[9]))'), [{n:'Alquiler', v:60000, k:'gastosFijos'}]);
  check('pie on screen: only paid', await tortaDom(), ['Alquiler=60000']);
  check('pie center total on screen', await tortaTotal(), '60000');
  check('ranking data: only paid (Luz unticked, Dec pending, Oct Super pending excluded)', await ev('plain(ranking(D))'), [{nombre:'Alquiler', monto:90000}, {nombre:'Super', monto:8000}]);
  check('ranking on screen', await rankDom(), ['Alquiler=90000', 'Super=8000']);
  await click('gastosVariables', 0);
  check('tick Super -> pie includes it', await tortaDom(), ['Alquiler=60000', 'Super=12000']);
  check('tick Super -> ranking adds it', await rankDom(), ['Alquiler=90000', 'Super=20000']);
  await click('gastosVariables', 0);
  check('untick Super -> pie excludes again', await tortaDom(), ['Alquiler=60000']);
  check('untick Super -> ranking back', await rankDom(), ['Alquiler=90000', 'Super=8000']);
  for(let n=0;n<4;n++) await click('gastosVariables', 0);
  check('4x toggle -> pie unchanged', await tortaDom(), ['Alquiler=60000']);
  check('4x toggle -> ranking unchanged', await rankDom(), ['Alquiler=90000', 'Super=8000']);
  check('saldo still as Sprint 0 (Oct)', await ev('calc(D.meses[9]).disponibleFinal'), 140000);
  check('pending still exposed (Oct pendienteVariables)', await ev('calc(D.meses[9]).pendienteVariables'), 12000);

  // ── budget caps (topes): consumed only by paid items ──
  // state: Oct Super 12000 pending. Put a 10000 cap on it, persist, reload to render the bar.
  await ev(`D.meses[9].gastosVariables[0].tope = 10000; guardar(); true`);
  await nav(URL_APP);
  const bar = () => ev(`(function(){ var t=document.getElementById('tt-gastosVariables-0'), b=document.getElementById('tb-gastosVariables-0');
    return t && b ? {txt:t.textContent, w:parseFloat(b.style.width), mal:b.className==='mal'} : null; })()`);
  const aviso = () => ev(`(function(){ var n=document.getElementById('notaTopes'); return n.style.display==='none' ? '' : n.textContent; })()`);
  const typeSuper = v => ev(`(function(){ var x=document.querySelector('input.monto[data-k=gastosVariables][data-i="0"]'); x.value='${v}'; x.dispatchEvent(new Event('input',{bubbles:true})); x.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  check('tope: pending 12000 over cap -> not consumed', await bar(), {txt:'— de $10.000', w:0, mal:false});
  check('tope: no over-cap warning while pending', await aviso(), '');
  await click('gastosVariables', 0);
  check('tope: tick -> over cap', await bar(), {txt:'Te pasaste por $2.000 del tope de $10.000', w:100, mal:true});
  check('tope: tick -> warning shown', await aviso(), 'Te pasaste del tope en Super.');
  await click('gastosVariables', 0);
  check('tope: untick -> released', await bar(), {txt:'— de $10.000', w:0, mal:false});
  check('tope: untick -> warning hidden', await aviso(), '');
  await typeSuper('9000');
  check('tope: edit pending amount (live) -> bar unchanged', await bar(), {txt:'— de $10.000', w:0, mal:false});
  await click('gastosVariables', 0);
  check('tope: tick edited -> 90%', await bar(), {txt:'$9.000 de $10.000', w:90, mal:false});
  await typeSuper('10000');
  check('tope: edit paid to exact limit (live) -> full, not over', await bar(), {txt:'$10.000 de $10.000', w:100, mal:false});
  check('tope: exact limit -> no warning', await aviso(), '');
  for(let n=0;n<4;n++) await click('gastosVariables', 0);
  check('tope: 4x toggle -> unchanged', await bar(), {txt:'$10.000 de $10.000', w:100, mal:false});
  await typeSuper('10500');
  check('tope: edit paid over limit (live) -> over', await bar(), {txt:'Te pasaste por $500 del tope de $10.000', w:100, mal:true});
  check('tope: live warning', await aviso(), 'Te pasaste del tope en Super.');
  check('tope: saldo semantics intact', await ev('calc(D.meses[9]).disponibleFinal'), 200000 - 60000 - 10500);

  // ── R2: card "Gasto" button, number errors, empty notice, toast XSS ──
  const typeIn = (sel, v, final = true) => ev(`(function(){ var x=document.querySelector(${JSON.stringify(sel)}); x.dispatchEvent(new FocusEvent('focusin',{bubbles:true})); x.value=${JSON.stringify(v)}; x.dispatchEvent(new Event('input',{bubbles:true})); ${final ? "x.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));" : ''} return true; })()`);
  const focusOut = sel => ev(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new FocusEvent('focusout',{bubbles:true})); true`);
  const hasCls = (sel, c) => ev(`document.querySelector(${JSON.stringify(sel)}).classList.contains(${JSON.stringify(c)})`);
  const toastTxt = () => ev(`(function(){ var t=document.getElementById('toast'); return t.classList.contains('on') ? t.textContent : ''; })()`);
  // (1) P3a: the FAB is the only "Gasto" button (the card one duplicated it and was removed) and opens the quick-expense sheet
  check('P3a: no card Gasto button; the FAB is the only one', await ev(`[!!document.querySelector('#v-mes [data-act=rapido]'), document.querySelectorAll('[data-act=gastoRapido]').length]`), [false, 1]);
  const cerrarHoja = async () => { await ev(`(function(){ var b = document.querySelector('#hoja [data-act=cerrarHoja]'); if(b) b.click(); return true; })()`); await sleep(400); };
  await ev(`document.querySelector('[data-act=gastoRapido]').click(); true`); await sleep(300);
  check('FAB opens the quick-expense sheet', await ev(`!!document.getElementById('grMonto') && document.getElementById('velo').classList.contains('on')`), true);
  await cerrarHoja();
  // (2) number parsing: visible error, nothing stored; crypto quantity keeps decimals
  const alq = 'input.monto[data-k=gastosFijos][data-i="0"]';
  const antes = await ev('D.meses[9].gastosFijos[0].monto');
  await typeIn(alq, '1e3', false);
  check('typing 1e3: field marked', await hasCls(alq, 'err'), true);
  check('typing 1e3: nothing stored yet', await ev('D.meses[9].gastosFijos[0].monto'), antes);
  check('typing 1e3: no message while typing', await toastTxt(), '');
  await focusOut(alq);
  check('blur with 1e3: visible message', await toastTxt(), 'No entendí «1e3» como número');
  check('blur with 1e3: stored monto unchanged', await ev('D.meses[9].gastosFijos[0].monto'), antes);
  check('blur with 1e3: field shows the last valid value again', await ev(`document.querySelector(${JSON.stringify(alq)}).value.replace(/\\D/g,'')`), String(antes));
  check('blur with 1e3: error mark cleared', await hasCls(alq, 'err'), false);
  await typeIn(alq, '1.', false);
  check('typing "1." (partial): no error mark', await hasCls(alq, 'err'), false);
  await typeIn(alq, '60.000');
  check('60.000 is 60000 (thousands dot)', await ev('D.meses[9].gastosFijos[0].monto'), 60000);
  await ev(`document.querySelector('[data-act=tab][data-t=usd]').click(); true`); await sleep(400);
  const cant = 'input.cant[data-cripto="0"]';
  await typeIn(cant, '0.001');
  check('crypto quantity 0.001 is stored as 0.001', await ev('D.cripto[0].cantidad'), 0.001);
  await typeIn(cant, '1,234.5');
  check('crypto quantity 1,234.5 is rejected and not stored', await ev('D.cripto[0].cantidad'), 0.001);
  check('crypto quantity 1,234.5: visible message', await toastTxt(), 'No entendí «1,234.5» como número');
  await ev(`document.querySelector('[data-act=tab][data-t=mes]').click(); true`); await sleep(300);
  // (3) registered but unticked data is data: the empty-app notice goes away and the backup reminder shows
  await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); true`);
  await nav(URL_APP);
  check('empty app shows the empty notice', await ev(`!!document.querySelector('#avisos [data-av=vacia]')`), true);
  await ev(`document.querySelector('[data-act=verFilas][data-k=gastosVariables]').click(); true`); await sleep(300);   // P3a: an empty section is one sentence + "Cargar …"
  await typeIn('input.monto[data-k=gastosVariables][data-i="0"]', '5000'); await sleep(800);
  check('unticked amount is registered', await ev('D.meses[9].gastosVariables[0].pagado'), false);
  check('unticked amount: empty notice is gone', await ev(`!!document.querySelector('#avisos [data-av=vacia]')`), false);
  await nav(URL_APP);
  check('reload: no empty notice', await ev(`!!document.querySelector('#avisos [data-av=vacia]')`), false);
  // L4: never backed up -> no reminder on the first day with data; the first day is recorded on this phone
  check('L4 reload: no backup reminder on the first day with data (never backed up)', await ev(`!!document.querySelector('#avisos [data-av=copia]')`), false);
  check('L4 the first day with data is recorded (device key)', await ev(`localStorage.getItem('kibo.datosDesde') === new Date().toISOString()`), true);
  const avisoCopia = () => ev(`(function(){ var a = document.querySelectorAll('#avisos .aviso'), c = document.querySelector('#avisos [data-av=copia]');
    return c ? [a.length, c.querySelector('p').textContent, Array.prototype.map.call(c.querySelectorAll('button'), function(b){ return b.textContent; })] : null; })()`);
  await ev(`localStorage.setItem('kibo.datosDesde', new Date(Date.now() - 8 * 864e5).toISOString()); true`); await nav(URL_APP);
  check('L4 never backed up and 8 days with data: one compact reminder', await avisoCopia(),
    [1, 'Hace 8 días que cargás datos y todavía no hiciste ninguna copia de seguridad. Tus datos viven solo en este dispositivo.', ['Hacer copia ahora', 'Más tarde']]);
  await ev(`localStorage.setItem('kibo.ultimaCopia', new Date(Date.now() - 40 * 864e5).toISOString()); true`); await nav(URL_APP);
  check('L4 last backup 40 days ago: one compact reminder', await avisoCopia(),
    [1, 'Hace 40 días que no hacés una copia de seguridad. Tus datos viven solo en este dispositivo.', ['Hacer copia ahora', 'Más tarde']]);
  await ev(`document.querySelector('#avisos [data-act=posponerCopia]').click(); true`); await sleep(300);
  check('L4 "Más tarde" hides it and snoozes it 7 days (device key)', [await avisoCopia(), await ev(`localStorage.getItem('kibo.copiaPospuesta') === new Date(Date.now() + 7 * 864e5).toISOString()`)], [null, true]);
  await nav(URL_APP);
  check('L4 snoozed: not shown on the next start', await avisoCopia(), null);
  await ev(`localStorage.removeItem('kibo.copiaPospuesta'); true`); await nav(URL_APP);
  check('L4 snooze gone: shown again', (await avisoCopia() || [])[0], 1);
  const copiaL4 = await ev(`new Promise(function(resolve){ var o = URL.createObjectURL, capt = null, t0 = performance.now();
    URL.createObjectURL = function(b){ capt = b; return o.call(URL, b); };
    document.querySelector('#avisos [data-av=copia] [data-act=copia]').click();
    (function esperar(){ if(!capt && performance.now() - t0 < 5000) return setTimeout(esperar, 100); URL.createObjectURL = o;
      if(!capt) return resolve(null); capt.text().then(function(t){ var j = null; try{ j = JSON.parse(t); }catch(e){} resolve(j && [j.app, Object.keys(j.anios)]); }); })(); })`);
  check('L4 "Hacer copia ahora" runs the existing backup (the backup file)', copiaL4, ['TuGasto', ['2026']]);
  check('L4 after the backup: reminder hidden, last backup date is today', [await avisoCopia(), await ev(`localStorage.getItem('kibo.ultimaCopia') === new Date().toISOString()`)], [null, true]);
  await ev(`(function(){ var b = document.querySelector('#hoja [data-act=cerrarHoja]') || document.getElementById('velo'); b.click(); return true; })()`); await sleep(400);
  await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.ultimaCopia', new Date(Date.now() - 90 * 864e5).toISOString()); localStorage.setItem('kibo.datosDesde', new Date(Date.now() - 90 * 864e5).toISOString()); true`);
  await nav(URL_APP);
  check('L4 empty phone: no backup reminder, whatever the dates', [await avisoCopia(), await ev(`!!document.querySelector('#avisos [data-av=vacia]')`)], [null, true]);
  // (4) toast XSS through the repeat-invoice action, driven by the UI
  const NUM = '<img src=x onerror="window.__xss=1">12';
  const trab = { version: 1, activo: true, modo: 'pro', facturas: [{ id: 'f1', tipo: 'factura', cliente: 'Cliente X', numero: NUM, concepto: '', monto: 1000, cantidad: 1, precio: 1000, base: 1000, ajuste: 0,
    fecha: '2026-09-01', contado: false, plazo: 30, forma: 'transferencia', creada: '2026-09-01T10:00:00.000Z' }], cobros: [], pases: [], gastos: [], productos: [] };
  await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.trabajo', ${JSON.stringify(JSON.stringify(trab))}); true`);
  await nav(URL_APP);
  check('Trabajo data loaded (tab visible)', await ev(`document.querySelector('#nav button[data-t=trabajo]').style.display !== 'none'`), true);
  await ev(`document.querySelector('[data-act=tab][data-t=trabajo]').click(); true`); await sleep(400);
  await ev(`document.querySelector('[data-act=tjVerFac]').click(); true`); await sleep(400);
  await ev(`document.querySelector('[data-act=tjRepetir]').click(); true`); await sleep(1000);
  check('toast XSS: no handler ran', await ev('typeof window.__xss'), 'undefined');
  check('toast XSS: the toast shows the literal text', await ev(`document.getElementById('toast').textContent.indexOf('<img src=x onerror="window.__xss=1">13') >= 0`), true);
  check('toast XSS: no img element inside the toast', await ev(`document.querySelectorAll('#toast img').length`), 0);

  // (5) R3: the financial engine is its own script block, and "Versión para PC" still builds one self-contained file
  check('TGMotor.calc is a function (engine block loaded before the app)', await ev(`typeof TGMotor.calc`), 'function');
  check('the app aliases are the motor functions', await ev(`calc === TGMotor.calc && serie === TGMotor.serie && datosTorta === TGMotor.datosTorta && ranking === TGMotor.ranking`), true);
  check('motor and app agree on a month (calc via alias vs motor)', await ev(`JSON.stringify(calc(D.meses[mes])) === JSON.stringify(TGMotor.calc(D.meses[mes]))`), true);
  // run the app's real versionPC() through the real click delegation and inspect the file it would download
  const pcCheck = '(' + function(){
    return new Promise(function(resolve){
      var orig = URL.createObjectURL, capt = null, t0 = performance.now();
      URL.createObjectURL = function(b){ capt = b; return orig.call(URL, b); };
      var btn = document.createElement('button'); btn.setAttribute('data-act', 'verpc'); document.body.appendChild(btn);
      btn.click(); document.body.removeChild(btn);
      (function esperar(){
        if(!capt && performance.now() - t0 < 8000) return setTimeout(esperar, 100);
        URL.createObjectURL = orig;
        if(!capt) return resolve({captured: false});
        capt.text().then(function(out){
          var M1 = '/*DATOS_' + 'INICIO*/', M2 = '/*DATOS_' + 'FIN*/';
          var i = out.indexOf(M1), j = out.indexOf(M2), datos = null;
          try{ datos = JSON.parse(out.slice(i + M1.length, j)); }catch(e){}
          var mo = /<script id="motor">([\s\S]*?)<\/script>/.exec(out), app = out.search(/\(function\(\)\{\r?\n'use strict';/);
          var nuevo = new DOMParser().parseFromString(out, 'text/html'), textos = [];
          Array.prototype.forEach.call(nuevo.querySelectorAll('script'), function(s){
            if(s.type === 'application/json') return;
            textos.push(s.textContent);   // compiled in Node below: new Function here would need 'unsafe-eval' (CSP, N5 S-4)
          });
          var cerrar = document.createElement('button'); cerrar.setAttribute('data-act', 'cerrarHoja'); document.body.appendChild(cerrar); cerrar.click(); document.body.removeChild(cerrar);
          resolve({
            captured: true, m1: out.split(M1).length - 1, m2: out.split(M2).length - 1,
            embeddedYear: datos ? datos.anio === D.anio : false, embeddedMonths: datos && datos.meses ? datos.meses.length : null,
            motorBlocks: out.split('<script id="motor">').length - 1, motorHasMarkers: mo ? mo[1].indexOf('DATOS_') >= 0 : null,
            appAfterMotor: !!mo && app > out.indexOf('<script id="motor">'),
            motorDefinesTGMotor: !!mo && mo[1].indexOf('var TGMotor = (function(){') >= 0,
            scriptsCompile: null, scriptTexts: textos,
            scriptIds: Array.prototype.map.call(nuevo.querySelectorAll('script'), function(s){ return s.id || '(app)'; })
          });
        });
      })();
    });
  } + ')()';
  // N5 S-4: the Content-Security-Policy meta is enforced (eval is refused and reported) while the whole app runs under it
  check('CSP is enforced: an image from another origin is refused and reported as a violation', await ev(`new Promise(function(res){ window.__cspProbe = []; var im = new Image(); im.src = 'http://127.0.0.2:9/x.png'; setTimeout(function(){ var p = window.__cspProbe.slice(); window.__cspProbe = null; res([p, document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').length]); }, 500); })`), [['img-src'], 1]);
  const pc = await ev(pcCheck);
  if(pc && pc.scriptTexts){ pc.scriptsCompile = pc.scriptTexts.every(t => { try{ new vm.Script(t); return true; }catch(e){ return false; } }); delete pc.scriptTexts; }
  check('"Versión para PC" (real versionPC): data embedded once, motor before the app, every script compiles', pc,
    { captured: true, m1: 1, m2: 1, embeddedYear: true, embeddedMonths: 12, motorBlocks: 1, motorHasMarkers: false, appAfterMotor: true,
      motorDefinesTGMotor: true, scriptsCompile: true, scriptIds: ['(app)', 'datos', 'motor', '(app)'] });   // the first '(app)' is the Date pin the harness injects in <head>

  // N7: the exported file OPENED (file://, its own empty storage) shows the year it carries, not the calendar one (pinned to 2026), and an edit saves under that year
  const ms27 = []; for(let i=0;i<12;i++) ms27.push(mes([], [], [], [])); ms27[9] = mes([it('Sueldo 2027', 270000, true)], [], [], []);
  await ev(`localStorage.setItem('kibo.datos.2027', ${JSON.stringify(JSON.stringify({anio: 2027, meses: ms27}))}); localStorage.setItem('kibo.anio', '2027'); true`);
  await nav(URL_APP);
  check('N7 PC file: the app has 2027 open before exporting', await ev('D.anio'), 2027);
  const pc27 = await ev(`new Promise(function(resolve){ var orig = URL.createObjectURL, capt = null, t0 = performance.now();
    URL.createObjectURL = function(b){ capt = b; return orig.call(URL, b); };
    var btn = document.createElement('button'); btn.setAttribute('data-act', 'verpc'); document.body.appendChild(btn); btn.click(); document.body.removeChild(btn);
    (function esperar(){ if(!capt && performance.now() - t0 < 8000) return setTimeout(esperar, 100); URL.createObjectURL = orig; if(!capt) return resolve(null); capt.text().then(resolve); })(); })`);
  check('N7 PC file: the 2027 file was built', typeof pc27 === 'string' && pc27.indexOf('Sueldo 2027') > 0, true);
  const pcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tugasto-e2e-pc-')); tmpDirs.push(pcDir);
  const pcUrl = pathToFileURL(path.join(pcDir, 'tugasto-2027.html')).href;
  fs.writeFileSync(path.join(pcDir, 'tugasto-2027.html'), pc27 || '');
  await nav(pcUrl);
  await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida', '1'); localStorage.setItem('kibo.anio', '2026'); true`);   // a stale remembered year, nothing stored
  await nav(pcUrl);
  check('N7 PC file opened via file://: shows 2027 (title and header), its data, and remembers 2027', await ev(`[location.protocol, D.anio, document.querySelector('#titulo .anio').textContent, document.title, D.meses[9].ingresos[0].nombre, localStorage.getItem('kibo.anio')]`),
    ['file:', 2027, '2027', 'TuGasto · 2027', 'Sueldo 2027', '2027']);
  await ev(`D.meses[9].ingresos[0].monto = 271000; sucio = true; guardar(); true`);
  check('N7 PC file opened via file://: an edit saves under kibo.datos.2027 (nothing under 2026)', await ev(`[(function(t){ return t ? JSON.parse(t).meses[9].ingresos[0].monto : null; })(localStorage.getItem('kibo.datos.2027')), localStorage.getItem('kibo.datos.2026')]`), [271000, null]);
  await ev(`localStorage.clear(); true`);
  await nav(URL_APP);

  // ── L8: the UNMODIFIED build (no test hook, no date pin) runs under its own strict CSP: script hashes, no 'unsafe-inline' ──
  const cspId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__cspV = []; document.addEventListener("securitypolicyviolation", function(e){ window.__cspV.push(e.violatedDirective); });' })).result.identifier;
  const errsL8 = pageErrs.length, URL_REAL = URL_APP.replace(/index\.html$/, 'real.html');
  await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida', '1'); true`);
  await nav(URL_REAL); await sleep(600);
  check('L8 real build: no CSP violation, both scripts ran (engine and app), script-src lists hashes and no unsafe-inline', await ev(`(function(){ var c = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
    return [window.__cspV.slice(), typeof TGMotor, document.getElementById('v-mes').children.length > 0, /script-src 'self' 'sha256-[^']+' 'sha256-[^']+';/.test(c), c.indexOf('unsafe-inline') > c.indexOf('style-src')]; })()`),
    [[], 'object', true, true, true]);
  check('L8 real build: an injected inline script does not run and is reported', await ev(`new Promise(function(res){ var s = document.createElement('script'); s.textContent = 'window.__inyectado = 1'; document.body.appendChild(s);
    setTimeout(function(){ res([window.__inyectado === undefined, window.__cspV.filter(function(d){ return d.indexOf('script-src') === 0; }).length > 0]); }, 300); })`), [true, true]);
  const realHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), PM1 = '/*DATOS_' + 'INICIO*/', PM2 = '/*DATOS_' + 'FIN*/';
  const realPc = realHtml.slice(0, realHtml.indexOf(PM1) + PM1.length) + JSON.stringify({anio: 2027, meses: ms27}).replace(/</g, '\\u003c') + realHtml.slice(realHtml.indexOf(PM2));   // the splice versionPC does
  fs.writeFileSync(path.join(pcDir, 'real-2027.html'), realPc);
  const realPcUrl = pathToFileURL(path.join(pcDir, 'real-2027.html')).href;
  await nav(realPcUrl); await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida', '1'); true`); await nav(realPcUrl); await sleep(600);
  check('L8 real "Versión para PC" opened via file://: same CSP, no violation, shows the year it carries', await ev(`[location.protocol, window.__cspV.slice(), typeof TGMotor, document.title, !!document.querySelector('#v-mes .sec')]`),
    ['file:', [], 'object', 'TuGasto · 2027', true]);
  check('L8 real build and its PC file: no uncaught page error', pageErrs.slice(errsL8), []);
  await ev(`localStorage.clear(); true`);
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: cspId });
  await nav(URL_APP);

  // ── R4.3: several tabs, model fields on reload, backup -> restore, back to pre-R4 ──
  const oct = (sueldo) => { const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    ms[9] = mes([it('Sueldo', sueldo, true)], [it('Alquiler', 50000, true)], [it('Super', 30000, false)], []); return ms; };
  const blobR4 = JSON.stringify({anio: 2026, pagoExplicito: true, meses: oct(200000)});
  const sembrar = async () => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.anio','2026'); localStorage.setItem('kibo.datos.2026', ${JSON.stringify(blobR4)}); true`); };
  const AVISO_OTRA = 'Hay cambios hechos en otra pestaña. Recargá para verlos: hasta entonces esta pestaña no guarda nada.';
  const avisoTxt = (e) => e(`(document.getElementById('avisos') || {}).textContent || ''`);
  await sembrar(); await nav(URL_APP);
  check('R4.3 a: a fresh blob has no model field and no rev', await ev(`[D.arrastre === undefined, D.rev === undefined, D.meses[8].cierreReal === undefined]`), [true, true, true]);
  const tabB = await openTab(URL_APP);
  check('R4.3 a: tab B loaded the same year', await tabB.ev('D.anio + ":" + D.meses[9].ingresos[0].monto'), '2026:200000');
  // B starts editing (unsaved in memory); A saves meanwhile
  await tabB.ev(`D.meses[9].ingresos[0].monto = 999; sucio = true; true`);
  await ev(`D.meses[9].ingresos[0].monto = 123456; guardar(); true`);
  check('R4.3 a: tab A saved with rev 1', await ev(`JSON.parse(localStorage.getItem('kibo.datos.2026')).rev`), 1);
  await sleep(500);   // the storage event reaches tab B
  check('R4.3 a: tab B (with unsaved edits) is NOT reloaded under its feet: in-memory edit kept', await tabB.ev('D.meses[9].ingresos[0].monto'), 999);
  check('R4.3 a: tab B shows the notice (storage event)', await avisoTxt(tabB.ev).then(t => t.indexOf(AVISO_OTRA) >= 0), true);
  check('R4.3 a: tab B is marked stale', await tabB.ev('obsoleta'), true);
  await tabB.ev(`guardar(); true`); await sleep(200);
  check('R4.3 a: stale tab B cannot overwrite tab A (stored amount and rev intact)', await ev(`(function(){ var b = JSON.parse(localStorage.getItem('kibo.datos.2026')); return [b.meses[9].ingresos[0].monto, b.rev]; })()`), [123456, 1]);
  // the pure revision path: pretend the storage event was missed (stale flag cleared) and save again
  await tabB.ev(`obsoleta = false; document.getElementById('avisos').innerHTML = ''; true`);
  await tabB.ev(`guardar(); true`); await sleep(200);
  check('R4.3 a: without the stale flag the revision check still refuses to overwrite', await ev(`(function(){ var b = JSON.parse(localStorage.getItem('kibo.datos.2026')); return [b.meses[9].ingresos[0].monto, b.rev]; })()`), [123456, 1]);
  check('R4.3 a: ... and shows the notice again', await avisoTxt(tabB.ev).then(t => t.indexOf(AVISO_OTRA) >= 0), true);
  check('R4.3 a: the notice has a reload button', await tabB.ev(`!!document.querySelector('#avisos [data-act=recargarPag]')`), true);
  await tabB.close();
  // a tab with NO unsaved edits reloads silently when another tab saves
  const tabC = await openTab(URL_APP);
  check('R4.3 a: tab C loads tab A data (rev 1)', await tabC.ev('D.meses[9].ingresos[0].monto + ":" + D.rev'), '123456:1');
  await ev(`D.meses[9].ingresos[0].monto = 222222; guardar(); true`);
  await sleep(600);
  check('R4.3 a: tab C (no edits) reloaded silently to the new data', await tabC.ev('D.meses[9].ingresos[0].monto + ":" + D.rev'), '222222:2');
  check('R4.3 a: ... with no notice', await avisoTxt(tabC.ev).then(t => t.indexOf(AVISO_OTRA) < 0), true);
  check('R4.3 a: ... and it can save on top', await tabC.ev(`D.meses[9].ingresos[0].monto = 333333; guardar(); JSON.parse(localStorage.getItem('kibo.datos.2026')).rev`), 3);
  await tabC.close();

  // (b) activarSaldos: snapshot first, model fields survive a reload
  await sembrar(); await nav(URL_APP);
  check('R4.3 b: before activating there is no snapshot and no marker', await ev(`[localStorage.getItem('kibo.respaldo.pre-r4'), localStorage.getItem('kibo.modeloSaldos')]`), [null, null]);
  check('R4.3 b: activarSaldos(400000) writes (Oct realized 150.000 -> apertura 250.000)', await ev(`activarSaldos(400000)`), true);
  check('R4.3 b: the snapshot holds the OLD data (no arrastre) and the marker is set', await ev(`(function(){ var s = JSON.parse(localStorage.getItem('kibo.respaldo.pre-r4')); var old = JSON.parse(s.datos['kibo.datos.2026']); return [old.arrastre === undefined, !!localStorage.getItem('kibo.modeloSaldos'), Object.keys(s.datos).indexOf('kibo.datos.2026') >= 0]; })()`), [true, true, true]);
  check('R4.3 b: activarSaldos again does nothing (idempotent)', await ev(`activarSaldos(1)`), false);
  await ev(`D.meses[8].cierreReal = {valor: 111, calculadoAlConfirmar: 222, confirmadoEl: '2026-10-01'}; guardar(); true`);
  const modelo = await ev(`plain({arrastre: D.arrastre, cierre: D.meses[8].cierreReal})`);
  check('R4.3 b: arrastre derived from the declared value', modelo.arrastre, {desde: 9, inicial: {apertura: 250000, declarado: 400000, declaradoEl: '2026-10-04', origen: 'declarado'}});
  await nav(URL_APP);
  check('R4.3 b: arrastre and cierreReal survive a reload', await ev(`plain({arrastre: D.arrastre, cierre: D.meses[8].cierreReal})`), modelo);
  check('R4.3 b: rev survives a reload (2 saves)', await ev(`D.rev`), 2);
  check('R4.3 b: calc() of Oct is unchanged (the old month result)', await ev(`calc(D.meses[9]).disponibleFinal`), 150000);
  await sleep(1300);
  check('R4.4: after activarSaldos(400000) the Oct card shows the chain: the declared available money', await ev(`(${bigFinal}).replace(/[^\\d-]/g,'')`), '400000');
  await ev(`document.querySelector('[data-act=tab][data-t=ajustes]').click(); true`); await sleep(300);
  check('R4.3 b: Ajustes shows the "volver" row while the snapshot exists', await ev(`(function(){ var b = document.querySelector('[data-act=volverR4]'); return b ? b.textContent.indexOf('Volver a como estaba antes del saldo mes a mes') >= 0 : false; })()`), true);

  // (d) go back to before the model through the real Ajustes action
  await ev(`document.querySelector('[data-act=volverR4]').click(); true`); await sleep(300);
  const recargado = nextLoad();
  await ev(`document.querySelector('#hoja [data-act=confirmar]').click(); true`);
  await recargado; await sleep(500);
  check('R4.3 d: after "volver" the year has no model and the marker and snapshot are gone', await ev(`[D.arrastre === undefined, D.rev === undefined, localStorage.getItem('kibo.modeloSaldos'), localStorage.getItem('kibo.respaldo.pre-r4')]`), [true, true, null, null]);
  check('R4.3 d: the old data is back exactly (same stored text)', await ev(`localStorage.getItem('kibo.datos.2026') === ${JSON.stringify(blobR4)}`), true);

  // (c) backup -> restore keeps the model fields
  check('R4.3 c: activate again', await ev(`activarSaldos(400000)`), true);
  await ev(`D.meses[8].cierreReal = {valor: 111, calculadoAlConfirmar: 222, confirmadoEl: '2026-10-01'}; guardar(); true`);
  const modeloAntes = await ev(`plain({arrastre: D.arrastre, cierre: D.meses[8].cierreReal, rev: D.rev})`);
  const copiaTxt = await ev(`JSON.stringify(armarCopia())`);
  check('R4.3 c: the backup carries the model fields in the year blob', await ev(`(function(c){ var y = JSON.parse(c).anios[2026]; return [!!y.arrastre, !!y.meses[8].cierreReal, y.rev]; })(${JSON.stringify(copiaTxt)})`), [true, true, modeloAntes.rev]);
  await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); true`); await nav(URL_APP);
  check('R4.3 c: a wiped phone has no model', await ev(`D.arrastre === undefined`), true);
  await ev(`restaurarTexto(${JSON.stringify(copiaTxt)}); pendiente(); true`); await sleep(500);
  check('R4.3 c: restore brings arrastre and cierreReal back; the revision moves forward (N4 I-5: max(stored, own) + 1)', await ev(`plain({arrastre: D.arrastre, cierre: D.meses[8].cierreReal, rev: D.rev})`), Object.assign({}, modeloAntes, {rev: modeloAntes.rev + 1}));
  check('R4.3 c: ... and the restored phone is marked as migrated', await ev(`!!localStorage.getItem('kibo.modeloSaldos')`), true);
  // an older backup without the model leaves the year without it
  const viejoTxt = JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2026: JSON.parse(blobR4)}});
  await ev(`restaurarTexto(${JSON.stringify(viejoTxt)}); pendiente(); true`); await sleep(500);
  check('R4.3 c: restoring an older backup without arrastre leaves the year without it', await ev(`[D.arrastre === undefined, D.meses[8].cierreReal === undefined]`), [true, true]);

  // ── R4.4: the screen reads the balance model only for a year with arrastre; a legacy year shows exactly what it showed before ──
  {
    const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    ms[9] = mes([it('Sueldo', 200000, true), it('Del trabajo', 300000, true)], [it('Alquiler', 50000, true)], [], []);
    ms[10] = mes([it('Del trabajo', 200000, true)], [], [], []);
    const legacyY = {anio: 2026, pagoExplicito: true, cotizacionUSD: 1250, ahorroAnioAnterior: 250000, meses: ms};
    const modelY = Object.assign({}, legacyY, {arrastre: {desde: 9, inicial: {apertura: 100000, declarado: 100000, declaradoEl: '2026-10-01', origen: 'declarado'}}});
    const trabR44 = {version: 1, activo: true, modo: 'simple', facturas: [], gastos: [], productos: [],
      cobros: [{id: 'c1', cliente: '', monto: 1000000, fecha: '2026-01-01', forma: 'transferencia', aplic: []}],
      pases: [{id: 'p1', fecha: '2026-10-02', monto: 300000, anio: 2026, mes: 9}, {id: 'p2', fecha: '2026-11-05', monto: 200000, anio: 2026, mes: 10}]};
    const seed = async (year, t) => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.anio','2026'); localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(year))}); ${t ? `localStorage.setItem('kibo.trabajo', ${JSON.stringify(JSON.stringify(t))});` : ''} true`); await nav(URL_APP); await sleep(1300); };
    const pantalla = () => ev(`(${bigFinal}).replace(/[^\\d-]/g,'')`);
    const tri = () => ev(`Array.prototype.map.call(document.querySelectorAll('#v-mes .tri b'), function(b){ return b.textContent; })`);
    const irTab = async (t) => { await ev(`document.querySelector('[data-act=tab][data-t=${t}]').click(); true`); await sleep(1400); };
    const tjDisp = () => ev(`document.getElementById('tjDisp').textContent.replace(/[^\\d-]/g,'')`);
    // L1: the headline is in pesos (#bigPatri) with the dollar equivalent below it (#patriUSD); kept as [dollars, pesos] for the checks
    const patri = () => ev(`[(document.querySelector('#patriUSD b') || document.getElementById('patriUSD')).textContent, document.getElementById('bigPatri').textContent]`);
    // R4.5 year views (owner decision 2026-10-06): "Los doce meses" cells [Ingresos, Gastos, Disponible] of a month and of the Total row; the year CSV via the real download path
    const anioFila = (i) => ev(`(function(){ var r = document.querySelectorAll('#v-anio [data-sec=anTabla] tbody tr')[${i}]; return [1, 2, 8].map(function(k){ return r.children[k].textContent; }); })()`);
    const csvAnio = () => ev(`(async function(){ var o = URL.createObjectURL, b = null; URL.createObjectURL = function(x){ b = x; return o.call(URL, x); };
      try{ exportarCSV(); } finally{ URL.createObjectURL = o; } var l = (await b.text()).replace(/^\\ufeff/, '').split('\\r\\n'); return [9, 10, 11].map(function(j){ var c = l[j + 1].split(';'); return [c[1], c[4], c[14]]; }); })()`);

    // (a) legacy year: unchanged numbers everywhere
    await seed(legacyY, trabR44);
    check('R4.4 legacy: no model in the year', await ev(`D.arrastre === undefined`), true);
    check('R4.4 legacy: Oct card = calc() (200.000 + 300.000 - 50.000)', [await pantalla(), await ev(`calc(D.meses[9]).disponibleFinal`)], ['450000', 450000]);
    check('R4.4 legacy: Oct Ingresos / Gastos / Ahorro tiles', await tri(), await ev(`[fARS(500000), fARS(50000), fARS(0)]`));
    check('R4.4 legacy: "Del trabajo" has no checkbox (only Sueldo)', await ev(`document.querySelectorAll('[data-act=pagar][data-k=ingresos]').length`), 1);
    await irTab('trabajo');
    check('R4.4 legacy: Trabajo available subtracts every pase at once, future ones included (1.000.000 - 500.000)', await tjDisp(), '500000');
    await irTab('usd');
    check('R4.4 legacy: Patrimonio total is the old year-end patrimonio() (savings 250.000 = US$ 200 at 1.250)', await patri(), await ev(`[fUSD(patrimonio(D).patrimonioUSD), fARS(patrimonio(D).patrimonioARS), fUSD(200), fARS(250000)]`).then(v => v.slice(0, 2)));
    check('R4.4 legacy: ... which is US$ 200', await ev(`patrimonio(D).patrimonioUSD`), 200);
    await irTab('anio');
    check('R4.5 year views, legacy: "El año" Oct row = calc() (500.000 / 50.000 / month flow 450.000)', await anioFila(9), await ev(`[fARS(500000), fARS(50000), fARS(450000)]`));
    check('R4.5 year views, legacy: Total Ingresos / Gastos / Disponible = sums of serie() (Disponible 450.000 + 200.000)', await anioFila(12), await ev(`[fARS(700000), fARS(50000), fARS(650000)]`));
    check('R4.5 year views, legacy: CSV Oct-Dec Ingresos / Gastos / Disponible final = serie()', await csvAnio(), [['500000', '50000', '450000'], ['200000', '0', '200000'], ['0', '0', '0']]);

    // (b) the same data with arrastre since October: the chain on the card, Q4 on both sides, D7 net worth
    await seed(modelY, trabR44);
    check('R4.4 model: Oct card shows the chain disponible (100.000 + 150.000 + the realized pase 300.000)', await pantalla(), '550000');
    check('R4.4 model: ... while calc() of Oct is still the old month result', await ev(`calc(D.meses[9]).disponibleFinal`), 450000);
    check('R4.4 model: Oct tiles (Del trabajo comes from the realized pase)', await tri(), await ev(`[fARS(500000), fARS(50000), fARS(0)]`));
    check('R4.4 model: the future Nov pase does not raise the current available money', await pantalla(), '550000');
    await ev(`document.querySelector('[data-act=mes][data-m="10"]').click(); true`); await sleep(1400);
    check('R4.4 model: Nov (future) shows the projected closing with the scheduled pase (550.000 + 200.000)', await pantalla(), '750000');
    await ev(`document.querySelector('[data-act=mes][data-m="9"]').click(); true`); await sleep(300);
    await irTab('trabajo');
    check('R4.4 model: the future pase does not reduce Trabajo available until its date (1.000.000 - 300.000)', await tjDisp(), '700000');
    await irTab('usd');
    check('R4.4 model: Patrimonio total is the D7 net a hoy incl. Trabajo cash (550.000 + 250.000 + 700.000 = 1.500.000 = US$ 1.200 at 1.250)',
      await patri(), await ev(`[fUSD(1200), fARS(1500000)]`));
    check('R4.4 model: ... and it is what patrimonioPantalla computes', await ev(`patrimonioPantalla(D, hoyApp()).patrimonioARS`), 1500000);
    await irTab('anio');
    check('R4.5 year views, model: "El año" Oct row = the card (500.000 / 50.000 / chain 550.000)', await anioFila(9), await ev(`[fARS(500000), fARS(50000), fARS(550000)]`));
    check('R4.5 year views, model: Nov row = the future card (scheduled pase 200.000, projected 750.000)', await anioFila(10), await ev(`[fARS(200000), fARS(0), fARS(750000)]`));
    check('R4.5 year views, model: Total Disponible = December closing 750.000 (not a sum of balances)', await anioFila(12), await ev(`[fARS(700000), fARS(50000), fARS(750000)]`));
    check('R4.5 year views, model: CSV Oct-Dec Ingresos / Gastos / Disponible final = the card values', await csvAnio(), [['500000', '50000', '550000'], ['200000', '0', '750000'], ['0', '0', '750000']]);
    // N1 (R4.5 close): Deudas column, summary card and ranking of a model year never treat a future month as paid / realized
    const n1 = JSON.parse(JSON.stringify(modelY));
    n1.meses[8] = mes([it('Sueldo', 100000, true)], [], [], []);
    n1.meses[10] = mes([it('Del trabajo', 200000, true)], [], [it('Viaje', 30000, true)], [it('Tarjeta', 100000, false)]);
    await seed(n1, trabR44); await irTab('anio');
    const deuFila = (i) => ev(`document.querySelectorAll('#v-anio [data-sec=anTabla] tbody tr')[${i}].children[7].textContent`);
    check('N1 year views, model: Nov Deudas = the scheduled installment 100.000 (unticked, future); Total Deudas 100.000', [await deuFila(10), await deuFila(12)], await ev(`[fARS(100000), fARS(100000)]`));
    check('N1 year views, model: the summary card averages the 2 elapsed months (Sep legacy 100.000, Oct card 500.000), never November',
      await ev(`(function(){ var r = document.querySelector('#v-anio .resumen').textContent; return [r.indexOf('Por mes entran ' + fARS(300000) + ' y se van ' + fARS(25000)) >= 0, r.indexOf('Promedio de 2 meses ya transcurridos de 2026') >= 0, r.indexOf('Noviembre') < 0]; })()`), [true, true, true]);
    check('N1 year views, model: "En qué se te fue la plata" leaves out the ticked expense of future November',
      await ev(`(function(){ var t = document.querySelector('#v-anio [data-sec=anRank]').textContent; return [t.indexOf('Alquiler') >= 0, t.indexOf('Viaje') < 0]; })()`), [true, true]);

    // (c) Q3: in a model month a "Del trabajo" row without pases is ordinary income with a checkbox (real click path)
    const q3 = JSON.parse(JSON.stringify(modelY));
    q3.meses[9].ingresos[1] = it('Del trabajo', 80000, false); q3.meses[10].ingresos = [];
    await seed(q3, null);
    check('R4.4 Q3: "Del trabajo" without pases has a checkbox in a model month', await ev(`document.querySelectorAll('[data-act=pagar][data-k=ingresos]').length`), 2);
    check('R4.4 Q3: unticked it is pending, not in the card (100.000 + 200.000 - 50.000)', await pantalla(), '250000');
    await ev(`document.querySelector('[data-act=pagar][data-k=ingresos][data-i="1"]').click(); true`); await sleep(1400);
    check('R4.4 Q3: ticked it is realized', [await ev(`D.meses[9].ingresos[1].pagado`), await pantalla()], [true, '330000']);

    // ── R5 N3b: Patrimonio composition (owner MUST), "Del trabajo" above its pases, future model month = programado, version shown ──
    const patFilas = () => ev(`Array.prototype.map.call(document.querySelectorAll('#v-usd [data-pat]'), function(r){ return [r.getAttribute('data-pat'), r.querySelector('label').textContent, r.querySelector('span').textContent]; })`);
    const r5y = JSON.parse(JSON.stringify(modelY));
    r5y.cotizacionFecha = '2026-10-01T12:00:00.000Z';
    r5y.meses[9].deudas = [it('Tarjeta', 100000, false)];
    await seed(r5y, trabR44); await irTab('usd');
    check('R5 Patrimonio composition, model year: pockets, gross, debts and net on screen (550.000 + 250.000 + 700.000 = 1.500.000 - 100.000 = 1.400.000)',
      await patFilas(), await ev(`[['disponible', 'Disponible a hoy', fARS(550000)], ['ahorro', 'Ahorro en pesos', fARS(250000)], ['usd', 'Dólares', '—'], ['cripto', 'Cripto', '—'],
        ['trabajo', 'Plata del trabajo', fARS(700000)], ['bruto', 'Patrimonio bruto', fARS(1500000)], ['deudas', 'Deudas (lo que te falta pagar)', '(' + fARS(100000) + ')'],
        ['deuda', 'Tarjeta', fARS(100000)], ['neto', 'Patrimonio neto', fARS(1400000)]]`));
    check('R5 Patrimonio composition: the rows add up to the gross and gross - debts = the headline net (patrimonioPantalla, one source)',
      await ev(`(function(){ var m = patrimonioPantalla(D, hoyApp()).modelo; return [m.disponible + m.ahorroARS + m.usdARS + m.criptoARS + m.trabajo === m.bruto, m.bruto - m.pasivos === m.neto, m.neto]; })()`), [true, true, 1400000]);
    check('R5 Patrimonio composition: headline = net in dollars at the stored cotización (1.400.000 / 1.250)', await patri(), await ev(`[fUSD(1120), fARS(1400000)]`));
    await seed(legacyY, trabR44); await irTab('usd');
    check('R5 Patrimonio, legacy year: no composition rows, the old three rows', await ev(`[document.querySelectorAll('#v-usd [data-pat]').length, document.getElementById('v-usd').textContent.indexOf('Ahorro líquido en pesos') >= 0, document.getElementById('v-usd').textContent.indexOf('Todo junto') >= 0]`), [0, true, true]);
    // "Del trabajo" 400.000 unticked, one realized pase of 300.000: the excess 100.000 is tickable (real click path)
    const ex = JSON.parse(JSON.stringify(modelY));
    ex.meses[9].ingresos[1] = it('Del trabajo', 400000, false); ex.meses[10].ingresos = [];
    await seed(ex, Object.assign({}, trabR44, {pases: [trabR44.pases[0]]}));
    check('R5 Del trabajo above its pases: the excess has a checkbox (Sueldo + Del trabajo)', await ev(`document.querySelectorAll('[data-act=pagar][data-k=ingresos]').length`), 2);
    check('P3a Del trabajo above its pases: partial state in plain words (no "pases")', await ev(`document.querySelector('#v-mes .tj-vienede').textContent`), await ev(`'Cobrado ' + fARS(300000) + ' de ' + fARS(400000) + ': lo que pasaste desde Trabajo. Los ' + fARS(100000) + ' que faltan tildalos cuando los cobres.'`));
    check('R5 Del trabajo above its pases: unticked, only the pase counts (100.000 + 200.000 + 300.000 - 50.000)', await pantalla(), '550000');
    await ev(`document.querySelector('[data-act=pagar][data-k=ingresos][data-i="1"]').click(); true`); await sleep(1400);
    check('R5 Del trabajo above its pases: ticked, the excess is realized (+100.000)', [await ev(`D.meses[9].ingresos[1].pagado`), await pantalla()], [true, '650000']);
    // a future model month: rows ticked ahead are programado (pie, cap alert, tick state)
    const fu = JSON.parse(JSON.stringify(modelY));
    fu.meses[10].gastosFijos = [{nombre: 'Expensas', monto: 80000, pagado: true, tope: 50000}];
    await seed(fu, trabR44);
    await ev(`document.querySelector('[data-act=mes][data-m="10"]').click(); true`); await sleep(1400);
    check('R5 future model month: no row looks paid; the ticked one shows "programado" and can only be unticked',
      await ev(`[document.querySelectorAll('#v-mes .item.pago').length, document.querySelectorAll('#v-mes .chk.prog[data-act=pagar]').length, document.querySelector('#v-mes .chk.prog[data-act=pagar]').getAttribute('aria-label'), document.getElementById('v-mes').textContent.indexOf('Programado: noviembre todavía no llegó') >= 0]`),
      [0, 1, 'Programado: lo marcaste antes de tiempo. Tocá para desmarcarlo.', true]);
    check('R5 future model month: the cap is not consumed and there is no over-cap alert; the pie says it is programado',
      await ev(`[document.getElementById('tt-gastosFijos-0').textContent, document.getElementById('notaTopes').style.display, document.getElementById('cardTorta').textContent.indexOf('Noviembre todavía no llegó') >= 0]`), await ev(`['— de ' + fARS(50000), 'none', true]`));
    await ev(`document.querySelector('#v-mes .chk.prog[data-act=pagar]').click(); true`); await sleep(1400);
    check('R5 future model month: unticking works, and then the row cannot be ticked ahead', await ev(`[D.meses[10].gastosFijos[0].pagado, document.querySelectorAll('#v-mes [data-act=pagar][data-k=gastosFijos]').length, document.querySelectorAll('#v-mes span.chk.prog').length >= 1]`), [false, 0, true]);
    await irTab('ajustes');
    check('R5 release: the version shown in Ajustes is APPVER', await ev(`document.querySelector('#v-ajustes .pie').textContent.indexOf('TuGasto v' + APPVER) === 0`), true);
  }

  // ── R4.5: D16 cases about what the screen shows (tests/r4.matriz.test.js holds the model side; hoy here is 2026-10-04) ──
  {
    const vacio = () => { const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], [])); return ms; };
    const anio = (apertura, desde, ms, extra) => Object.assign({anio: 2026, pagoExplicito: true, cotizacionUSD: 1500, meses: ms,
      arrastre: {desde, inicial: {apertura, declarado: apertura, declaradoEl: '2026-10-01', origen: 'declarado'}}}, extra || {});
    const seed = async (year) => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.anio','2026'); localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(year))}); true`); await nav(URL_APP); await sleep(1300); };
    const pantalla = () => ev(`(${bigFinal}).replace(/[^\\d-]/g,'')`);
    const tri = () => ev(`Array.prototype.map.call(document.querySelectorAll('#v-mes .tri b'), function(b){ return b.textContent; })`);
    const irMes = async (m) => { await ev(`document.querySelector('[data-act=mes][data-m="${m}"]').click(); true`); await sleep(1400); };
    const patri = async () => { await ev(`document.querySelector('[data-act=tab][data-t=usd]').click(); true`); await sleep(1400);
      const v = await ev(`[(document.querySelector('#patriUSD b') || document.getElementById('patriUSD')).textContent, document.getElementById('bigPatri').textContent]`);
      await ev(`document.querySelector('[data-act=tab][data-t=mes]').click(); true`); await sleep(300); return v; };
    const typeIn = (sel, v) => ev(`(function(){ var x=document.querySelector(${JSON.stringify(sel)}); x.dispatchEvent(new FocusEvent('focusin',{bubbles:true})); x.value=${JSON.stringify(v)}; x.dispatchEvent(new Event('input',{bubbles:true})); x.dispatchEvent(new FocusEvent('focusout',{bubbles:true})); return true; })()`);
    const octRows = (sueldoPagado, gastos) => { const ms = vacio(); ms[9] = mes([it('Sueldo', 1000000, sueldoPagado)], gastos ? [it('Alquiler', 400000, true)] : [], gastos ? [it('Super', 100000, true)] : [], []); return ms; };

    // D16-01 + D16-16: realized salary and expenses; then an Argentine-formatted amount typed on the screen reaches the card to the peso
    await seed(anio(0, 9, octRows(true, true)));
    check('D16-01 Oct card: 1.000.000 - 400.000 - 100.000', await pantalla(), '500000');
    check('D16-01 Oct tiles Ingresos / Gastos / Ahorro', await tri(), await ev(`[fARS(1000000), fARS(500000), fARS(0)]`));
    const sup = 'input.monto[data-k=gastosVariables][data-i="0"]';
    await typeIn(sup, '100.234,56'); await sleep(1400);
    check('D16-16 "100.234,56" is stored as 100234.56', await ev('D.meses[9].gastosVariables[0].monto'), 100234.56);
    check('D16-16 ... and the card moves by exactly that (499.765,44 shown rounded)', await pantalla(), '499765');
    await typeIn(sup, '1,234.5');
    const rechazo = `(function(){ var t = document.getElementById('toast'); return [t.classList.contains('on'), t.textContent.indexOf('No entendí «1,234.5» como número') >= 0]; })()`;
    check('D16-16 "1,234.5" is rejected visibly: the toast says it was not understood', await waitFor(rechazo, [true, true]), [true, true]);
    check('D16-16 ... the stored amount is unchanged', await ev('D.meses[9].gastosVariables[0].monto'), 100234.56);
    check('D16-16 ... the field shows the stored amount back and the card did not move',
      [await ev(`document.querySelector(${JSON.stringify(sup)}).value`), await pantalla()], [await ev('fARS(100234.56)'), '499765']);
    await ev(`(function(){ var x=document.querySelector(${JSON.stringify(sup)}); x.value='1,234.5'; x.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    check('D16-16 ... while typing, the field is marked with the error class', await waitFor(`document.querySelector(${JSON.stringify(sup)}).classList.contains('err')`, true), true);
    await ev(`document.querySelector(${JSON.stringify(sup)}).dispatchEvent(new FocusEvent('focusout',{bubbles:true})); true`);

    // D16-02: pending salary, realized expenses
    await seed(anio(600000, 9, octRows(false, true)));
    check('D16-02 Oct card: opening 600.000 - 500.000 realized expenses (the pending salary is not available)', await pantalla(), '100000');
    check('D16-02 Oct tiles: no realized income', await tri(), await ev(`[fARS(0), fARS(500000), fARS(0)]`));

    // D16-03: opening + pending salary
    await seed(anio(200000, 9, octRows(false, false)));
    check('D16-03 Oct card: the opening only', await pantalla(), '200000');

    // D16-04 / D16-07 / D16-12: opening + savings, scheduled savings in November, net worth a hoy
    const s4 = (() => { const ms = octRows(true, false); ms[9].ahorroMesARS = 200000; ms[10].ahorroMesARS = 100000; return ms; })();
    await seed(anio(300000, 9, s4, {ahorroAnioAnterior: 500000}));
    check('D16-04 Oct card: 300.000 + 1.000.000 - 200.000 savings', await pantalla(), '1100000');
    check('D16-04 Oct tiles show the savings', await tri(), await ev(`[fARS(1000000), fARS(0), fARS(200000)]`));
    check('D16-12 Patrimonio a hoy: 1.100.000 + savings 700.000 (Nov savings excluded) = US$ 1.200', await patri(), await ev(`[fUSD(1200), fARS(1800000)]`));
    await irMes(10);
    check('D16-07 Nov (future) card: projection 1.100.000 - scheduled 100.000', await pantalla(), '1000000');

    // D16-13 / D16-14: the same year with a 3-installment plan unpaid from October
    const s5 = JSON.parse(JSON.stringify(s4)); [9, 10, 11].forEach(j => { s5[j].deudas = [it('Tarjeta', 100000, false)]; });
    await seed(anio(300000, 9, s5, {ahorroAnioAnterior: 500000, planDeudas: {Tarjeta: {total: 300000, recargo: 0, cuotas: 3, pagadasAntes: 0}}}));
    check('D16-13 Oct card: the unpaid installment is not deducted from available money', await pantalla(), '1100000');
    check('D16-14 Patrimonio headline is the NET: 1.800.000 - debt 300.000 = US$ 1.000', await patri(), await ev(`[fUSD(1000), fARS(1500000)]`));

    // D16-06: a confirmed September closing (175.000, calculated 200.000) that later changes (Luz ticked): the card keeps the confirmed value
    const s6 = vacio();
    s6[8] = Object.assign(mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true), it('Luz', 20000, true)], [it('Super', 200000, true)], [it('Préstamo', 100000, true)]),
      {ahorroMesARS: 150000, cierreReal: {valor: 175000, calculadoAlConfirmar: 200000, confirmadoEl: '2026-10-01'}});
    await seed(anio(50000, 8, s6));
    check('D16-06 Oct card opens from the confirmed 175.000', await pantalla(), '175000');
    await irMes(8);
    check('D16-06 Sep card keeps the confirmed closing (calculated is now 180.000)', await pantalla(), '175000');
  }

  // ── R5 (N3a): balance UX of the month view, driven by real clicks (hoy here is 2026-10-04; tests/r5.saldos.test.js holds the unit side) ──
  {
    const doce = () => { const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], [])); return ms; };
    const base = (anioN, ms, extra) => Object.assign({anio: anioN, pagoExplicito: true, cotizacionUSD: 1500, meses: ms}, extra || {});
    const seed = async (year) => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.anio','${year.anio}'); localStorage.setItem('kibo.datos.${year.anio}', ${JSON.stringify(JSON.stringify(year))}); true`); await nav(URL_APP); await sleep(1300); };
    const pantalla = () => ev(`(${bigFinal}).replace(/[^\\d-]/g,'')`);
    const clic = async (sel, ms = 1400) => { await ev(`document.querySelector(${JSON.stringify(sel)}).click(); true`); await sleep(ms); };
    const poner = (sel, v) => ev(`(function(){ var x=document.querySelector(${JSON.stringify(sel)}); x.value=${JSON.stringify(v)}; x.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
    const hay = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
    const texto = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)}) || {textContent: ''}).textContent`);
    const guardado = (y) => ev(`JSON.parse(localStorage.getItem('kibo.datos.${y}'))`);
    const octLegacy = () => { const ms = doce(); ms[9] = mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true)], [], []); return base(2026, ms); };

    // first use, Guardar: an invalid amount is rejected visibly, then 825.000 is declared (Q1: opening = 825.000 - 600.000 of October so far)
    await seed(octLegacy());
    check('R5 first use: the prompt shows on a year with data and no arrastre; no balance lines yet',
      [await hay('#primerUso'), await texto('#primerUso p b'), await texto('#saldoMes'), await pantalla()], [true, '¿Cuánto dinero tenés disponible actualmente?', '', '600000']);
    await poner('#inPrimerUso', '1,234.5'); await clic('[data-act=primerUsoOk]', 300);
    check('R5 first use: "1,234.5" is not understood, visibly, and nothing is stored (D9)',
      [await texto('#notaPrimerUso'), await ev('D.arrastre === undefined'), await ev(`localStorage.getItem('kibo.modeloSaldos')`), await ev(`document.getElementById('inPrimerUso').classList.contains('err')`)],
      ['No entendí «1,234.5» como número.', true, null, true]);
    await poner('#inPrimerUso', '825.000'); await clic('[data-act=primerUsoOk]');
    const g1 = await guardado(2026);
    check('R5 first use Guardar: arrastre declared (opening derived), snapshot marker, prompt gone, the card shows the declared money',
      [g1.arrastre.desde, g1.arrastre.inicial.apertura, g1.arrastre.inicial.declarado, g1.arrastre.inicial.origen, !!(await ev(`localStorage.getItem('kibo.modeloSaldos')`)), await hay('#primerUso'), await pantalla()],
      [9, 225000, 825000, 'declarado', true, false, '825000']);
    const s1 = await texto('#saldoMes');
    check('R5 month lines: opening with its origin, flows, available now and the estimated projection',
      ['Disponible inicial', 'Lo cargaste vos', 'Editar', 'Tenés hoy', 'Al cierre (estimado)'].map(t => s1.indexOf(t) >= 0).concat([s1.indexOf(await ev('fARS(225000)')) >= 0]),
      [true, true, true, true, true, true]);

    // D16-05 through the screen: Editar of the opening in the migration month re-declares the money available now; no movement is created
    const meses0 = JSON.stringify(g1.meses);
    await clic('[data-act=editarApertura]', 300);
    check('D16-05 Editar opens the declaration sheet prefilled with the money available now',
      [await texto('#hoja h3'), await ev(`document.getElementById('inApertura').value`)], ['¿Cuánto dinero tenés disponible actualmente?', '825.000']);
    await poner('#inApertura', '850.000'); await clic('[data-act=aperturaOk]');
    const g2 = await guardado(2026);
    check('D16-05 Editar: opening 250.000 (+25.000), the card 850.000, the rows untouched (D2, D14)',
      [g2.arrastre.inicial.apertura, g2.arrastre.inicial.declarado, await pantalla(), JSON.stringify(g2.meses) === meses0, await hay('#hoja h3')], [250000, 850000, '850000', true, false]);

    // D16-17 through the screen: Omitir, the line says it is not configured, the prompt never returns; Editar declares it later
    await seed(octLegacy());
    await clic('[data-act=primerUsoNo]');
    const g3 = await guardado(2026);
    check('D16-17 Omitir: origen omitido, shown as "Sin configurar" (P3a chip), available = what October registered',
      [g3.arrastre.inicial.origen, g3.arrastre.inicial.apertura, (await texto('#saldoMes .sdo-orig .chip')) === 'Sin configurar', await hay('#primerUso'), await pantalla()],
      ['omitido', null, true, false, '600000']);
    await nav(URL_APP); await sleep(1300);
    check('D16-17 after a reload the first-use prompt does not come back', await hay('#primerUso'), false);
    await clic('[data-act=editarApertura]', 300); await poner('#inApertura', '500.000'); await clic('[data-act=aperturaOk]');
    const g4 = await guardado(2026);
    check('D16-17 Editar declares it later: origen declarado, opening -100.000, card 500.000',
      [g4.arrastre.inicial.origen, g4.arrastre.inicial.apertura, await pantalla()], ['declarado', -100000, '500000']);

    // a model year from September: start-of-month notice (D10), real closing correction with difference (D2), reconfirm (D6)
    const sepModelo = () => { const ms = doce();
      ms[8] = Object.assign(mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true), it('Luz', 20000, false)], [it('Super', 200000, true)], []), {ahorroMesARS: 150000});
      return base(2026, ms, {arrastre: {desde: 8, inicial: {apertura: 50000, declarado: 50000, declaradoEl: '2026-09-01', origen: 'declarado'}}}); };
    await seed(sepModelo());
    check('R5 start of October: "¿Cerraste Septiembre con $300.000?" with Confirmar / Corregir / Ahora no',
      [await texto('#avisoCierre p'), await hay('#avisoCierre [data-act=avCierreOk]'), await hay('#avisoCierre [data-act=cierreAbrir]'), await hay('#avisoCierre [data-act=avCierreNo]')],
      ['¿Cerraste Septiembre con ' + await ev('fARS(300000)') + '?Es lo que da con lo que registraste. Si tenías otra plata, corregilo.', true, true, true]);
    await clic('#avisoCierre [data-act=avCierreNo]', 300);
    check('R5 "Ahora no" hides it for September on this device and writes nothing in the year',
      [await hay('#avisoCierre'), await ev(`localStorage.getItem('kibo.avisoCierre')`), (await guardado(2026)).meses[8].cierreReal === undefined], [false, '2026-09', true]);
    await nav(URL_APP); await sleep(1300);
    check('R5 ... and it stays hidden after a reload', await hay('#avisoCierre'), false);

    await ev(`document.querySelector('[data-act=mes][data-m="8"]').click(); true`); await sleep(1400);
    check('R5 September (past): "Cerraste con" (L1: the hero words) and "¿Es correcto?"',
      [(await texto('#saldoMes')).indexOf('Cerraste con') >= 0, await hay('#saldoMes [data-act=cierreAbrir]'), await pantalla()], [true, true, '300000']);
    await clic('#saldoMes [data-act=cierreAbrir]', 300);
    check('R5 the correction sheet shows what the records say', (await texto('#hoja')).indexOf('Según tus registros' + await ev('fARS(300000)')) >= 0, true);
    await poner('#inCierre', '275.000'); await sleep(100);
    check('R5 typing the real balance shows the difference live', await texto('#difCierre'), await ev('fARS(-25000)'));
    await clic('[data-act=cierreOk]');
    const g5 = await guardado(2026);
    check('R5 Confirmar writes cierreReal (informational difference, no movement) and September closes at 275.000',
      [JSON.stringify(g5.meses[8].cierreReal), await pantalla(), (await texto('#saldoMes')).indexOf('Diferencia' + await ev('fARS(-25000)')) >= 0],
      ['{"valor":275000,"calculadoAlConfirmar":300000,"confirmadoEl":"2026-10-04"}', '275000', true]);
    await ev(`document.querySelector('[data-act=mes][data-m="9"]').click(); true`); await sleep(1400);
    check('R5 October opens from the confirmed closing; the notice is gone', [await pantalla(), await hay('#avisoCierre')], ['275000', false]);

    // edit the confirmed past month: Luz ticked -> calculated 280.000, the confirmed 275.000 is kept and reconfirmation is asked (D6)
    await ev(`document.querySelector('[data-act=mes][data-m="8"]').click(); true`); await sleep(1400);
    await clic('[data-act=pagar][data-k=gastosFijos][data-i="1"]');
    check('R5 reconfirm: the confirmed value is kept, the difference shows, Usar / Dejar (P3a wording) are offered',
      [await pantalla(), (await texto('#avisoReconfirmar p')) === 'Cerraste con ' + await ev('fARS(275000)') + ' (confirmado) · tus registros ahora dan ' + await ev('fARS(280000)') + '.', await hay('#saldoMes [data-act=cierreMantener]')], ['275000', true, true]);
    await clic('#saldoMes [data-act=cierreMantener]');
    const g6 = await guardado(2026);
    check('R5 Mantener keeps 275.000 and records the new calculated value; the question goes away',
      [g6.meses[8].cierreReal.valor, g6.meses[8].cierreReal.calculadoAlConfirmar, await hay('#avisoReconfirmar'), await pantalla()], [275000, 280000, false, '275000']);
    await clic('#saldoMes [data-act=cierreAbrir]', 300); await clic('[data-act=cierreQuitar]');
    check('R5 removing the confirmation goes back to the calculated closing', [(await guardado(2026)).meses[8].cierreReal === undefined, await pantalla()], [true, '280000']);

    // start-of-month Confirmar, and a STALE tab that cannot confirm anything (Q12)
    await seed(sepModelo());
    await clic('#avisoCierre [data-act=avCierreOk]');
    check('R5 the notice Confirmar stores the calculated closing as the real one', JSON.stringify((await guardado(2026)).meses[8].cierreReal), '{"valor":300000,"calculadoAlConfirmar":300000,"confirmadoEl":"2026-10-04"}');
    await seed(sepModelo());
    await ev('obsoleta = true; true');
    await clic('#avisoCierre [data-act=cierreAbrir]', 300); await poner('#inCierre', '1'); await clic('[data-act=cierreOk]', 300);
    check('R5 a stale tab cannot confirm a closing: nothing stored, the other-tab notice shows',
      [(await guardado(2026)).meses[8].cierreReal === undefined, (await texto('#avisos')).indexOf('Hay cambios hechos en otra pestaña') >= 0], [true, true]);

    // a legacy year that does not contain hoy shows none of it
    const leg25 = (() => { const ms = doce(); ms[9] = mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true)], [], []); return base(2025, ms); })();
    await seed(leg25);
    check('R5 legacy 2025 year: no first-use prompt, no notice, no balance lines, the card is the old calc()',
      [await hay('#primerUso'), await hay('#avisoCierre'), await texto('#saldoMes'), await pantalla()], [false, false, '', '600000']);
  }

  // ── N6: backup -> modify everything -> restore through the real confirm button; storage AND screens equal the backup ──
  {
    const doce6 = () => { const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], [])); return ms; };
    const ms25 = doce6(); ms25[11] = Object.assign(mes([it('Sueldo', 800000, true)], [it('Alquiler', 300000, true)], [it('Super', 90000, true)], []), {ahorroMesARS: 120000, compraARS: 60000, compraUSD: 40, ahorroMesUSD: 40});
    const y25 = {anio: 2025, pagoExplicito: true, cotizacionUSD: 1250, meses: ms25, rev: 3};
    const ms26 = doce6();
    ms26[8] = Object.assign(mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true)], [it('Super', 100000, true)], [it('Préstamo', 100000, true)]),
      {ahorroMesARS: 150000, compraARS: 125000, compraUSD: 100, cierreReal: {valor: 175000, calculadoAlConfirmar: 200000, confirmadoEl: '2026-10-01'}});
    ms26[9] = mes([it('Sueldo', 1000000, true), it('Del trabajo', 100000, true)], [it('Alquiler', 400000, false)], [], [it('Préstamo', 100000, false)]);
    const y26 = {anio: 2026, pagoExplicito: true, cotizacionUSD: 1250, cotizacionFecha: '2026-10-01', ahorroAnioAnterior: 500000, usdAnioAnterior: 1000, rev: 9,
      cripto: [{activo: 'BTC', cantidad: 0.01, precioUSD: 60000}], planDeudas: {'Préstamo': {total: 600000, recargo: 0, cuotas: 6, pagadasAntes: 2}},
      arrastre: {desde: 8, inicial: {apertura: 50000, declarado: 50000, declaradoEl: '2026-09-01', origen: 'declarado'}}, meses: ms26};
    const tr6 = {version: 1, activo: true, modo: 'simple', facturas: [], gastos: [], productos: [], tope: 5, rev: 4,
      cobros: [{id: 'c1', cliente: '', monto: 900000, fecha: '2026-01-01', forma: 'transferencia', aplic: []}],
      pases: [{id: 'p1', fecha: '2026-10-02', monto: 100000, anio: 2026, mes: 9}, {id: 'p2', fecha: '2026-11-20', monto: 50000, anio: 2026, mes: 10}]};
    const tab6 = async (t, ms = 1400) => { await ev(`document.querySelector('[data-act=tab][data-t=${t}]').click(); true`); await sleep(ms); };
    const foto6 = async () => {
      const st = await ev(`(function(){ function s(k){ var o = JSON.parse(localStorage.getItem(k)); if(!o) return null; delete o.rev; return o; } var t = s('kibo.trabajo'); if(t) delete t.actualizado; return {y25: s('kibo.datos.2025'), y26: s('kibo.datos.2026'), trab: t}; })()`);
      const card = await ev(`(${bigFinal}).replace(/[^\\d-]/g,'')`);
      const csv = await ev(`(async function(){ var o = URL.createObjectURL, b = null; URL.createObjectURL = function(x){ b = x; return o.call(URL, x); }; try{ exportarCSV(); } finally{ URL.createObjectURL = o; } return await b.text(); })()`);
      await tab6('usd'); const patri6 = await ev(`document.getElementById('bigPatri').textContent + ' | ' + document.getElementById('patriUSD').textContent + ' | ' + document.getElementById('v-usd').textContent`);
      await tab6('anio'); const anio6 = await ev(`document.getElementById('v-anio').textContent`);
      await tab6('trabajo'); const tj6 = await ev(`document.getElementById('tjDisp').textContent`);
      await tab6('mes', 800);
      return {st, card, csv, patri: patri6, anio: anio6, trabajo: tj6};
    };
    await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.anio','2026');
      localStorage.setItem('kibo.datos.2025', ${JSON.stringify(JSON.stringify(y25))}); localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(y26))});
      localStorage.setItem('kibo.trabajo', ${JSON.stringify(JSON.stringify(tr6))}); true`);
    await nav(URL_APP); await sleep(1300);
    const antes6 = await foto6();
    const copia6 = await ev(`JSON.stringify(armarCopia())`);
    check('N6 e2e: the backup holds both years and Trabajo with both pases', await ev(`(function(c){ c = JSON.parse(c); return [Object.keys(c.anios).sort(), c.trabajo.pases.length, !!c.anios[2026].arrastre, !!c.anios[2026].meses[8].cierreReal]; })(${JSON.stringify(copia6)})`), [['2025', '2026'], 2, true, true]);
    // modify everything: other 2026 numbers, 2025 gone, empty Trabajo, a new 2027
    await ev(`(function(){ var y = JSON.parse(localStorage.getItem('kibo.datos.2026')); y.meses[9].ingresos[0].monto = 1; y.cripto = []; y.cotizacionUSD = 999; delete y.arrastre; y.rev++;
      localStorage.setItem('kibo.datos.2026', JSON.stringify(y)); localStorage.removeItem('kibo.datos.2025');
      localStorage.setItem('kibo.trabajo', JSON.stringify({version: 1, activo: true, modo: 'simple', facturas: [], cobros: [], pases: [], gastos: [], productos: [], tope: 0, rev: 7}));
      localStorage.setItem('kibo.datos.2027', JSON.stringify({anio: 2027, pagoExplicito: true, meses: []})); return true; })()`);
    await nav(URL_APP); await sleep(1300);
    const cambiado6 = await foto6();
    check('N6 e2e: after the changes the screens differ from the backup (non-vacuous)', [cambiado6.card === antes6.card, cambiado6.csv === antes6.csv, cambiado6.patri === antes6.patri], [false, false, false]);
    // restore through the real sheet button, then reload
    await ev(`restaurarTexto(${JSON.stringify(copia6)}); true`); await sleep(300);
    await ev(`document.querySelector('#hoja [data-act=confirmar]').click(); true`); await sleep(800);
    await nav(URL_APP); await sleep(1300);
    check('N6 e2e: a year that is not in the backup is left alone; revisions moved forward', await ev(`[!!localStorage.getItem('kibo.datos.2027'), JSON.parse(localStorage.getItem('kibo.datos.2026')).rev > 10]`), [true, true]);
    await ev(`localStorage.removeItem('kibo.datos.2027'); true`); await nav(URL_APP); await sleep(1300);   // so "Año por año" lists the same years as before
    const despues6 = await foto6();
    const esperado6 = (() => { const c = JSON.parse(copia6), sr = (o) => { o = JSON.parse(JSON.stringify(o)); delete o.rev; return o; }; const t = sr(c.trabajo); delete t.actualizado; return {y25: sr(c.anios[2025]), y26: sr(c.anios[2026]), trab: t}; })();
    check('N6 e2e: stored years (minus rev) and Trabajo (minus rev/actualizado) equal the backup', despues6.st, esperado6);
    check('N6 e2e: month card, CSV, Patrimonio, El año and Trabajo screens equal the backup', [despues6.card, despues6.csv, despues6.patri, despues6.anio, despues6.trabajo], [antes6.card, antes6.csv, antes6.patri, antes6.anio, antes6.trabajo]);
    // an old pre-R4 (7f7ad40-era) backup on a wiped phone: restores cleanly and reads exactly as that data always read
    const viejo6 = {anio: 2024, version: 1, actualizado: '2024-07-20T10:00:00.000Z', cotizacionUSD: 1400, planDeudas: {'Préstamo': {total: 600, recargo: 0, cuotas: 12, pagadasAntes: 1}},
      meses: Array.from({length: 12}, (_, i) => ({ingresos: [{nombre: 'Sueldo', monto: i < 6 ? '1000' : 0}], gastosFijos: [{nombre: 'Alquiler', monto: 300}], gastosVariables: [], deudas: [{nombre: 'Préstamo', monto: 50}], ahorroMesARS: 20, movimientos: []}))};
    await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); true`); await nav(URL_APP); await sleep(800);
    await ev(`restaurarTexto(${JSON.stringify(JSON.stringify({app: 'kibFinanzas', version: 1, anios: {2024: viejo6}}))}); true`); await sleep(300);
    await ev(`document.querySelector('#hoja [data-act=confirmar]').click(); true`); await sleep(800);
    check('N6 e2e: an old pre-R4 backup restores into its year, without a model, with the same year numbers',
      await ev(`[D.anio, D.arrastre === undefined, JSON.stringify(serie(D)) === JSON.stringify(serie(TGMotor.normalizar(${JSON.stringify(viejo6)}, hoyApp())))]`), [2024, true, true]);
  }

  // ── N4 I-3: an unreadable stored year is quarantined, warned about, and never overwritten ──
  {
    const roto = '{"anio":2026,"meses":[{"ingresos":[{"nombre":"Sueldo","monto":900000';
    await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.anio','2026'); localStorage.setItem('kibo.datos.2026', ${JSON.stringify(roto)}); true`);
    await nav(URL_APP); await sleep(1300);
    check('N4 I-3 e2e: the warning shows and the raw text is copied to quarantine',
      await ev(`[document.getElementById('avisos').textContent.indexOf('No pude leer los datos de 2026. Los aparté tal cual para que no se pierdan, y ese año no se modifica.') >= 0, localStorage.getItem('kibo.cuarentena.2026') === ${JSON.stringify(roto)}]`), [true, true]);
    await ev(`D.meses[9].ingresos[0] = {nombre: 'Sueldo', monto: 5, pagado: true}; sucio = true; guardar(); true`); await sleep(300);
    check('N4 I-3 e2e: a save does not overwrite the unreadable year', await ev(`localStorage.getItem('kibo.datos.2026') === ${JSON.stringify(roto)}`), true);
    check('N4 I-3 e2e: the backup carries the raw text', await ev(`armarCopia().cuarentena[2026] === ${JSON.stringify(roto)}`), true);
  }

  // ── P2 branding: the visible product name is TuGasto (title, header mark, Ajustes, exports, manifest, every tab) ──
  {
    await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.anio','2026'); localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(legacy))});
      localStorage.setItem('kibo.trabajo', JSON.stringify({version: 1, activo: true, modo: 'simple', facturas: [], cobros: [], pases: [], gastos: [], productos: [], tope: 0, rev: 1})); true`);   // Trabajo on, so its tab and CSV exist
    await nav(URL_APP); await sleep(800);
    check('P2 brand: document.title starts with "TuGasto"', await ev(`[document.title.indexOf('TuGasto') === 0, document.title]`), [true, 'TuGasto · 2026']);
    check('P2 brand: the header shows the TG mark, titled TuGasto', await ev(`[document.querySelector('#titulo .kf').textContent, document.getElementById('titulo').title]`), ['TG', 'TuGasto']);
    check('P2 brand: the manifest the page links is named TuGasto', await ev(`fetch(document.querySelector('link[rel=manifest]').href).then(function(r){ return r.json(); }).then(function(m){ return [m.name, m.short_name]; })`), ['TuGasto', 'TuGasto']);
    // every text node and every user-facing attribute of the rendered DOM, per tab: no old brand anywhere
    const viejaMarca = `(function(){ var out = [], re = /kib ?finanzas/i, mono = /\\bKF\\b/, t = function(s){ return re.test(s) || mono.test(s); };
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n; while((n = w.nextNode())) if(t(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 60));
      Array.prototype.forEach.call(document.querySelectorAll('[title],[aria-label],[placeholder],[alt]'), function(e){ ['title', 'aria-label', 'placeholder', 'alt'].forEach(function(a){ var v = e.getAttribute(a); if(v && t(v)) out.push(a + '=' + v); }); });
      if(t(document.title)) out.push('title=' + document.title); return out; })()`;
    for(const tab of ['mes', 'anio', 'usd', 'trabajo', 'ajustes']){
      await ev(`document.querySelector('[data-act=tab][data-t=${tab}]').click(); true`); await sleep(500);
      check(`P2 brand: no visible kibFinanzas/KF text in the rendered "${tab}" tab`, await ev(viejaMarca), []);
    }
    await ev(`(function(){ var b = document.createElement('button'); b.setAttribute('data-act', 'verBienvenida'); document.body.appendChild(b); b.click(); document.body.removeChild(b); return true; })()`); await sleep(300);   // Ajustes → the welcome sheet
    check('P2 brand: the welcome sheet says "Bienvenido a TuGasto"', await ev(`document.getElementById('hoja').textContent.indexOf('Bienvenido a TuGasto') >= 0`), true);
    check('P2 brand: no visible kibFinanzas/KF text with the welcome sheet open', await ev(viejaMarca), []);
    await ev(`(function(){ var h = document.querySelector('#hoja [data-act=cerrar]'); if(h) h.click(); return true; })()`); await sleep(300);
    check('P2 brand: the Ajustes footer starts with "TuGasto v"', await ev(`document.querySelector('#v-ajustes .pie').textContent.indexOf('TuGasto v' + APPVER) === 0`), true);
    // exported file names, through the real actions (Web Share disabled so the backup takes the download path)
    const nombres = await ev(`(async function(){ var n = [], o = HTMLAnchorElement.prototype.click, ou = URL.createObjectURL, csvT = null;
      Object.defineProperty(navigator, 'share', {value: undefined, configurable: true});
      HTMLAnchorElement.prototype.click = function(){ if(this.download) n.push(this.download); };
      URL.createObjectURL = function(b){ if(n.length === 3) csvT = b; return ou.call(URL, b); };
      var dar = function(a){ var b = document.createElement('button'); b.setAttribute('data-act', a); document.body.appendChild(b); b.click(); document.body.removeChild(b); };
      try{
        dar('copia'); dar('expcsv'); dar('verpc');
        for(var i = 0; i < 80 && n.length < 3; i++) await new Promise(function(r){ setTimeout(r, 100); });
        dar('tjCSV');
      } finally { HTMLAnchorElement.prototype.click = o; URL.createObjectURL = ou; delete navigator.share; }
      var primera = csvT ? (await csvT.text()).replace(/^\\ufeff/, '').split('\\r\\n')[0] : null;
      return {nombres: n.map(function(x){ return x.replace(/\\d{4}-\\d{2}-\\d{2}/, 'FECHA'); }), primera: primera && primera.replace(/exportado el .*$/, 'exportado el …')}; })()`);
    check('P2 brand: exported file names start with "tugasto-"', nombres.nombres, ['tugasto-copia-FECHA.json', 'tugasto-2026.csv', 'tugasto-2026.html', 'tugasto-trabajo-FECHA.csv']);
    check('P2 brand: the Trabajo CSV first line names TuGasto', nombres.primera, 'TuGasto · Trabajo por mi cuenta · exportado el …');
    await ev(`(function(){ var h = document.querySelector('#hoja [data-act=cerrar]'); if(h) h.click(); return true; })()`); await sleep(300);
  }

  // ── P3a redesign of the month view: what the screen SAYS (texts, states, colors) and that it fits (tap targets, no overflow) ──
  // hoy here is 2026-10-04. Model year from September: Sep confirmed at 275.000 while its records now give 300.000 (Luz unpaid);
  // Oct: Sueldo paid, "Del trabajo" 400.000 with one 300.000 pase on 2/10, Aguinaldo and Internet unpaid, installment 10 of 12 unpaid;
  // Nov: Sueldo ticked ahead. Expected: Oct available = 275.000 + 1.000.000 + 300.000 - 400.000 = 1.175.000; to collect 100.000 + 120.000;
  // to pay 22.000 + 100.000; closing estimate 1.175.000 + 220.000 - 122.000 = 1.273.000; overdue 20.000 (Sep Luz).
  {
    const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    ms[8] = Object.assign(mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true), it('Luz', 20000, false)], [it('Super', 200000, true)], []),
      {ahorroMesARS: 150000, cierreReal: {valor: 275000, calculadoAlConfirmar: 280000, confirmadoEl: '2026-10-01'}});
    ms[9] = mes([it('Sueldo', 1000000, true), it('Del trabajo', 400000, false), it('Aguinaldo', 120000, false)], [it('Alquiler', 400000, true), it('Internet', 22000, false)], [], [it('Préstamo', 100000, false)]);
    ms[10] = mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, false)], [], [it('Préstamo', 100000, false)]);
    const y = {anio: 2026, pagoExplicito: true, cotizacionUSD: 1500, meses: ms, planDeudas: {'Préstamo': {total: 1200000, recargo: 0, cuotas: 12, pagadasAntes: 9}},
      arrastre: {desde: 8, inicial: {apertura: 50000, declarado: 50000, declaradoEl: '2026-09-01', origen: 'declarado'}}};
    const tj = {version: 1, activo: true, modo: 'simple', facturas: [], gastos: [], productos: [], tope: 0,
      cobros: [{id: 'c1', cliente: '', monto: 1000000, fecha: '2026-01-01', forma: 'transferencia', aplic: []}], pases: [{id: 'p1', fecha: '2026-10-02', monto: 300000, anio: 2026, mes: 9}]};
    const seed = async (year, trabajo) => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.ultimaCopia', new Date().toISOString()); localStorage.setItem('kibo.anio','${year.anio}');
      localStorage.setItem('kibo.datos.${year.anio}', ${JSON.stringify(JSON.stringify(year))}); ${trabajo ? `localStorage.setItem('kibo.trabajo', ${JSON.stringify(JSON.stringify(trabajo))});` : ''} true`); await nav(URL_APP); await sleep(1300); };
    const texto = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)}) || {textContent: ''}).textContent`);
    const textos = (sel) => ev(`Array.prototype.map.call(document.querySelectorAll(${JSON.stringify(sel)}), function(e){ return e.textContent; })`);
    const irMes = async (m) => { await ev(`document.querySelector('[data-act=mes][data-m="${m}"]').click(); true`); await sleep(1400); };
    const F = (n) => ev(`fARS(${n})`);
    const fila = (txt) => ev(`(function(){ var r = Array.prototype.filter.call(document.querySelectorAll('#saldoMes .sdo-f'), function(f){ return f.querySelector('span').textContent === ${JSON.stringify(txt)}; })[0]; return r ? r.querySelector('b').textContent : null; })()`);
    const guardado = () => ev(`JSON.parse(localStorage.getItem('kibo.datos.2026'))`);
    const colorAcc = `(function(){ var d = document.createElement('div'); d.style.color = 'var(--acc)'; document.body.appendChild(d); var c = getComputedStyle(d).color; document.body.removeChild(d); return c; })()`;

    await seed(y, tj);
    check('P3a current month: the hero says "Tenés hoy" with the available money, the same as the balance block "Tenés hoy" (L1: one vocabulary)',
      [await texto('#hero .hero-lbl'), await texto('#bigFinal'), await fila('Tenés hoy')], ['Tenés hoy', await F(1175000), await F(1175000)]);
    check('P3a current month: the estimated closing below the hero, not green, equal to the balance block projection',
      [await texto('#heroSub'), await fila('Al cierre (estimado)'), await ev(`getComputedStyle(document.querySelector('#heroSub')).color !== ${colorAcc}`)],
      ['Al cierre: ' + await F(1273000) + ' · estimado', await F(1273000), true]);
    check('P3a current month: pending chips with the engine amounts (to collect, to pay, overdue)', await textos('#heroChips .chip'),
      ['Te falta cobrar ' + await F(220000), 'Te falta pagar ' + await F(122000), 'Atrasado ' + await F(20000)]);
    check('P3a hero tiles are labeled Cobrado / Pagado (what was realized)', await textos('#hero .tri small'), ['Cobrado', 'Pagado', 'Ahorro']);
    check('P3a no hero buttons that repeat the tab bar', await ev(`[!!document.querySelector('#v-mes [data-act=tab]'), document.getElementById('hero').textContent.indexOf('El año') < 0]`), [false, true]);
    await ev(`document.querySelector('#heroChips [data-v=pagar]').click(); true`); await sleep(1000);
    check('P3a the "Te falta pagar" chip takes you to the first section with something unpaid', await ev(`(function(){ var t = document.querySelector('.sec[data-sec=gastosFijos]').getBoundingClientRect().top; return t >= 0 && t < 160; })()`), true);
    check('P3a section header: total and "falta $X"', [await texto('#sub-ingresos'), await texto('#falta-ingresos'), await texto('#falta-gastosFijos')],
      [await F(1520000), 'falta ' + await F(220000), 'falta ' + await F(22000)]);
    check('P3a row states: pending rows say "Falta", paid rows have the solid check', [await textos('#v-mes .sec[data-sec=gastosFijos] .item .est'), await ev(`document.querySelectorAll('#v-mes .sec[data-sec=gastosFijos] .item.pago .chk.on').length`)], [['Falta'], 1]);
    check('P3a Del trabajo partial state in plain words', await texto('#v-mes .tj-vienede'), 'Cobrado ' + await F(300000) + ' de ' + await F(400000) + ': lo que pasaste desde Trabajo. Los ' + await F(100000) + ' que faltan tildalos cuando los cobres.');
    check('P3a debt row: "Cuota 10 de 12 · pendiente"', (await texto('#v-mes [data-act=plan]')).indexOf('Cuota 10 de 12 · pendiente') === 0, true);
    check('P3a the opening shows where it comes from as a chip, and Editar is a 44 px target', [await texto('#saldoMes .sdo-orig .chip'),
      await ev(`(function(){ var r = document.querySelector('#saldoMes [data-act=editarApertura]').getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })()`)], ['Corregido en Septiembre', true]);

    await irMes(10);
    check('P3a future month: "Proyectado para Noviembre" with a Programado chip, never the green hero', [await texto('#hero .hero-lbl'), await textos('#heroChips .chip'),
      await ev(`document.getElementById('bigFinal').className`), await ev(`getComputedStyle(document.getElementById('bigFinal')).color !== ${colorAcc}`)],
      ['Proyectado para Noviembre', ['Programado'], 'big proy', true]);
    check('P3a future month: the row ticked ahead shows the dashed ring and the "Programado" chip', [await textos('#v-mes .sec[data-sec=ingresos] .item.progr .est'), await ev(`document.querySelectorAll('#v-mes .sec[data-sec=ingresos] .item.progr .chk.prog').length`)], [['Programado'], 1]);

    await irMes(8);
    check('P3a past month: "Cerraste con" the confirmed closing, "Confirmado"', [await texto('#hero .hero-lbl'), await texto('#bigFinal'), await textos('#heroChips .chip')], ['Cerraste con', await F(275000), ['Confirmado']]);
    check('P3a re-confirm block: plain text and the two choices with their amounts, amber (no red class)',
      [await texto('#avisoReconfirmar p'), await textos('#avisoReconfirmar .mini'), await ev(`[document.getElementById('avisoReconfirmar').className, !!document.querySelector('#avisoReconfirmar .mal')]`)],
      ['Cerraste con ' + await F(275000) + ' (confirmado) · tus registros ahora dan ' + await F(300000) + '.', ['Usar ' + await F(300000), 'Dejar ' + await F(275000)], ['sdo-reconf', false]]);
    await ev(`document.querySelector('#avisoReconfirmar [data-act=cierreMantener]').click(); true`); await sleep(1400);
    const g1 = await guardado();
    check('P3a "Dejar $275.000" is Mantener: the confirmed value stays, the new calculation is recorded', [g1.meses[8].cierreReal.valor, g1.meses[8].cierreReal.calculadoAlConfirmar, await ev(`!!document.getElementById('avisoReconfirmar')`)], [275000, 300000, false]);
    await seed(y, tj); await irMes(8);
    await ev(`document.querySelector('#avisoReconfirmar [data-act=avCierreOk]').click(); true`); await sleep(1400);
    const g2 = await guardado();
    check('P3a "Usar $300.000" confirms what the records give (the start-of-month Confirmar action); the hero follows', [g2.meses[8].cierreReal.valor, g2.meses[8].cierreReal.calculadoAlConfirmar, await texto('#bigFinal')], [300000, 300000, await F(300000)]);

    // tap targets and overflow at phone widths
    const pequenos = `(function(){ var out = []; document.querySelectorAll('#v-mes button, #v-mes a, #v-mes [data-act], #v-mes .chk, #v-mes summary, header button, #nav button, #fab').forEach(function(t){
      var r = t.getBoundingClientRect(); if(!r.width || !r.height || getComputedStyle(t).visibility === 'hidden') return;
      if(r.width < 44 || r.height < 44) out.push((t.getAttribute('data-act') || t.className || t.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }); return out; })()`;
    const anchos = `(function(){ var W = innerWidth, out = []; if(document.documentElement.scrollWidth > W) out.push('page ' + document.documentElement.scrollWidth);
      document.querySelectorAll('#v-mes *').forEach(function(e){ if(e.closest('.meses') || e.closest('.carr-pista')) return; var r = e.getBoundingClientRect(); if(r.width && r.right > W + 1) out.push(e.tagName + '.' + e.className + ' ' + Math.round(r.right)); });
      return out.slice(0, 5); })()`;
    await seed(y, tj);
    for(const w of [360, 390, 430]){
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: 844, deviceScaleFactor: 2, mobile: true }); await sleep(400);
      if(w === 390) check('P3a tap targets on the month view at 390: all at least 44 x 44', await ev(pequenos), []);
      for(const m of [8, 9, 10]){ await irMes(m); check(`P3a no horizontal overflow at ${w} px, month ${m + 1}`, await ev(anchos), []); }
    }
    await send('Emulation.clearDeviceMetricsOverride');

    // first use: the question takes the hero's place; with data, the simple calculation stays below it, gray and marked
    const leg = JSON.parse(JSON.stringify(y)); delete leg.arrastre; delete leg.meses[8].cierreReal;
    await seed(leg, null);
    check('P3a first use: the question comes before any number; the simple calculation below is gray and marked',
      [await ev(`!!(document.getElementById('primerUso').compareDocumentPosition(document.getElementById('bigFinal')) & Node.DOCUMENT_POSITION_FOLLOWING)`),
       await ev(`document.getElementById('hero').classList.contains('hero-apagado')`), await ev(`document.getElementById('bigFinal').className`), await textos('#heroChips .chip')],
      [true, true, 'big proy', ['Cálculo simple']]);
    // fresh install: welcome sheet, then "Esta app está vacía" alone, then the first-use question alone; no zero rows
    await ev(`localStorage.clear(); true`); await nav(URL_APP); await sleep(800);
    const visible = (sel) => ev(`(function(){ var e = document.querySelector(${JSON.stringify(sel)}); return !!e && !!(e.offsetWidth || e.offsetHeight); })()`);
    check('P3a fresh install: first the welcome sheet', await visible('#hoja [data-act=bienvOk]'), true);
    await ev(`document.querySelector('[data-act=bienvOk]').click(); true`); await sleep(800);
    check('P3a fresh install: then only "Esta app está vacía" (no first-use question, no card, no zero rows)',
      [await visible('#avisos [data-av=vacia]'), await visible('#primerUso'), await visible('#carrMes'), await ev(`document.querySelectorAll('#v-mes .item input.monto').length`), await ev(`document.querySelectorAll('#v-mes [data-act=verFilas]').length`)],
      [true, false, false, 0, 4]);
    await ev(`document.querySelector('#avisos [data-act=cerrarAviso]').click(); true`); await sleep(500);
    check('P3a fresh install: "Empezar de cero" leads to the first-use question, alone', [await visible('#avisos [data-av=vacia]'), await visible('#primerUso'), await visible('#bigFinal')], [false, true, false]);
    // legacy year (no arrastre, not the current year): same numbers, marked as the simple calculation
    const y25 = JSON.parse(JSON.stringify(leg)); y25.anio = 2025;
    await seed(y25, null);
    check('P3a legacy year: "Disponible final" with the "Cálculo simple" chip; the number is calc() unchanged',
      [await texto('#hero .hero-lbl'), await textos('#heroChips .chip'), await texto('#bigFinal')], ['Disponible final', ['Cálculo simple'], await ev('fARS(calc(D.meses[9]).disponibleFinal)')]);
  }

  // ── L1 (P3b): El año, Patrimonio, Trabajo, the update notice, Gasto in the tab bar, desktop, one vocabulary, fit ──
  // hoy here is 2026-10-04. Model year from September (as the P3a block) plus: US$ 1.200 from last year, US$ 100 bought in September and
  // US$ 50 scheduled for November; Trabajo (professional) with 1.000.000 collected, a pase on 2/10 (300.000, realized) and one on 5/11
  // (200.000, scheduled, Q4), one open invoice due in 20 days.
  {
    const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    ms[8] = Object.assign(mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true), it('Luz', 20000, false)], [it('Super', 200000, true)], []),
      {ahorroMesARS: 150000, compraARS: 145000, compraUSD: 100, cierreReal: {valor: 275000, calculadoAlConfirmar: 280000, confirmadoEl: '2026-10-01'}});
    ms[9] = mes([it('Sueldo', 1000000, true), it('Del trabajo', 400000, false), it('Aguinaldo', 120000, false)], [it('Alquiler', 400000, true), it('Internet', 22000, false)], [], [it('Préstamo', 100000, false)]);
    ms[10] = Object.assign(mes([it('Sueldo', 1000000, true), it('Del trabajo', 200000, false)], [it('Alquiler', 400000, false)], [], [it('Préstamo', 100000, false)]), {ahorroMesARS: 100000, ahorroMesUSD: 50});
    const y = {anio: 2026, pagoExplicito: true, cotizacionUSD: 1500, cotizacionFecha: '2026-10-01T12:00:00.000Z', ahorroAnioAnterior: 600000, usdAnioAnterior: 1200,
      cripto: [{activo: 'BTC', cantidad: 0.01, precioUSD: 60000}], meses: ms, planDeudas: {'Préstamo': {total: 1200000, recargo: 0, cuotas: 12, pagadasAntes: 9}},
      arrastre: {desde: 8, inicial: {apertura: 50000, declarado: 50000, declaradoEl: '2026-09-01', origen: 'declarado'}}};
    const tj = {version: 1, activo: true, modo: 'pro', gastos: [], productos: [], tope: 0,
      facturas: [{id: 'f1', tipo: 'factura', cliente: 'Panadería', numero: 'A-1', concepto: 'Mantenimiento', monto: 320000, cantidad: 1, precio: 320000, base: 320000, ajuste: 0, fecha: '2026-09-24', contado: false, plazo: 30, forma: 'transferencia', creada: '2026-09-24T10:00:00.000Z'}],
      cobros: [{id: 'c1', cliente: '', monto: 1000000, fecha: '2026-01-01', forma: 'transferencia', aplic: []}],
      pases: [{id: 'p1', fecha: '2026-10-02', monto: 300000, anio: 2026, mes: 9}, {id: 'p2', fecha: '2026-11-05', monto: 200000, anio: 2026, mes: 10}]};
    const seed = async (year, trabajo, sinEsquema) => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.ultimaCopia', new Date().toISOString()); ${sinEsquema ? '' : "localStorage.setItem('kibo.esquema', '1.30');"} localStorage.setItem('kibo.anio','${year.anio}');
      localStorage.setItem('kibo.datos.${year.anio}', ${JSON.stringify(JSON.stringify(year))}); ${trabajo ? `localStorage.setItem('kibo.trabajo', ${JSON.stringify(JSON.stringify(trabajo))});` : ''} true`); await nav(URL_APP); await sleep(1300); };
    const tamano = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h || (w < 800 ? 844 : 900), deviceScaleFactor: w < 800 ? 2 : 1, mobile: w < 800 }); await sleep(400); };
    const texto = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)}) || {textContent: ''}).textContent`);
    const textos = (sel) => ev(`Array.prototype.map.call(document.querySelectorAll(${JSON.stringify(sel)}), function(e){ return e.textContent; })`);
    const irTab = async (t) => { await ev(`document.querySelector('[data-act=tab][data-t=${t}]').click(); true`); await sleep(1200); };
    const filaAn = (k) => ev(`(function(){ var r = document.querySelector('#heroAnio [data-an=${k}]'); return r ? [r.querySelector('span').textContent, r.querySelector('b').textContent] : null; })()`);
    const celdas = (sec, i) => ev(`(function(){ var r = document.querySelectorAll('#v-${sec === 'anTabla' ? 'anio' : 'usd'} [data-sec=${sec}] tbody tr')[${i}]; return r ? Array.prototype.map.call(r.children, function(c){ return c.textContent; }) : null; })()`);
    const P = () => ev(`plain(patrimonioPantalla(D, hoyApp()))`);
    await tamano(390);
    await seed(y, tj);
    const heroMes = await texto('#bigFinal');

    // 1 · El año: a hoy vs al cierre del año (estimado), each figure labeled and equal to its source
    await irTab('anio');
    const p0 = await P(), tot = await celdas('anTabla', 12);
    check('L1 El año: one hero, first, "Tenés hoy" = the month hero (the chain), chip "A hoy"',
      [await ev(`document.querySelector('#v-anio').firstElementChild.id`), await ev(`document.querySelectorAll('#v-anio .saldo.hero').length`), await texto('#heroAnio .hero-lbl'), await texto('#anBig'), await textos('#heroAnio .chip')],
      ['heroAnio', 1, 'Tenés hoy', heroMes, ['A hoy']]);
    check('L1 El año: "Ahorro acumulado a hoy" = the Patrimonio source (patrimonioNeto)', await filaAn('ahorroHoy'), ['Ahorro acumulado a hoy', await ev(`fARS(${p0.ahorroARS})`)]);
    check('L1 El año: the two December figures have distinct labels; the closing ones equal the table Total (December row of the chain)',
      [await filaAn('dispCierre'), await filaAn('ahorroCierre'), await texto('#heroAnio .an-tit')],
      [['Disponible en diciembre', tot[8]], ['Ahorro en diciembre (con lo programado)', tot[9]], 'Al cierre del año (estimado)']);
    check('L1 El año: the pace is not the closing ("Ahorro a este ritmo en diciembre"); "Ahorro con el que arrancaste el año" replaces "Arranque del año"; the table says the closing is estimated',
      await ev(`(function(){ var t = document.getElementById('v-anio').textContent; return [t.indexOf('Ahorro a este ritmo en diciembre:') >= 0, t.indexOf('A este ritmo cerrás') < 0, t.indexOf('Ahorro con el que arrancaste el año') >= 0, t.indexOf('Arranque del año') < 0,
        document.querySelector('#v-anio [data-sec=anTabla] .sub').textContent === 'Cierre ' + ${JSON.stringify(tot[8])} + 'estimado']; })()`), [true, true, true, true, true]);
    check('L1 El año: "Ahorro acumulado" header says it is December, estimated', await texto('#v-anio [data-sec=anAhorro] .sub'), tot[9] + 'en diciembre · estimado');

    // 2 · Patrimonio: the tab is named Patrimonio (internal id usd), the answer first, dollars a hoy vs programado
    check('L1 Patrimonio: the tab bar says "Patrimonio" (data-t stays "usd"); no "USD" tab label', [(await texto('#nav [data-t=usd]')).trim(), await ev(`Array.prototype.some.call(document.querySelectorAll('#nav button'), function(b){ return b.textContent.trim() === 'USD'; })`)], ['Patrimonio', false]);
    await irTab('usd');
    const p1 = await P(), s11 = await ev(`serie(D)[11].usdAcumulado`);
    check('L1 Patrimonio: the hero comes first: net worth in pesos, the dollar equivalent below it',
      [await ev(`document.querySelector('#v-usd').firstElementChild.id`), await texto('#heroPatri .hero-lbl'), await texto('#bigPatri'), await texto('#patriUSD')],
      ['heroPatri', 'Patrimonio neto a hoy', await ev(`fARS(${p1.patrimonioARS})`), 'En dólares: ' + await ev(`fUSD(${p1.patrimonioUSD})`)]);
    check('L1 Patrimonio: order hero → composition → dollars → Datos; the inputs live only in Datos',
      await ev(`(function(){ var v = document.getElementById('v-usd'), k = ['#heroPatri', '[data-sec=usdPatri]', '[data-sec=usdMeses]', '[data-sec=usdDatos]'].map(function(s){ return Array.prototype.indexOf.call(v.children, v.querySelector(s)); });
        var datos = v.querySelector('[data-sec=usdDatos]'); return [k[0] < k[1] && k[1] < k[2] && k[2] < k[3], ['cotizacionUSD', 'usdAnioAnterior'].every(function(c){ var x = v.querySelectorAll('[data-campo=' + c + ']'); return x.length === 1 && datos.contains(x[0]); }), datos.contains(v.querySelector('[data-act=addCripto]'))]; })()`), [true, true, true]);
    check('L1 Patrimonio: "Dólares mes a mes" never mixes the scheduled US$ 50 into "a hoy": A hoy = the composition dollars, programado apart',
      [s11 - p1.usd, (await celdas('usdMeses', 12))[0], (await celdas('usdMeses', 12))[3], (await celdas('usdMeses', 13))[0], (await celdas('usdMeses', 13))[1], (await celdas('usdMeses', 13))[3],
       await ev(`document.querySelector('#v-usd [data-pat=usd] label').textContent.indexOf(fUSD(${p1.usd})) >= 0`)],
      [50, 'A hoy', await ev(`fUSD(${p1.usd})`), 'Con lo programado', await ev(`fUSD(50)`), await ev(`fUSD(${s11})`), true]);
    check('L1 Patrimonio: the November row says "programado"; the header shows the a hoy amount', [(await celdas('usdMeses', 10))[0], await texto('#v-usd [data-sec=usdMeses] .sub')],
      ['Noviembre programado', await ev(`fUSD(${p1.usd})`) + 'a hoy']);

    // 3 · Trabajo: "Lo que pasaste a lo personal" = Ya pasaste + Programado, matching "Disponible del trabajo"; one due-date concept
    await irTab('trabajo');
    check('L1 Trabajo: "Lo que pasaste a lo personal": ya pasaste 300.000 + programado 200.000 (the future pase, Q4)',
      [await texto('#v-trabajo [data-sec=tjPases] .nom'), await ev(`Array.prototype.map.call(document.querySelectorAll('#v-trabajo [data-pp]'), function(r){ return r.textContent; })`), await texto('#v-trabajo [data-sec=tjPases] .sub')],
      ['Lo que pasaste a lo personal', ['Ya pasaste' + await ev('fARS(300000)'), 'Programado' + await ev('fARS(200000)')], await ev('fARS(300000)') + 'programado ' + await ev('fARS(200000)')]);
    check('L1 Trabajo: "Disponible del trabajo" = cobrado - lo que ya pasaste (1.000.000 - 300.000), explained with the same words',
      [await texto('#tjDisp'), (await texto('#v-trabajo .saldo .final')).indexOf('lo que ya pasaste a lo personal (' + await ev('fARS(300000)') + ')') >= 0, await texto('#tjProgPase')],
      [await ev('fARS(700000)'), true, 'Programado para pasar a lo personal: ' + await ev('fARS(200000)') + '. Se descuenta en su fecha.']);
    check('L1 Trabajo: the scheduled pase row says "Programado para el …"', await ev(`Array.prototype.some.call(document.querySelectorAll('#v-trabajo [data-act=tjVerPase] small'), function(s){ return s.textContent.indexOf('Programado para el') === 0; })`), true);
    check('L1 Trabajo: one due-date concept: the tile says "Vence en 30 días o menos" like the invoice "Vence en N días"; no "Entra en"',
      [await ev(`Array.prototype.map.call(document.querySelectorAll('#v-trabajo .saldo .tri small'), function(s){ return s.textContent; })`), (await texto('#v-trabajo [data-sec=tjPend]')).indexOf('Vence en ') >= 0, (await texto('#v-trabajo')).indexOf('Entra en') < 0],
      [['Por cobrar', 'Vencido', 'Vence en 30 días o menos'], true, true]);

    // 7 · one vocabulary: the balance block uses the hero words
    await irTab('mes');
    check('L1 vocabulary: the balance block says "Tenés hoy" / "Al cierre (estimado)" like the hero; the old terms are gone',
      await ev(`(function(){ var t = document.getElementById('v-mes').textContent; return [t.indexOf('Tenés hoy') >= 0, t.indexOf('Al cierre (estimado)') >= 0, t.indexOf('Disponible actual') < 0, t.indexOf('Proyectado al cierre') < 0]; })()`), [true, true, true, true]);

    // 6 · Gasto lives in the tab bar: never over an amount at 360 / 390 / 430; the ?gasto=1 shortcut and the action from another tab still work
    const solapa = `(function(){ var f = document.getElementById('fab'), n = document.getElementById('nav'), hd = document.querySelector('header'); if(!f) return ['no Gasto'];
      var r = f.getBoundingClientRect(), nr = n.getBoundingClientRect(), top = hd.getBoundingClientRect().bottom, out = [];
      if(!n.contains(f) || r.top < nr.top - 0.5) out.push('Gasto is not inside the tab bar');
      document.querySelectorAll('main *').forEach(function(e){ if(e.children.length || e.textContent.indexOf('$') < 0) return; var q = e.getBoundingClientRect(); if(!q.width || !q.height) return;
        if(q.bottom <= top || q.top >= nr.top) return;   // only what is visible between the header and the tab bar
        if(q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) out.push(e.textContent.trim().slice(0, 30)); });
      return out; })()`;
    for(const w of [360, 390, 430]){
      await tamano(w); await seed(y, tj);
      check(`L1 Gasto at ${w} px: inside the tab bar, over no amount at load`, await ev(solapa), []);
    }
    await tamano(390);
    await irTab('anio'); await ev(`document.getElementById('fab').click(); true`); await sleep(700);
    check('L1 Gasto from another tab: goes to the month and opens the sheet', [await ev(`document.querySelector('#nav button.on').getAttribute('data-t')`), await ev(`!!document.getElementById('grMonto')`)], ['mes', true]);
    // 5 · expense sheet polish
    check('L1 expense sheet: the amount carries "$", a placeholder, and the button says "Sumar gasto"',
      [await texto('#hoja .gr-monto span'), await ev(`document.getElementById('grMonto').placeholder`), await texto('#hoja [data-act=confirmarGasto]'),
       await ev(`(function(){ var s = document.querySelector('#hoja .gr-monto span').getBoundingClientRect(), i = document.getElementById('grMonto').getBoundingClientRect(); return s.left > i.left && s.right < i.left + 48; })()`)],
      ['$', '0', 'Sumar gasto', true]);
    await ev(`(function(){ var b = document.querySelector('#hoja [data-act=cerrarHoja]'); if(b) b.click(); return true; })()`); await sleep(400);
    await nav(URL_APP + '?gasto=1'); await sleep(1000);
    check('L1 the PWA shortcut ?gasto=1 still opens the expense sheet', await ev(`!!document.getElementById('grMonto')`), true);
    await nav(URL_APP); await sleep(800);

    // 4 · the update notice: the real version, one notice at a time, "Tenés hoy" still on the first screen at 390
    await seed(y, tj, true); await sleep(400);
    check('L1 update notice: says the real APPVER, alone, and "Tenés hoy" stays above the tab bar at 390 x 844',
      [await ev(`document.getElementById('avisoVersion').textContent.indexOf('versión ' + APPVER + '.') >= 0`), await ev(`document.getElementById('avisoVersion').textContent.indexOf('1.30') < 0`),
       await ev(`Array.prototype.filter.call(document.querySelectorAll('.aviso'), function(a){ return a.offsetHeight > 0; }).length`),
       await ev(`document.getElementById('bigFinal').getBoundingClientRect().bottom <= document.getElementById('nav').getBoundingClientRect().top`)],
      [true, true, 1, true]);
    const ySinConfirmar = JSON.parse(JSON.stringify(y)); delete ySinConfirmar.meses[8].cierreReal;
    await seed(ySinConfirmar, tj, true); await sleep(400);
    check('L1 update notice: waits while the start-of-month question is open (one notice at a time)',
      [await ev(`!!document.getElementById('avisoCierre') && document.getElementById('avisoCierre').offsetHeight > 0`), await ev(`!!document.getElementById('avisoVersion') && document.getElementById('avisoVersion').offsetHeight === 0`)], [true, true]);

    // 8 · fit on these screens: tap targets >= 44, text >= 11 px, no overflow at 360 / 390 / 430; chart axis text >= 11 px
    const chicos = (v) => `(function(){ var out = []; document.querySelectorAll('#${v} button, #${v} a, #${v} [data-act], #${v} summary').forEach(function(t){
      var r = t.getBoundingClientRect(); if(!r.width || !r.height || getComputedStyle(t).visibility === 'hidden') return;
      if(r.width < 44 || r.height < 44) out.push((t.getAttribute('data-act') || t.className || t.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }); return out; })()`;
    const letra = (v) => `(function(){ var out = []; document.querySelectorAll('#${v} *').forEach(function(e){ if(e.closest('svg')) return; if(!Array.prototype.some.call(e.childNodes, function(n){ return n.nodeType === 3 && n.nodeValue.trim(); })) return;
      if(!e.getBoundingClientRect().width) return; var f = parseFloat(getComputedStyle(e).fontSize); if(f < 11) out.push(e.tagName + ' ' + f + ' ' + e.textContent.trim().slice(0, 20)); }); return out.slice(0, 5); })()`;
    const anchos = (v) => `(function(){ var W = innerWidth, out = []; if(document.documentElement.scrollWidth > W) out.push('page ' + document.documentElement.scrollWidth);
      document.querySelectorAll('#${v} *').forEach(function(e){ if(e.closest('.tabla') || e.closest('.tj-carps')) return; var r = e.getBoundingClientRect(); if(r.width && r.right > W + 1) out.push(e.tagName + '.' + e.className + ' ' + Math.round(r.right)); });
      return out.slice(0, 5); })()`;
    const ejes = `(function(){ var out = []; document.querySelectorAll('#v-anio .chart svg').forEach(function(s){ var k = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
      s.querySelectorAll('text').forEach(function(t){ var px = parseFloat(t.getAttribute('font-size')) * k; if(px < 11) out.push(t.textContent + ' ' + px.toFixed(1)); }); }); return out.slice(0, 5); })()`;
    await seed(y, tj);
    for(const w of [360, 390, 430]){
      await tamano(w);
      for(const [t, v] of [['anio', 'v-anio'], ['usd', 'v-usd'], ['trabajo', 'v-trabajo']]){
        await irTab(t);
        if(t === 'anio') await ev(`(function(){ ['anGraf', 'anAhorro'].forEach(function(k){ var s = document.querySelector('#v-anio [data-sec=' + k + ']'); if(s && s.classList.contains('cerrada')) s.querySelector('.sechd').click(); }); return true; })()`);
        await sleep(300);
        if(w === 390) check(`L1 tap targets on "${t}" at 390: all at least 44 x 44`, await ev(chicos(v)), []);
        if(w === 390) check(`L1 text on "${t}" at 390: nothing under 11 px`, await ev(letra(v)), []);
        check(`L1 no horizontal overflow on "${t}" at ${w} px`, await ev(anchos(v)), []);
        if(t === 'anio' && w === 360) check('L1 chart axis labels at 360 px render at 11 px or more', await ev(ejes), []);
      }
    }

    // 5 · desktop: the month bar shows all twelve months (ENE / FEB not clipped) and the tab bar spans the content width
    await tamano(1280); await seed(y, tj);
    check('L1 1280: the month bar shows all twelve months inside the content, nothing scrolled away',
      await ev(`(function(){ var m = document.getElementById('selMes'), r = m.getBoundingClientRect(), b = m.querySelectorAll('button');
        return [b.length, m.scrollWidth <= m.clientWidth + 1, Array.prototype.every.call(b, function(x){ var q = x.getBoundingClientRect(); return q.left >= r.left - 1 && q.right <= r.right + 1 && q.width >= 44; })]; })()`), [12, true, true]);
    check('L1 1280: the tab bar is as wide as the content (first and last tab aligned with the month bar)',
      await ev(`(function(){ var m = document.getElementById('selMes').getBoundingClientRect(), b = document.querySelectorAll('#nav button'), v = Array.prototype.filter.call(b, function(x){ return x.offsetWidth; });
        v.sort(function(p, q){ return p.getBoundingClientRect().left - q.getBoundingClientRect().left; });   // L7: Gasto sits after the tablist in the DOM, third on screen
        var a = v[0].getBoundingClientRect(), z = v[v.length - 1].getBoundingClientRect(); return [Math.abs(a.left - m.left) <= 1, Math.abs(z.right - m.right) <= 1]; })()`), [true, true]);
    await irTab('anio');
    check('L1 1280: chart axis labels stay legible (11 px or more)', await ev(ejes), []);
    await send('Emulation.clearDeviceMetricsOverride');
  }

  // ── L2 microcopy: every word the rendered app shows, per tab and in the main sheets: no internal jargon (the list in
  // tests/ui-textos.js), no English/programming words, and every icon-only button has an aria-label. Same seed as L1 (model
  // year from September, Trabajo professional with a realized and a scheduled pase, a debt with a plan). hoy = 2026-10-04.
  {
    const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    ms[8] = Object.assign(mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true), it('Luz', 20000, false)], [it('Super', 200000, true)], []),
      {ahorroMesARS: 150000, compraARS: 145000, compraUSD: 100, cierreReal: {valor: 275000, calculadoAlConfirmar: 280000, confirmadoEl: '2026-10-01'}});
    ms[9] = mes([it('Sueldo', 1000000, true), it('Del trabajo', 400000, false), it('Aguinaldo', 120000, false)], [it('Alquiler', 400000, true), it('Internet', 22000, false)], [], [it('Préstamo', 100000, false)]);
    ms[10] = Object.assign(mes([it('Sueldo', 1000000, true), it('Del trabajo', 200000, false)], [it('Alquiler', 400000, false)], [], [it('Préstamo', 100000, false)]), {ahorroMesARS: 100000, ahorroMesUSD: 50});
    const y = {anio: 2026, pagoExplicito: true, cotizacionUSD: 1500, cotizacionFecha: '2026-10-01T12:00:00.000Z', ahorroAnioAnterior: 600000, usdAnioAnterior: 1200,
      cripto: [{activo: 'BTC', cantidad: 0.01, precioUSD: 60000}], meses: ms, planDeudas: {'Préstamo': {total: 1200000, recargo: 0, cuotas: 12, pagadasAntes: 9}},
      arrastre: {desde: 8, inicial: {apertura: 50000, declarado: 50000, declaradoEl: '2026-09-01', origen: 'declarado'}}};
    const tj = {version: 1, activo: true, modo: 'pro', gastos: [], productos: [], tope: 0,
      facturas: [{id: 'f1', tipo: 'factura', cliente: 'Panadería', numero: 'A-1', concepto: 'Mantenimiento', monto: 320000, cantidad: 1, precio: 320000, base: 320000, ajuste: 0, fecha: '2026-09-24', contado: false, plazo: 30, forma: 'transferencia', creada: '2026-09-24T10:00:00.000Z'}],
      cobros: [{id: 'c1', cliente: '', monto: 1000000, fecha: '2026-01-01', forma: 'transferencia', aplic: []}],
      pases: [{id: 'p1', fecha: '2026-10-02', monto: 300000, anio: 2026, mes: 9}, {id: 'p2', fecha: '2026-11-05', monto: 200000, anio: 2026, mes: 10}]};
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.ultimaCopia', new Date().toISOString()); localStorage.setItem('kibo.esquema', '1.30'); localStorage.setItem('kibo.anio','2026');
      localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(y))}); localStorage.setItem('kibo.trabajo', ${JSON.stringify(JSON.stringify(tj))}); true`);
    await nav(URL_APP); await sleep(1300);
    const fuentes = (l) => '[' + l.map((r) => r.toString()).join(',') + ']';
    // words: every text node of the page (shown or folded) plus title / aria-label / placeholder / alt; icon-only: visible buttons
    // with no letter or digit in their text and no aria-label
    const palabras = `(function(){ var J = ${fuentes(UI.JERGA)}, I = ${fuentes(UI.INGLES)}, out = {jerga: [], ingles: [], iconos: []};
      function mira(s, donde){ var k; for(k = 0; k < J.length; k++) if(J[k].test(s)){ out.jerga.push(donde + ': ' + s.trim().slice(0, 70)); break; }
        for(k = 0; k < I.length; k++) if(I[k].test(s)){ out.ingles.push(donde + ': ' + s.trim().slice(0, 70)); break; } }
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: function(n){ var p = n.parentNode && n.parentNode.nodeName; return p === 'SCRIPT' || p === 'STYLE' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }}), n;
      while((n = w.nextNode())) if(n.nodeValue.trim()) mira(n.nodeValue, 'text');
      document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(function(e){ ['title', 'aria-label', 'placeholder', 'alt'].forEach(function(a){ var v = e.getAttribute(a); if(v) mira(v, a); }); });
      mira(document.title, 'document.title');
      document.querySelectorAll('button, [role=button]').forEach(function(b){ var r = b.getBoundingClientRect(); if(!r.width || !r.height) return;
        if(!/[A-Za-z0-9ÁÉÍÓÚáéíóúñÑ]/.test(b.textContent) && !b.getAttribute('aria-label') && !b.getAttribute('aria-labelledby')) out.iconos.push((b.getAttribute('data-act') || b.className || 'button') + ' "' + b.textContent.trim() + '"'); });
      return out; })()`;
    const revisar = async (donde) => { const r = await ev(palabras);
      check(`L2 "${donde}": no internal jargon on screen`, r.jerga, []);
      check(`L2 "${donde}": no English or programming words on screen`, r.ingles, []);
      check(`L2 "${donde}": every icon-only button has an aria-label`, r.iconos, []); };
    const tocar = (sel) => ev(`(function(){ var b = document.querySelector(${JSON.stringify(sel)}); if(!b) return false; b.click(); return true; })()`);
    const dar = (act, attrs) => ev(`(function(){ var b = document.createElement('button'); b.setAttribute('data-act', ${JSON.stringify(act)}); ${Object.entries(attrs || {}).map(([k, v]) => `b.setAttribute(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join(' ')} document.body.appendChild(b); b.click(); document.body.removeChild(b); return true; })()`);
    const cerrar = async () => {   // the sheet's own Cancel / Entendido / Empezar, else a tap on the backdrop (a debt with a plan offers only Quitar / Guardar)
      await ev(`(function(){ var h = document.querySelector('#hoja [data-act=cerrarHoja]') || document.querySelector('#hoja [data-act=cerrar]') || document.querySelector('#hoja [data-act=bienvOk]') || document.getElementById('velo'); h.click(); return true; })()`); await waitFor(`document.getElementById('velo').classList.contains('on')`, false, 2500); };
    const irTab = async (t) => { await tocar(`[data-act=tab][data-t=${t}]`); await sleep(1200); };

    // control: the walker does catch a planted jargon word, an English word and an unlabeled icon button
    check('L2 control: the rendered-word walk catches planted jargon, English and an unlabeled icon button', await ev(`(function(){ var d = document.createElement('div'); d.id = 'l2control';
      d.innerHTML = '<p>Borrá esos pases</p><p>Save</p><button>×</button>'; document.body.appendChild(d); var r = ${palabras}; d.remove(); return [r.jerga.length, r.ingles.length, r.iconos.length]; })()`), [1, 1, 1]);
    for(const t of ['mes', 'anio', 'usd', 'trabajo', 'ajustes']){ await irTab(t); await revisar(`tab ${t}`); }
    for(const v of ['datos', 'ayuda', 'privacidad']){ await irTab('ajustes'); await tocar(`[data-act=ajVista][data-v=${v}]`); await sleep(800); await revisar(`Ajustes · ${v}`); }
    await irTab('ajustes');
    check('L2 Ajustes: restore points and data rows use plain words (no internal versions)', await ev(`(function(){ var t = document.getElementById('v-ajustes').textContent; return [/1\\.30|saldos\\b/.test(t), t.indexOf('el sistema') >= 0]; })()`), [false, false]);
    await irTab('mes');
    const hojas = [
      ['the quick expense sheet', () => tocar('[data-act=gastoRapido]')],
      ['the debt plan sheet', () => tocar('#v-mes [data-act=plan]')],
      ['the closing sheet of September', () => dar('cierreAbrir', {'data-m': '8'})],
      ['the welcome sheet', () => dar('verBienvenida')],
      ['the restore confirmation of a backup', () => ev(`(function(){ restaurarTexto(JSON.stringify(armarCopia())); return true; })()`)],
    ];
    for(const [nombre, abrir] of hojas){ await abrir(); await sleep(700); check(`L2 ${nombre} opened`, await ev(`document.getElementById('velo').classList.contains('on')`), true); await revisar(nombre); await cerrar(); check(`L2 ${nombre} closed`, await ev(`document.getElementById('velo').classList.contains('on')`), false); }
    await irTab('trabajo');
    const hojasTj = [
      ['the pass-to-personal sheet', () => tocar('[data-act=tjPasar]')],
      ['what you passed to personal (detail)', () => dar('tjVerPase', {'data-id': 'p1'})],
      ['the delete confirmation of what you passed', () => dar('tjBorrarPase', {'data-id': 'p1'})],
      ['the new invoice sheet', () => tocar('[data-act=tjNuevaFac]')],
      ['the payment-received sheet', () => tocar('[data-act=tjNuevoCobro]')],
      ['the work expense sheet', () => tocar('[data-act=tjNuevoGasto]')],
    ];
    for(const [nombre, abrir] of hojasTj){ await abrir(); await sleep(700); check(`L2 ${nombre} opened`, await ev(`document.getElementById('velo').classList.contains('on')`), true); await revisar(nombre); await cerrar(); check(`L2 ${nombre} closed`, await ev(`document.getElementById('velo').classList.contains('on')`), false); await irTab('trabajo'); }
    await dar('tjBorrarPase', {'data-id': 'p1'}); await sleep(600);
    check('L2 deleting what you passed asks with its consequence, never "pase"', await ev(`[document.querySelector('#hoja h3').textContent, document.querySelector('#hoja .texto').textContent]`),
      ['¿Borrar lo que pasaste?', 'Se descuentan ' + await ev('fARS(300000)') + ' del renglón “Del trabajo” de Octubre 2026 y vuelven al disponible del trabajo.']);
    await cerrar();
    await irTab('anio');
    check('L2 El año: "estimado" once, in the heading, not on each row under it',
      await ev(`(function(){ var t = document.querySelector('#heroAnio .an-tit'), f = document.querySelectorAll('#heroAnio [data-an=dispCierre] span, #heroAnio [data-an=ahorroCierre] span');
        return [t && t.textContent, Array.prototype.map.call(f, function(e){ return e.textContent; })]; })()`),
      ['Al cierre del año (estimado)', ['Disponible en diciembre', 'Ahorro en diciembre (con lo programado)']]);
    await send('Emulation.clearDeviceMetricsOverride');
  }

  // L3 (R7, rule D8): a quick expense on a pending row with an amount asks; "Sí" ticks it (keep or update the amount), "No" records a
  // separate realized expense; Cancelar changes nothing; undo restores exactly; a future month of the model keeps N4 I-1. hoy = 2026-10-04.
  {
    const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    ms[9] = mes([it('Sueldo', 500000, true)], [], [it('Super', 50000, false)], []);
    ms[10] = mes([it('Sueldo', 500000, false)], [], [it('Super', 50000, false)], []);
    const y = {anio: 2026, pagoExplicito: true, meses: ms, arrastre: {desde: 9, inicial: {apertura: 100000, declarado: 100000, declaradoEl: '2026-10-01', origen: 'declarado'}}};
    await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.ultimaCopia', new Date().toISOString()); localStorage.setItem('kibo.esquema', '1.30'); localStorage.setItem('kibo.anio','2026');
      localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(y))}); true`);
    await nav(URL_APP); await sleep(800);
    const mesL3 = (j) => ev(`JSON.stringify([D.meses[${j}].gastosVariables.map(function(r){ return [r.nombre, r.monto, r.pagado]; }), D.meses[${j}].movimientos.length])`);
    const gastoL3 = async (monto) => {
      await ev(`document.querySelector('[data-act=gastoRapido]').click(); true`); await sleep(400);
      await ev(`(function(){ var x = document.getElementById('grMonto'); x.value = ${JSON.stringify(monto)}; x.dispatchEvent(new Event('input', {bubbles: true})); return true; })()`);
      await ev(`(function(){ var c = Array.prototype.filter.call(document.querySelectorAll('#grChips button'), function(b){ return b.textContent === 'Super'; })[0]; c.click(); return true; })()`); await sleep(400);
    };
    const hojaL3 = () => ev(`document.getElementById('velo').classList.contains('on') ? [document.querySelector('#hoja h3').textContent, document.querySelector('#hoja .texto').textContent,
      Array.prototype.map.call(document.querySelectorAll('#hoja button'), function(b){ return b.textContent; })] : null`);
    const tocarL3 = async (sel) => { await ev(`document.querySelector(${JSON.stringify(sel)}).click(); true`); await sleep(400); };
    const antesL3 = await mesL3(9);
    check('L3 seed: Super 50.000 pending in October', antesL3, JSON.stringify([[['Super', 50000, false]], 0]));
    await gastoL3('20.000');
    check('L3 the quick expense on a pending row asks', await hojaL3(), ['Gasto de ' + await ev('fARS(20000)'), 'Super está pendiente por ' + await ev('fARS(50000)') + '. ¿Este gasto es ese pago?',
      ['No, es otro gasto', 'Sí, marcarlo como pagado', 'Cancelar']]);
    check('L3 nothing changes while asking', await mesL3(9), antesL3);
    await tocarL3('#hoja [data-act=cerrarHoja]');
    check('L3 Cancelar: sheet closed, month unchanged', [await hojaL3(), await mesL3(9)], [null, antesL3]);
    // "Sí" with a different amount: second question; keep the row amount; undo from the toast
    await gastoL3('20.000'); await tocarL3('#hoja [data-act=gastoEsPago]');
    check('L3 "Sí" with a different amount asks which amount (no silent change)', await hojaL3(), ['¿Con qué monto lo marco?',
      'Super decía ' + await ev('fARS(50000)') + ' y anotaste ' + await ev('fARS(20000)') + '.', ['Dejar ' + await ev('fARS(50000)'), 'Cambiar a ' + await ev('fARS(20000)'), 'Cancelar']]);
    await tocarL3('#hoja [data-act=pagoMonto][data-v=fila]');
    check('L3 "Dejar": the row is ticked with its amount, no duplicate row', await mesL3(9), JSON.stringify([[['Super', 50000, true]], 1]));
    check('L3 toast with Deshacer', await ev(`[document.querySelector('#toast span').textContent, !!document.querySelector('#toast [data-act=quitarMov]')]`), ['Marqué Super como pagado', true]);
    await tocarL3('#toast [data-act=quitarMov]');
    check('L3 Deshacer restores exactly the previous month', await mesL3(9), antesL3);
    // "Sí", update the amount; undo from the Gastos rápidos list after a restart (the movement keeps what undo needs)
    await gastoL3('20.000'); await tocarL3('#hoja [data-act=gastoEsPago]'); await tocarL3('#hoja [data-act=pagoMonto][data-v=gasto]');
    check('L3 "Cambiar a": the row is ticked with the typed amount', await mesL3(9), JSON.stringify([[['Super', 20000, true]], 1]));
    await ev(`guardar(); true`); await nav(URL_APP); await sleep(800);
    check('L3 after a restart the movement still knows the previous amount', await ev(`[D.meses[9].movimientos[0].tipo, D.meses[9].movimientos[0].ma]`), ['pago', 50000]);
    await ev(`document.querySelector('.item.mov [data-act=quitarMov]').click(); true`); await sleep(400);
    check('L3 undo from the list after a restart restores exactly', await mesL3(9), antesL3);
    // "Sí" with the same amount: ticked directly
    await gastoL3('50.000'); await tocarL3('#hoja [data-act=gastoEsPago]');
    check('L3 "Sí" with the same amount ticks directly (no second question, no new row)', [await hojaL3(), await mesL3(9)], [null, JSON.stringify([[['Super', 50000, true]], 1])]);
    await tocarL3('#toast [data-act=quitarMov]');
    check('L3 undo of the same-amount "Sí"', await mesL3(9), antesL3);
    // "No, es otro gasto": a separate ticked row, the plan stays pending
    await gastoL3('20.000'); await tocarL3('#hoja [data-act=gastoAparte]');
    check('L3 "No": separate ticked row, the plan stays pending', await mesL3(9), JSON.stringify([[['Super', 50000, false], ['Super (otro gasto)', 20000, true]], 1]));
    check('L3 "No" toast says the plan is still pending', await ev(`document.querySelector('#toast span').textContent`), 'Anoté ' + await ev('fARS(20000)') + ' en Super (otro gasto). Super sigue pendiente');
    await tocarL3('#toast [data-act=quitarMov]');
    check('L3 undo of "No" removes the separate row', await mesL3(9), antesL3);
    // future month of the model: N4 I-1 unchanged
    await ev(`document.querySelector('[data-act=mes][data-m="10"]').click(); true`); await sleep(1000);
    await gastoL3('20.000');
    check('L3 future month: no question, amount added, row stays programado', [await hojaL3(), await mesL3(10)], [null, JSON.stringify([[['Super', 70000, false]], 1])]);
    await ev(`document.querySelector('[data-act=mes][data-m="9"]').click(); true`); await sleep(400);
  }

  // L5 "Qué vence esta semana" (hoy = 2026-10-04): the card under the hero of the current month lists overdue rows of past model months,
  // income collection days, rows without a day only near the month end, and Trabajo invoices by due date; each row jumps to its place.
  {
    const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    const cobro = (nombre, monto, dias) => ({nombre, monto, pagado: false, frec: 'mensual', dias});
    ms[8] = mes([it('Sueldo', 900000, true)], [it('Luz', 20000, false)], [], []);
    ms[9] = mes([cobro('Sueldo', 900000, [8]), cobro('Changas', 60000, [2]), cobro('Alquiler cobrado', 300000, [25])], [it('Expensas', 70000, false)], [], []);
    ms[10] = mes([cobro('Sueldo', 900000, [8])], [it('Luz', 22000, false)], [], []);
    const y = {anio: 2026, pagoExplicito: true, meses: ms, arrastre: {desde: 8, inicial: {apertura: 100000, declarado: 100000, declaradoEl: '2026-09-01', origen: 'declarado'}}};
    const trab = {version: 1, activo: true, modo: 'simple', facturas: [{id: 'f1', cliente: 'Ana', numero: '12', monto: 45000, fecha: '2026-09-21', plazo: 10},
      {id: 'f3', cliente: 'Caro', numero: '14', monto: 15000, fecha: '2026-09-25', plazo: 10},
      {id: 'f2', cliente: 'Beto', numero: '13', monto: 80000, fecha: '2026-10-01', plazo: 30}], cobros: [], pases: [], gastos: [], productos: [], tope: 0, rev: 1};
    const seedL5 = async (year, t) => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.ultimaCopia', new Date().toISOString()); localStorage.setItem('kibo.esquema', '1.30'); localStorage.setItem('kibo.anio','2026');
      localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(year))}); ${t ? `localStorage.setItem('kibo.trabajo', ${JSON.stringify(JSON.stringify(t))});` : ''} true`); await nav(URL_APP); await sleep(900); };
    const filasL5 = () => ev(`document.getElementById('vence') ? Array.prototype.map.call(document.querySelectorAll('#vence .vence-f'), function(b){
      return [b.querySelector('.chip').textContent, b.querySelector('.vn span').textContent, b.querySelector('.vn small').textContent, b.querySelector('b').textContent]; }) : null`);
    await seedL5(y, trab);
    const $ = async (n) => ev(`fARS(${n})`);
    check('L5 card under the hero of the current month, title and count', await ev(`(function(){ var v = document.getElementById('vence'), c = document.getElementById('carrMes');
      return !!v && !!c && c.nextElementSibling === v && v.querySelector('.vence-hd').textContent; })()`), 'Qué vence esta semana5 cosas');
    check('L5 rows: overdue first (past month, passed collection day, overdue invoice), then the next 7 days by date; the 25th, month-end rows and a later invoice wait',
      await filasL5(), [['Atrasado', 'Luz', 'A pagar · de septiembre', await $(20000)], ['Atrasado', 'Ana · Factura 12', 'Trabajo · a cobrar · venció el 01/10', await $(45000)],
        ['Atrasado', 'Changas', 'A cobrar · era el día 2', await $(60000)], ['Mañana', 'Caro · Factura 14', 'Trabajo · a cobrar', await $(15000)],
        ['Día 8', 'Sueldo', 'A cobrar', await $(900000)]]);
    check('L5 chips use the state colors (overdue amber, Trabajo due soon indigo, pending amber)', await ev(`Array.prototype.map.call(document.querySelectorAll('#vence .chip'), function(c){ return c.className; })`),
      ['chip atras', 'chip atras', 'chip atras', 'chip trab', 'chip pend']);
    check('L5 every row is a tap target of at least 44 px', await ev(`Array.prototype.every.call(document.querySelectorAll('#vence .vence-f'), function(b){ return b.getBoundingClientRect().height >= 44; })`), true);
    // the invoice opens its detail
    await ev(`document.querySelectorAll('#vence .vence-f')[1].click(); true`); await sleep(500);
    check('L5 tapping the invoice opens its detail', await ev(`document.getElementById('velo').classList.contains('on') && document.querySelector('#hoja h3').textContent`), 'Ana');
    await ev(`document.getElementById('velo').click(); true`); await sleep(400);
    // a row of the current month: its section opens and the row is marked
    await ev(`(function(){ var s = document.querySelector('#v-mes .sec[data-sec=ingresos]'); if(!s.classList.contains('cerrada')) s.querySelector('.sechd').click(); return true; })()`); await sleep(500);
    await ev(`document.querySelectorAll('#vence .vence-f')[4].click(); true`); await sleep(300);
    check('L5 tapping a row of this month opens its section and marks that row', await ev(`(function(){ var r = document.querySelector('#v-mes .item.resalta');
      return [mes, !document.querySelector('#v-mes .sec[data-sec=ingresos]').classList.contains('cerrada'), r && r.querySelector('input.nombre').value]; })()`), [9, true, 'Sueldo']);
    // an overdue row of September: the month changes to September and the row is marked
    await ev(`document.querySelectorAll('#vence .vence-f')[0].click(); true`); await sleep(300);
    check('L5 tapping an overdue row opens its month and marks that row', await ev(`(function(){ var r = document.querySelector('#v-mes .item.resalta');
      return [mes, r && r.querySelector('input.nombre').value, !!document.getElementById('vence')]; })()`), [8, 'Luz', false]);
    await ev(`document.querySelector('[data-act=mes][data-m="10"]').click(); true`); await sleep(400);
    check('L5 a future month has no card', await ev(`!!document.getElementById('vence')`), false);
    await ev(`document.querySelector('[data-act=mes][data-m="9"]').click(); true`); await sleep(400);
    check('L5 back on the current month the card is there', await ev(`!!document.getElementById('vence')`), true);
    // ticking a listed row takes it off the card
    await ev(`document.querySelector('#v-mes .sec[data-sec=ingresos] [data-act=pagar][data-i="0"]').click(); true`); await sleep(500);
    check('L5 a ticked row leaves the card', (await filasL5()).map(r => r[1]), ['Luz', 'Ana · Factura 12', 'Changas', 'Caro · Factura 14']);
    // nothing due: no card at all (no empty message)
    const ms2 = []; for(let i=0;i<12;i++) ms2.push(mes([], [], [], []));
    ms2[9] = mes([it('Sueldo', 900000, true)], [it('Expensas', 70000, false)], [], []);
    await seedL5({anio: 2026, pagoExplicito: true, meses: ms2, arrastre: {desde: 9, inicial: {apertura: 100000, declarado: 100000, declaradoEl: '2026-10-01', origen: 'declarado'}}}, null);
    check('L5 nothing dated in the next 7 days and nothing overdue: no card', [await ev(`!!document.getElementById('vence')`), await ev(`!!document.getElementById('carrMes')`)], [false, true]);
  }

  // L6 (R6) "El año" analysis (hoy = 2026-10-04): October against September and the average of July-September; categories of ticked
  // gastos over the realized months; "Más que lo normal"; November (future, with big ticked amounts) never counts; legacy year marked.
  {
    const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    const m6 = (ing, gas, ah) => Object.assign(mes([it('Sueldo', ing, true)], [], gas, []), {ahorroMesARS: ah});
    ms[6] = m6(1000000, [it('Super', 200000, true), it('Nafta', 50000, true)], 100000);
    ms[7] = m6(1000000, [it('Super', 220000, true), it('Nafta', 50000, true)], 100000);
    ms[8] = m6(1200000, [it('Super', 180000, true), it('Nafta', 50000, true)], 160000);
    ms[9] = m6(900000, [it('Super', 300000, true), it('Nafta', 62000, true), it('<i>Cine</i>', 10000, true)], 50000);
    ms[10] = m6(5000000, [it('Super', 9000000, true), it('Viaje', 7000000, true)], 0);
    const y = {anio: 2026, pagoExplicito: true, meses: ms, arrastre: {desde: 6, inicial: {apertura: 100000, declarado: 100000, declaradoEl: '2026-07-01', origen: 'declarado'}}};
    await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.ultimaCopia', new Date().toISOString()); localStorage.setItem('kibo.esquema', '1.30'); localStorage.setItem('kibo.anio','2026');
      localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(y))}); true`);
    await nav(URL_APP); await sleep(800);
    await ev(`document.querySelector('[data-act=tab][data-t=anio]').click(); true`); await sleep(1200);
    const $ = async (n) => ev(`fARS(${n})`);
    check('L6 "Este mes contra los anteriores" right after the summary card, before "Los doce meses"', await ev(`(function(){
      var c = document.querySelector('#v-anio .sec[data-sec=anComp]'), t = document.querySelector('#v-anio .sec[data-sec=anTend]');
      return [c && c.querySelector('.sechd .nom').textContent, c && c.querySelector('.sechd .sub').textContent, t && t.querySelector('.sechd .nom').textContent,
        !!c && c.previousElementSibling.classList.contains('resumen'), !!t && t.nextElementSibling.getAttribute('data-sec')]; })()`),
      ['Este mes contra los anteriores', 'Pagado ↑ 49%', 'Cómo vienen tus gastos', true, 'anTabla']);
    check('L6 comparison rows: October, vs September, vs the average (the "Los doce meses" numbers)', await ev(`Array.prototype.map.call(document.querySelectorAll('#v-anio .an-c-f'), function(f){
      return Array.prototype.map.call(f.children, function(x){ return x.textContent; }); })`),
      [['', 'Octubre', 'Septiembre', 'Promedio'], ['Cobrado', await $(900000), '↓ 25%', '↓ 16%'], ['Pagado', await $(372000), '↑ 62%', '↑ 49%'], ['Ahorro', await $(50000), '↓ 69%', '↓ 58%']]);
    check('L6 plain sentences', await ev(`Array.prototype.map.call(document.querySelectorAll('#v-anio .an-frases p'), function(p){ return p.textContent; })`),
      ['Este mes gastaste 49% más que tu promedio.', 'Este mes cobraste 16% menos que tu promedio.', 'Este mes ahorraste 58% menos que tu promedio.', 'Este mes gastaste 62% más que en septiembre.']);
    check('L6 the month in progress and the base of the average are said', await ev(`document.querySelector('#v-anio .an-pie').textContent`),
      'Octubre todavía no terminó: cuenta lo que ya cobraste y pagaste. El promedio es el de 3 meses anteriores.');
    check('L6 categories: top of the realized months, escaped names, November\'s Viaje absent, one mini chart each', await ev(`Array.prototype.map.call(document.querySelectorAll('#v-anio .an-cat'), function(c){
      return [c.querySelector('small span').firstChild.textContent.trim(), c.querySelector('small > span:last-child').textContent, c.querySelectorAll('svg.barritas rect').length]; })`),
      [['Super', await $(300000) + ' en octubre', 10], ['Nafta', await $(62000) + ' en octubre', 10], ['<i>Cine</i>', await $(10000) + ' en octubre', 10]]);
    check('L6 "Más que lo normal": Super (+50%), not Nafta (+24%); chip and sentence', await ev(`[document.querySelector('#v-anio .an-normal').textContent,
      Array.prototype.map.call(document.querySelectorAll('#v-anio .an-cat .chip'), function(c){ return c.closest('.an-cat').querySelector('small span').firstChild.textContent.trim(); }),
      document.querySelector('#v-anio .sec[data-sec=anTend] .sechd .sub').textContent]`),
      ['Más que lo normal en octubre: Super (' + await $(300000) + ', 50% más que su promedio).', ['Super'], '1 más que lo normal']);
    check('L6 nothing of the future month in the analysis', await ev(`(function(){ var t = document.querySelector('#v-anio .sec[data-sec=anComp]').textContent + document.querySelector('#v-anio .sec[data-sec=anTend]').textContent;
      return [t.indexOf('Viaje') < 0, t.indexOf(fARS(9000000)) < 0, t.indexOf('Noviembre') < 0]; })()`), [true, true, true]);
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 2, mobile: true }); await sleep(500);
    check('L6 no horizontal overflow at 360 px', await ev(`(function(){ var s = document.querySelectorAll('#v-anio .an-comp, #v-anio .an-tend'), ok = true;
      for(var i=0;i<s.length;i++){ if(s[i].scrollWidth > s[i].clientWidth + 1) ok = false; } return [s.length, ok, document.documentElement.scrollWidth <= 360]; })()`), [2, true, true]);
    await send('Emulation.clearDeviceMetricsOverride');
    // a legacy year (no month-to-month balance): its own numbers, marked "Cálculo simple"
    const ml = []; for(let i=0;i<12;i++) ml.push(mes([], [], [], []));
    ml[10] = m6(1000000, [it('Super', 260000, true)], 0); ml[11] = m6(1000000, [it('Super', 150000, true)], 0);
    await ev(`localStorage.setItem('kibo.anio','2025'); localStorage.setItem('kibo.datos.2025', ${JSON.stringify(JSON.stringify({anio: 2025, pagoExplicito: true, meses: ml}))}); true`);
    await nav(URL_APP); await sleep(800);
    await ev(`document.querySelector('[data-act=tab][data-t=anio]').click(); true`); await sleep(1200);
    check('L6 legacy year: December against November, its own numbers, marked "Cálculo simple"', await ev(`(function(){ var c = document.querySelector('#v-anio .sec[data-sec=anComp]');
      return c && [c.querySelector('.sechd .nom').textContent, c.querySelector('[data-comp=pagado] b').textContent, c.querySelector('.an-frases p').textContent, !!c.querySelector('.an-pie .chip.prog')]; })()`),
      ['Diciembre contra los anteriores', await $(150000), 'En diciembre gastaste 42% menos que tu promedio.', true]);
    await ev(`localStorage.setItem('kibo.anio','2026'); true`);
  }

  // L7 desktop + accessibility (hoy = 2026-10-04). The phone layout (390 px) must not move: the key boxes of the four main views are
  // compared with tests/fixtures/l7-movil-390.json, recorded from the build before L7 (L7_GRABAR=1 rewrites it, only on purpose).
  {
    const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    ms[6] = mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true)], [it('Super', 200000, true)], []);
    ms[7] = mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true)], [it('Super', 220000, true)], []);
    ms[8] = mes([it('Sueldo', 1000000, true)], [it('Alquiler', 400000, true), it('Luz', 20000, false)], [it('Super', 180000, true)], [it('Préstamo', 100000, true)]);
    ms[9] = mes([it('Sueldo', 1050000, true), it('Changas', 60000, false)], [it('Alquiler', 400000, true), it('Luz', 25000, false), it('Internet', 22000, false)],
      [it('Super', 120000, true), it('Nafta', 45000, false)], [it('Préstamo', 100000, false)]);
    ms[10] = mes([it('Sueldo', 1050000, false)], [it('Alquiler', 400000, false)], [], [it('Préstamo', 100000, false)]);
    const y7 = {anio: 2026, pagoExplicito: true, cotizacionUSD: 1450, meses: ms, planDeudas: {'Préstamo': {total: 1200000, recargo: 0, cuotas: 12, pagadasAntes: 0}},
      arrastre: {desde: 6, inicial: {apertura: 100000, declarado: 100000, declaradoEl: '2026-07-01', origen: 'declarado'}}};
    const tj7 = {version: 1, activo: true, modo: 'pro', tope: 0,
      facturas: [{id: 'f1', tipo: 'factura', cliente: 'Estudio Pérez', numero: 'A-0001-00000123', concepto: 'Diseño', monto: 320000, cantidad: 1, precio: 320000, base: 320000, ajuste: 0, fecha: '2026-09-25', contado: false, plazo: 30, forma: 'transferencia', creada: '2026-09-25T10:00:00.000Z'}],
      cobros: [], pases: [], gastos: [], productos: []};
    const seed7 = async () => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.ultimaCopia', new Date().toISOString()); localStorage.setItem('kibo.esquema', '1.30'); localStorage.setItem('kibo.anio','2026');
      localStorage.setItem('kibo.datos.2026', ${JSON.stringify(JSON.stringify(y7))}); localStorage.setItem('kibo.trabajo', ${JSON.stringify(JSON.stringify(tj7))}); true`); await nav(URL_APP); await sleep(1300); };
    const tam7 = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h || (w < 800 ? 844 : 900), deviceScaleFactor: w < 800 ? 2 : 1, mobile: w < 800 }); await sleep(400); };
    const tab7 = async (t) => { await ev(`document.querySelector('[data-act=tab][data-t=${t}]').click(); window.scrollTo(0, 0); true`); await sleep(1400); };
    // the boxes that make the phone layout: header, month bar, hero, "Qué vence", balance block, every section, the tab bar and each tab
    const cajas = (t) => ev(`(function(){ var o = {}, n = 0;
      function r(k, e){ if(!e) return; var b = e.getBoundingClientRect(); o[k] = [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; }
      r('header', document.querySelector('header')); r('nav', document.getElementById('nav'));
      document.querySelectorAll('#nav button').forEach(function(b){ r('nav:' + (b.getAttribute('data-t') || b.id), b); });
      if('${t}' === 'mes'){ ['selMes', 'carrMes', 'vence', 'saldoMes'].forEach(function(id){ r(id, document.getElementById(id)); });
        document.querySelectorAll('#v-mes .sec').forEach(function(s){ r('sec:' + (s.getAttribute('data-sec') || 'x' + (n++)), s); }); }
      else Array.prototype.forEach.call(document.getElementById('v-${t}').children, function(c, i){ r(i + ':' + c.className + ':' + (c.getAttribute('data-sec') || ''), c); });
      return o; })()`);
    await tam7(390); await seed7();
    const movil = {};
    for(const t of ['mes', 'anio', 'usd', 'trabajo']){ await tab7(t); movil[t] = await cajas(t); }
    const FIX = path.join(ROOT, 'tests', 'fixtures', 'l7-movil-390.json');
    if(process.env.L7_GRABAR === '1') fs.writeFileSync(FIX, '{\n' + Object.keys(movil).map(t => ' ' + JSON.stringify(t) + ': {\n'
      + Object.keys(movil[t]).map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(movil[t][k])).join(',\n') + '\n }').join(',\n') + '\n}\n');
    const antes = JSON.parse(fs.readFileSync(FIX, 'utf8'));
    for(const t of Object.keys(antes)){
      const dif = Object.keys(antes[t]).filter(k => !movil[t][k] || antes[t][k].some((v, i) => Math.abs(v - movil[t][k][i]) > 1));
      check(`L7 390 px ${t}: every key box where it was before L7 (${Object.keys(antes[t]).length} boxes)`, dif.map(k => [k, antes[t][k], movil[t][k] || null]), []);
    }
    await tab7('mes');

    // desktop: the month in two columns (summary left, rows right), centered at most 1200 px, nothing overlapping or wider than the window
    const sinDesborde = `(function(){ var W = innerWidth, malos = [];
      if(document.documentElement.scrollWidth > W) malos.push('page ' + document.documentElement.scrollWidth);
      document.querySelectorAll('main *').forEach(function(e){ var r = e.getBoundingClientRect(); if(r.width && r.right > W + 1 && !e.closest('.meses, .carr-pista, .tabla')) malos.push(e.tagName + '.' + e.className); });
      return malos.slice(0, 5); })()`;
    for(const w of [1280, 1440]){
      await tam7(w); await tab7('mes');
      check(`L7 ${w} mes: two columns side by side, summary left and rows right, inside a centered 1200 px column`, await ev(`(function(){
        var i = document.querySelector('#v-mes .mes-izq').getBoundingClientRect(), d = document.querySelector('#v-mes .mes-der').getBoundingClientRect(), m = document.querySelector('main').getBoundingClientRect();
        var h = document.getElementById('carrMes').getBoundingClientRect(), s = document.querySelector('#v-mes .mes-der .sec').getBoundingClientRect();
        return [i.width > 300 && d.width > i.width, i.right <= d.left, Math.abs(i.top - d.top) <= 2, h.right <= i.right + 1 && s.left >= d.left - 1,
          m.width <= 1200, Math.abs(m.left - (document.documentElement.clientWidth - m.right)) <= 1]; })()`), [true, true, true, true, true, true]);
      check(`L7 ${w} mes: nothing wider than the window`, await ev(sinDesborde), []);
      const fija = `(function(){ var c = document.querySelector('#v-mes .mes-izq'), libre = innerHeight - document.querySelector('header').offsetHeight - document.getElementById('nav').offsetHeight - 24;
        return [c.offsetHeight <= libre, getComputedStyle(c).position]; })()`;
      check(`L7 ${w} mes: the summary column scrolls with the page when it does not fit the window`, await ev(fija), [false, 'static']);
      await tam7(w, 1600);
      check(`L7 ${w} mes: the summary column stays put while the rows scroll when it fits`, await ev(fija), [true, 'sticky']);
      await tam7(w);
      for(const t of ['anio', 'usd', 'trabajo']){
        await tab7(t);
        check(`L7 ${w} ${t}: sections in two columns, none overlapping, nothing wider than the window`, await ev(`(function(){
          var c = Array.prototype.filter.call(document.getElementById('v-${t}').children, function(e){ return e.offsetHeight; }).map(function(e){ return e.getBoundingClientRect(); }), lados = {}, choque = 0;
          c.forEach(function(r, a){ lados[r.left < innerWidth / 2 - 1 && r.right < innerWidth / 2 ? 'izq' : r.left > innerWidth / 2 - 30 ? 'der' : 'ancho'] = 1;
            c.forEach(function(q, b){ if(b > a && r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1) choque++; }); });
          return [!!lados.izq && !!lados.der, choque]; })()`), [true, 0]);
        check(`L7 ${w} ${t}: nothing wider than the window`, await ev(sinDesborde), []);
      }
      await tab7('mes');
    }

    // keyboard and screen reader: tabs (role, aria-selected, arrows), the sheet (dialog, Esc, focus kept inside and given back), live regions
    await tam7(1280); await tab7('mes');
    const tecla = async (key, code, shift) => { for(const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', Object.assign({ type, key, code, windowsVirtualKeyCode: {Tab: 9, Enter: 13, Escape: 27, ArrowRight: 39}[key], modifiers: shift ? 8 : 0 }, type === 'keyDown' && key === 'Enter' ? { text: '\r' } : {})); await sleep(120); };
    check('L7 tabs: a tablist with five tabs, the open one marked aria-selected', await ev(`(function(){ var l = document.querySelector('#nav [role=tablist]').getAttribute('aria-owns').split(' ').map(function(i){ return document.getElementById(i); });
      return [l.length, Array.prototype.map.call(l, function(b){ return b.getAttribute('aria-selected'); }).join(','), document.documentElement.lang]; })()`), [5, 'true,false,false,false,false', 'es-AR']);
    await ev(`document.getElementById('tab-mes').focus(); true`);
    await tecla('ArrowRight', 'ArrowRight');
    check('L7 tabs: the right arrow moves to the next tab', await ev(`document.activeElement.id`), 'tab-anio');
    await tecla('Enter', 'Enter'); await sleep(1200);
    check('L7 tabs: Enter opens it and it becomes the selected tab', await ev(`[document.getElementById('v-anio').classList.contains('on'), document.getElementById('tab-anio').getAttribute('aria-selected'), document.getElementById('tab-mes').getAttribute('aria-selected')]`), [true, 'true', 'false']);
    await tab7('mes');
    await ev(`document.getElementById('fab').focus(); true`);
    await tecla('Enter', 'Enter'); await sleep(500);
    check('L7 sheet: Enter on Gasto opens a modal dialog named by its title, with the focus inside', await ev(`(function(){ var h = document.getElementById('hoja'), t = document.getElementById(h.getAttribute('aria-labelledby'));
      return [document.getElementById('velo').classList.contains('on'), h.getAttribute('role'), h.getAttribute('aria-modal'), !!(t && t.textContent.trim()), h.contains(document.activeElement)]; })()`), [true, 'dialog', 'true', true, true]);
    let dentro = true;
    for(let k = 0; k < 25; k++){ await tecla('Tab', 'Tab', k % 3 === 2); if(!(await ev(`document.getElementById('hoja').contains(document.activeElement)`))) dentro = false; }
    check('L7 sheet: Tab and Shift+Tab never leave the open sheet', dentro, true);
    await tecla('Escape', 'Escape'); await sleep(300);
    check('L7 sheet: Esc closes it and the focus goes back to the button that opened it', await ev(`[document.getElementById('velo').classList.contains('on'), document.activeElement && document.activeElement.id]`), [false, 'fab']);
    check('L7 live regions: the toast and the status pill are announced politely', await ev(`['toast', 'pild'].map(function(i){ var e = document.getElementById(i); return e.getAttribute('role') + ' ' + e.getAttribute('aria-live'); })`), ['status polite', 'status polite']);
    check('L7 keyboard: a focused button shows a visible focus ring', await ev(`(function(){ var b = document.getElementById('fab'); b.focus(); var s = getComputedStyle(b); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; })()`), true);
    // L7 review: Guardar re-draws the month and replaces the button that opened the sheet; the focus goes to the new one, never to the page
    await ev(`document.querySelector('#v-mes [data-act=cobro][data-i="1"]').focus(); true`);
    await tecla('Enter', 'Enter'); await sleep(500);
    await ev(`document.querySelector('#hoja [data-act=guardarCobroIng]').focus(); true`);
    await tecla('Enter', 'Enter'); await sleep(600);
    check('L7 sheet: after Guardar re-draws the month, the focus is on the (new) button that opened the sheet', await ev(`(function(){ var a = document.activeElement;
      return [document.getElementById('velo').classList.contains('on'), a.tagName, a.getAttribute('data-act'), a.getAttribute('data-i'), a.isConnected]; })()`), [false, 'BUTTON', 'cobro', '1', true]);
    // L7 review: the tab bar is gone through with Tab in the order it is seen (Gasto third), and it is still one tablist of five tabs
    const visual = await ev(`Array.prototype.filter.call(document.querySelectorAll('#nav button'), function(b){ return b.offsetParent !== null; })
      .sort(function(p, q){ return p.getBoundingClientRect().left - q.getBoundingClientRect().left; }).map(function(b){ return b.id; })`);
    await ev(`document.getElementById('tab-mes').focus(); true`);
    const porTab = [await ev(`document.activeElement.id`)];
    for(let k = 1; k < visual.length; k++){ await tecla('Tab', 'Tab'); porTab.push(await ev(`document.activeElement.id`)); }
    check('L7 keyboard: Tab goes through the tab bar in the order it is seen', [porTab, visual.length], [visual, 6]);
    await send('Accessibility.enable');
    const ax = (await send('Accessibility.getFullAXTree')).result.nodes;
    const listas = ax.filter(n => !n.ignored && n.role && n.role.value === 'tablist');
    const hijos = listas.length ? (listas[0].childIds || []).map(i => ax.find(n => n.nodeId === i)).filter(n => n && !n.ignored).map(n => n.role.value + ':' + (n.name && n.name.value)) : [];
    check('L7 tabs: the accessibility tree has one tablist with the five tabs, Gasto outside it', [listas.length, hijos], [1, ['tab:Mes', 'tab:Año', 'tab:Patrimonio', 'tab:Trabajo', 'tab:Ajustes']]);
    await send('Accessibility.disable');

    // hidden amounts: the dots are read as "oculto"
    await ev(`document.querySelector('[data-act=ojo]').click(); true`); await sleep(500);
    check('L7 hidden amounts: every hidden amount of the month is read as "oculto"', await ev(`(function(){ var o = document.querySelectorAll('#v-mes .oc[role=img][aria-label=oculto]').length, sueltos = 0, w = document.createTreeWalker(document.getElementById('v-mes'), 4, null), n;
      while((n = w.nextNode())) if(n.nodeValue.indexOf('\\u2022\\u2022\\u2022\\u2022') >= 0 && !n.parentNode.classList.contains('oc')) sueltos++;
      return [o > 3, sueltos]; })()`), [true, 0]);
    await ev(`document.querySelector('[data-act=ojo]').click(); true`); await sleep(400);

    // reduced motion: no animations or transitions when the system asks for it
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await tab7('anio'); await tab7('mes');
    check('L7 reduced motion: the views and the rows do not animate', await ev(`(function(){ var v = getComputedStyle(document.getElementById('v-mes')), c = document.querySelector('#v-mes .chk');
      return [v.animationName, c ? getComputedStyle(c).transitionDuration.split(',').every(function(x){ return parseFloat(x) === 0; }) : null]; })()`), ['none', true]);
    await send('Emulation.setEmulatedMedia', { features: [] });
    await send('Emulation.clearDeviceMetricsOverride');
  }

  check('no uncaught page errors', pageErrs, []);
}catch(e){ fails++; results.push('ERROR ' + e.message); }
finally{
  console.log(results.join('\n'));
  console.log(`\n${total - fails} pass / ${fails} fail`);
  await cleanup();
  process.exit(fails ? 1 : 0);
}
