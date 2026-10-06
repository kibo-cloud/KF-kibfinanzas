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
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MARKER = '})();\n</script>';
const HOOK = 'window.__kf={get D(){return D},get mes(){return mes},calc:calc,serie:serie,ranking:ranking,datosTorta:datosTorta,guardar:guardar,activarSaldos:activarSaldos,armarCopia:armarCopia,restaurarTexto:restaurarTexto,get pendiente(){return pendiente},get obsoleta(){return obsoleta},set obsoleta(v){obsoleta=v},get sucio(){return sucio},set sucio(v){sucio=v},APPVER:APPVER,patrimonio:patrimonio,patrimonioPantalla:patrimonioPantalla,hoyApp:hoyApp,fARS:fARS,fUSD:fUSD,plain:function(x){return JSON.parse(JSON.stringify(x))}};\n})();\n</script>';
const DATE_PIN = '<script>(function(){var R=Date,T=new R(2026,9,4,12,0,0).getTime();' +
  'class FD extends R{constructor(...a){if(a.length===0)super(T);else super(...a);}static now(){return T;}}' +
  'window.Date=FD;})();</script>';
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
          var nuevo = new DOMParser().parseFromString(out, 'text/html'), compilan = true;
          Array.prototype.forEach.call(nuevo.querySelectorAll('script'), function(s){
            if(s.type === 'application/json') return;
            try{ new Function(s.textContent); }catch(e){ compilan = false; }
          });
          var cerrar = document.createElement('button'); cerrar.setAttribute('data-act', 'cerrarHoja'); document.body.appendChild(cerrar); cerrar.click(); document.body.removeChild(cerrar);
          resolve({
            captured: true, m1: out.split(M1).length - 1, m2: out.split(M2).length - 1,
            embeddedYear: datos ? datos.anio === D.anio : false, embeddedMonths: datos && datos.meses ? datos.meses.length : null,
            motorBlocks: out.split('<script id="motor">').length - 1, motorHasMarkers: mo ? mo[1].indexOf('DATOS_') >= 0 : null,
            appAfterMotor: !!mo && app > out.indexOf('<script id="motor">'),
            motorDefinesTGMotor: !!mo && mo[1].indexOf('var TGMotor = (function(){') >= 0,
            scriptsCompile: compilan,
            scriptIds: Array.prototype.map.call(nuevo.querySelectorAll('script'), function(s){ return s.id || '(app)'; })
          });
        });
      })();
    });
  } + ')()';
  check('"Versión para PC" (real versionPC): data embedded once, motor before the app, every script compiles', await ev(pcCheck),
    { captured: true, m1: 1, m2: 1, embeddedYear: true, embeddedMonths: 12, motorBlocks: 1, motorHasMarkers: false, appAfterMotor: true,
      motorDefinesTGMotor: true, scriptsCompile: true, scriptIds: ['(app)', 'datos', 'motor', '(app)'] });   // the first '(app)' is the Date pin the harness injects in <head>

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
  check('R4.3 c: restore brings arrastre, cierreReal and rev back', await ev(`plain({arrastre: D.arrastre, cierre: D.meses[8].cierreReal, rev: D.rev})`), modeloAntes);
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

    // (c) Q3: in a model month a "Del trabajo" row without pases is ordinary income with a checkbox (real click path)
    const q3 = JSON.parse(JSON.stringify(modelY));
    q3.meses[9].ingresos[1] = it('Del trabajo', 80000, false); q3.meses[10].ingresos = [];
    await seed(q3, null);
    check('R4.4 Q3: "Del trabajo" without pases has a checkbox in a model month', await ev(`document.querySelectorAll('[data-act=pagar][data-k=ingresos]').length`), 2);
    check('R4.4 Q3: unticked it is pending, not in the card (100.000 + 200.000 - 50.000)', await pantalla(), '250000');
    await ev(`document.querySelector('[data-act=pagar][data-k=ingresos][data-i="1"]').click(); true`); await sleep(1400);
    check('R4.4 Q3: ticked it is realized', [await ev(`D.meses[9].ingresos[1].pagado`), await pantalla()], [true, '330000']);
  }

  check('no uncaught page errors', pageErrs, []);
}catch(e){ fails++; results.push('ERROR ' + e.message); }
finally{
  console.log(results.join('\n'));
  console.log(`\n${total - fails} pass / ${fails} fail`);
  await cleanup();
  process.exit(fails ? 1 : 0);
}
