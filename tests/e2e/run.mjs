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
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  fs.writeFileSync(path.join(dir, 'index.html'), html);
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
  // (1) the card "Gasto" button opens the same quick-expense sheet as the FAB
  check('card Gasto button exists', await ev(`!!document.querySelector('[data-act=rapido]')`), true);
  await ev(`document.querySelector('[data-act=rapido]').click(); true`); await sleep(300);
  check('card Gasto button opens the quick-expense sheet', await ev(`!!document.getElementById('grMonto') && document.getElementById('velo').classList.contains('on')`), true);
  const cerrarHoja = async () => { await ev(`(function(){ var b = document.querySelector('#hoja [data-act=cerrarHoja]'); if(b) b.click(); return true; })()`); await sleep(400); };
  await cerrarHoja();
  await ev(`document.querySelector('[data-act=gastoRapido]').click(); true`); await sleep(300);
  check('FAB opens the same sheet', await ev(`!!document.getElementById('grMonto')`), true);
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
  await typeIn('input.monto[data-k=gastosVariables][data-i="0"]', '5000'); await sleep(800);
  check('unticked amount is registered', await ev('D.meses[9].gastosVariables[0].pagado'), false);
  check('unticked amount: empty notice is gone', await ev(`!!document.querySelector('#avisos [data-av=vacia]')`), false);
  await nav(URL_APP);
  check('reload: no empty notice', await ev(`!!document.querySelector('#avisos [data-av=vacia]')`), false);
  check('reload: backup reminder shown (no backup yet)', await ev(`document.getElementById('avisos').textContent.indexOf('Todavía no hiciste ninguna copia') >= 0`), true);
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

  // ── R4.3: several tabs, model fields on reload, backup -> restore, back to pre-R4 ──
  const oct = (sueldo) => { const ms = []; for(let i=0;i<12;i++) ms.push(mes([], [], [], []));
    ms[9] = mes([it('Sueldo', sueldo, true)], [it('Alquiler', 50000, true)], [it('Super', 30000, false)], []); return ms; };
  const blobR4 = JSON.stringify({anio: 2026, pagoExplicito: true, meses: oct(200000)});
  const sembrar = async () => { await ev(`localStorage.clear(); localStorage.setItem('kibo.bienvenida','1'); localStorage.setItem('kibo.anio','2026'); localStorage.setItem('kibo.datos.2026', ${JSON.stringify(blobR4)}); true`); };
  const AVISO_OTRA = 'Hay cambios hechos en otra pestaña. Recargá para no perderlos.';
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
  check('R4.3 b: Ajustes shows the "volver" row while the snapshot exists', await ev(`(function(){ var b = document.querySelector('[data-act=volverR4]'); return b ? b.textContent.indexOf('Volver a como estaba antes de los saldos') >= 0 : false; })()`), true);

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
    const patri = () => ev(`[document.getElementById('bigPatri').textContent, document.getElementById('bigPatri').nextElementSibling.textContent]`);
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
    check('R5 Del trabajo above its pases: the split is said in plain words', await ev(`document.querySelector('#v-mes .tj-vienede').textContent.indexOf('De esto, ' + fARS(300000) + ' vino de pases del trabajo; el resto, ' + fARS(100000) + ', lo marcás vos.') >= 0`), true);
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
      const v = await ev(`[document.getElementById('bigPatri').textContent, document.getElementById('bigPatri').nextElementSibling.textContent]`);
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
      ['Disponible inicial', 'Lo cargaste vos', 'Editar', 'Disponible actual', 'Proyectado al cierre (estimado)'].map(t => s1.indexOf(t) >= 0).concat([s1.indexOf(await ev('fARS(225000)')) >= 0]),
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
    check('D16-17 Omitir: origen omitido, shown as "Saldo inicial sin configurar", available = what October registered',
      [g3.arrastre.inicial.origen, g3.arrastre.inicial.apertura, (await texto('#saldoMes')).indexOf('Saldo inicial sin configurar') >= 0, await hay('#primerUso'), await pantalla()],
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
    check('R5 September (past): "Disponible al cierre" and "¿Es correcto?"',
      [(await texto('#saldoMes')).indexOf('Disponible al cierre') >= 0, await hay('#saldoMes [data-act=cierreAbrir]'), await pantalla()], [true, true, '300000']);
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
    check('R5 reconfirm: the confirmed value is kept, the difference shows, Confirmar de nuevo / Mantener are offered',
      [await pantalla(), (await texto('#avisoReconfirmar')).indexOf('Cambió desde que lo confirmaste') >= 0, await hay('#saldoMes [data-act=cierreMantener]')], ['275000', true, true]);
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
      await tab6('usd'); const patri6 = await ev(`document.getElementById('bigPatri').textContent + ' | ' + document.getElementById('bigPatri').nextElementSibling.textContent + ' | ' + document.getElementById('v-usd').textContent`);
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
      await ev(`[document.getElementById('avisos').textContent.indexOf('No pude leer los datos de 2026. Guardé una copia; no se van a pisar.') >= 0, localStorage.getItem('kibo.cuarentena.2026') === ${JSON.stringify(roto)}]`), [true, true]);
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

  check('no uncaught page errors', pageErrs, []);
}catch(e){ fails++; results.push('ERROR ' + e.message); }
finally{
  console.log(results.join('\n'));
  console.log(`\n${total - fails} pass / ${fails} fail`);
  await cleanup();
  process.exit(fails ? 1 : 0);
}
