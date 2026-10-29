'use strict';
// D6 (owner-decisions-closure): two presentation-only items.
//  N3b-B (a) + prominent label: while the app's default cotización is in use (none loaded), Patrimonio says so where the number is
//  read: an amber "Cotización sin cargar" chip in the hero and on the dollar / crypto rows, and the explanation note in amber.
//  N4-A (a) + (c): an unreadable Trabajo blob used to be read as empty with no word (copied to quarantine only at the next save). Now it
//  is copied to quarantine when the app starts and a notice says so, with «Descargar el texto»; the year notice gets the same button.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');
var U = require('./fixtures/usd-vistas');

function filas(html){
  var out = {}, re = /<div class="fila-in" data-pat="([a-z-]+)"><label>([\s\S]*?)<\/label><span[^>]*>([\s\S]*?)<\/span><\/div>/g, m;
  while((m = re.exec(html))) out[m[1]] = [m[2].replace(/<[^>]+>/g, '').trim(), m[3].replace(/<[^>]+>/g, '').trim()];
  return out;
}

test('D6 N3b-B the default cotización is named prominently: hero chip, row chip, amber note', function(){
  var raw = C.seccion2(false, false); raw.cotizacionUSD = 0; raw.cotizacionFecha = '';
  var app = U.appUSD(raw), html = app.usd();
  assert.match(html, /<div class="hero-chips">[^]*?<span class="chip pend">Cotización sin cargar<\/span>/, 'hero chip');
  assert.match(html, /data-pat="usd"><label>Dólares <small class="mudo">\(US\$ 1\.000,00 a \$1\.499\)<\/small> <small class="est pend">Cotización sin cargar<\/small><\/label>/);
  assert.match(html, /<div class="nota ambar">Todavía no cargaste la cotización del dólar/);
  assert.deepEqual(filas(html).neto, ['Patrimonio neto', '$2.624.000'], 'no number changes');
});

test('D6 N3b-B with a loaded cotización, or no dollars at all, nothing extra is shown', function(){
  var app = U.appUSD(C.seccion2(false, false)), html = app.usd();
  assert.doesNotMatch(html, /Cotización sin cargar/);
  assert.doesNotMatch(html, /nota ambar">Todavía/);
  var raw = C.seccion2(false, false); raw.cotizacionUSD = 0; raw.cotizacionFecha = ''; raw.usdAnioAnterior = 0;
  raw.meses.forEach(function(m){ m.compraUSD = 0; m.ahorroMesUSD = 0; m.ventaUSD = 0; m.compraARS = 0; m.ventaARS = 0; });
  var b = U.appUSD(raw), hb = b.usd();
  assert.doesNotMatch(hb, /chip pend">Cotización sin cargar/, 'no dollars, no crypto: the default price changes nothing, no hero chip');
});

function appCuar(store){
  var ls = H.fakeStorage(store), avisos = {innerHTML: ''}, bajadas = [], toasts = [];
  var a = la.loadApp({today: '2026-10-15', funcs: ['revGuardada', 'revValida', 'claveCuarentena', 'ponerEnCuarentena', 'avisoCuarentena', 'revisarTrabajoIlegible', 'descargarCuarentena', 'esc', 'fechaArchivo', 'dos'],
    vars: ['LSCUAR', 'LSTRAB', 'LSDIARIO', 'PREF'],
    globals: {localStorage: ls, document: {getElementById: function(id){ return id === 'avisos' ? avisos : null; }},
      descargar: function(t, n, tipo){ bajadas.push([t, n, tipo]); }, toast: function(t){ toasts.push(t); }}});
  a.ls = ls; a.avisos = avisos; a.bajadas = bajadas; a.toasts = toasts;
  return a;
}

test('D6 N4-A an unreadable Trabajo is set apart at start and named, with «Descargar el texto»', function(){
  var a = appCuar({'kibo.trabajo': '{"facturas":[ roto'});
  assert.equal(a.revisarTrabajoIlegible(), true);
  assert.equal(a.ls.d['kibo.cuarentena.trabajo'], '{"facturas":[ roto', 'the text is kept as is, before anything can write Trabajo');
  assert.equal(a.ls.d['kibo.trabajo'], '{"facturas":[ roto', 'nothing else is written');
  assert.match(a.avisos.innerHTML, /data-av="cuarentena-trabajo"/);
  assert.match(a.avisos.innerHTML, /No pude leer los datos de Trabajo\. Los aparté tal cual/);
  assert.match(a.avisos.innerHTML, /<button class="mini" data-act="cuarDescargar" data-k="kibo\.cuarentena\.trabajo">Descargar el texto<\/button>/);
  var b = appCuar({'kibo.trabajo': '{"facturas":[]}'});
  assert.equal(b.revisarTrabajoIlegible(), false);
  assert.equal(b.avisos.innerHTML, '');
  assert.equal('kibo.cuarentena.trabajo' in b.ls.d, false);
});

test('D6 N4-A the year notice offers the download too; the Trabajo notice is added after it', function(){
  var a = appCuar({'kibo.trabajo': 'x', 'kibo.datos.2026': '{roto'});   // D9 A3: the button is offered for the copy that holds this year's text
  a.avisoCuarentena(2026);
  assert.match(a.avisos.innerHTML, /data-act="cuarDescargar" data-k="kibo\.cuarentena\.2026">Descargar el texto</);
  assert.match(a.avisos.innerHTML, /data-act="restaurar"/, 'restore kept');
  a.revisarTrabajoIlegible();
  assert.match(a.avisos.innerHTML, /data-av="cuarentena"[^]*data-av="cuarentena-trabajo"/, 'both notices');
});

test('D6 N4-A «Descargar el texto» saves the kept text exactly; only quarantine keys; a missing copy is said', function(){
  var a = appCuar({'kibo.cuarentena.2026': 'texto { raro', 'kibo.cuarentena.trabajo.2': 'otro', 'kibo.datos.2026': '{}'});
  a.descargarCuarentena('kibo.cuarentena.2026');
  a.descargarCuarentena('kibo.cuarentena.trabajo.2');
  assert.deepEqual(a.bajadas.map(function(x){ return [x[0], x[1].replace(/\d{4}-\d{2}-\d{2}/, 'FECHA'), x[2]]; }),
    [['texto { raro', 'tugasto-apartado-2026-FECHA.txt', 'text/plain;charset=utf-8'], ['otro', 'tugasto-apartado-trabajo.2-FECHA.txt', 'text/plain;charset=utf-8']]);
  a.descargarCuarentena('kibo.datos.2026');
  a.descargarCuarentena('kibo.cuarentena.2025');
  assert.equal(a.bajadas.length, 2, 'not a quarantine key, or not there: nothing downloaded');
  assert.deepEqual(a.toasts, ['Ese texto apartado ya no está en este teléfono']);
});
