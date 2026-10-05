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
const HOOK = 'window.__kf={get D(){return D},get mes(){return mes},calc:calc,serie:serie,ranking:ranking,datosTorta:datosTorta,guardar:guardar,APPVER:APPVER,plain:function(x){return JSON.parse(JSON.stringify(x))}};\n})();\n</script>';
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

const tmpDirs = []; let srv = null, br = null, ws = null;
const pageErrs = []; let id = 0; const pend = new Map();
const results = []; let fails = 0;
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(expr){
  const r = await send('Runtime.evaluate', { expression: '(function(){with(window.__kf||{}){return eval(' + JSON.stringify(expr) + ')}})()', returnByValue: true, awaitPromise: true });
  if(r.result.exceptionDetails) throw new Error(expr + ' -> ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result.result.value;
}
let URL_APP = '';
async function nav(u){ await send('Page.navigate', { url: u }); await sleep(1500); }
let total = 0;
function check(name, got, want){ total++; const ok = JSON.stringify(got) === JSON.stringify(want); if(!ok) fails++; results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)}${ok ? '' : ' want=' + JSON.stringify(want)}`); }

async function connect(userDir){
  let port = 0;
  for(let t = 0; t < 100 && !port; t++){
    try{ port = parseInt(fs.readFileSync(path.join(userDir, 'DevToolsActivePort'), 'utf8').split('\n')[0], 10) || 0; }catch{}
    if(!port) await sleep(200);
  }
  if(!port) throw new Error('browser did not publish DevToolsActivePort');
  for(let t = 0; t < 50 && !ws; t++){
    try{
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find(x => x.type === 'page');
      if(p) ws = new WebSocket(p.webSocketDebuggerUrl);
    }catch{}
    if(!ws) await sleep(200);
  }
  if(!ws) throw new Error('could not find a page target');
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('websocket error')); });
  ws.onmessage = e => { const m = JSON.parse(e.data); if(m.method === 'Runtime.exceptionThrown') pageErrs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if(m.id && pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
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

  check('no uncaught page errors', pageErrs, []);
}catch(e){ fails++; results.push('ERROR ' + e.message); }
finally{
  console.log(results.join('\n'));
  console.log(`\n${total - fails} pass / ${fails} fail`);
  await cleanup();
  process.exit(fails ? 1 : 0);
}
