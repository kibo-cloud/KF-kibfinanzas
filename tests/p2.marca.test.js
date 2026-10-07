'use strict';
// P2 branding: the visible product name is TuGasto. The old name (kibFinanzas / "KF") may only survive where it is a
// technical identifier that existing installs and backups depend on; each such occurrence is allowlisted with its reason.
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var C = require('./fixtures/r4-casos');
var H = require('./fixtures/r45-harness');

var RAIZ = path.join(__dirname, '..');
function leer(n){ return fs.readFileSync(path.join(RAIZ, n), 'utf8'); }

// Old-brand spellings: kibFinanzas, kibfinanzas, "kib finanzas" (any case) and the old "KF" monogram (case-sensitive,
// so the internal CSS class .kf and local variables named kf are not brand text).
var VIEJA = /kib ?finanzas/i, MONOGRAMA = /\bKF\b/;

// Technical occurrences that MUST stay. Key: file; value: [line pattern, reason].
var PERMITIDAS = {
  'sw.js': [
    [/^\/\* kibFinanzas · service worker$/, 'source comment, never shown to the user'],
    [/^var VERSION = 'kibfinanzas-offline-v\d+';$/, 'cache name: it must keep the kibfinanzas-offline- prefix that the cleanup below matches'],
    [/^var PREFIJO = 'kibfinanzas-offline-';/, 'old caches are deleted only by this prefix; renaming it would orphan every installed cache']
  ]
};

function ocurrencias(archivo){
  return leer(archivo).split('\n').map(function(l, i){ return {n: i + 1, l: l}; })
    .filter(function(x){ return VIEJA.test(x.l) || MONOGRAMA.test(x.l); });
}

['index.html', 'privacidad.html', 'manifest.webmanifest', 'sw.js'].forEach(function(archivo){
  test('P2 ' + archivo + ' carries no visible old-brand string (only the annotated technical ones)', function(){
    var permitidas = PERMITIDAS[archivo] || [], usadas = permitidas.map(function(){ return 0; });
    var sueltas = ocurrencias(archivo).filter(function(x){
      for(var i = 0; i < permitidas.length; i++) if(permitidas[i][0].test(x.l.trim())){ usadas[i]++; return false; }
      return true;
    });
    assert.deepEqual(sueltas.map(function(x){ return archivo + ':' + x.n + ' ' + x.l.trim().slice(0, 120); }), []);
    usadas.forEach(function(u, i){ assert.equal(u, 1, 'allowlist entry still matches exactly once (else drop it): ' + permitidas[i][1]); });
  });
});

test('P2 index.html names the product TuGasto in the title, the home-screen title, the header mark and every export', function(){
  var h = leer('index.html');
  assert.match(h, /<title>TuGasto<\/title>/);
  assert.match(h, /<meta name="apple-mobile-web-app-title" content="TuGasto">/);
  assert.match(h, /<h1 id="titulo" title="TuGasto"><span class="kf">TG<\/span>/);
  assert.match(h, /document\.title = 'TuGasto · ' \+ D\.anio;/);
  ["'tugasto-copia-' + fechaArchivo()", "'tugasto-' + D.anio + '.html'", "'tugasto-'+D.anio+'.csv'", "'tugasto-trabajo-' + fechaArchivo() + '.csv'",
   "l.push('TuGasto · Trabajo por mi cuenta", "'<div class=\"pie\">TuGasto v' + APPVER", "'<h3>Bienvenido a TuGasto</h3>'"]
    .forEach(function(s){ assert.ok(h.indexOf(s) >= 0, s); });
});

test('P2 manifest and privacy page say TuGasto', function(){
  var m = JSON.parse(leer('manifest.webmanifest'));
  assert.equal(m.name, 'TuGasto');
  assert.equal(m.short_name, 'TuGasto');
  assert.match(m.description, /^TuGasto/);
  assert.equal(m.id, './', 'the manifest id is unchanged, so installed apps stay the same app');
  var p = leer('privacidad.html');
  assert.match(p, /<title>Política de privacidad · TuGasto<\/title>/);
  assert.match(p, /← Volver a TuGasto<\/a>/);
});

test('P2 icons are PNGs with their declared sizes', function(){
  [['apple-180.png', 180], ['favicon-64.png', 64], ['icono-192.png', 192], ['icono-512.png', 512], ['maskable-512.png', 512]].forEach(function(x){
    var b = fs.readFileSync(path.join(RAIZ, x[0]));
    assert.equal(b.slice(0, 8).toString('hex'), '89504e470d0a1a0a', x[0] + ' PNG signature');
    assert.equal(b.slice(12, 16).toString('latin1'), 'IHDR', x[0] + ' IHDR');
    assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [x[1], x[1]], x[0] + ' size');
  });
});

// Backups: new ones say app:'TuGasto'; restore never requires a value, so old kibFinanzas backups (and any other app value) keep opening.
function restaurado(app){
  var ls = H.fakeStorage({});
  var a = H.appAlmacen(ls); a.D = a.normalizar({anio: 2026}, a.hoy);   // an empty phone with the year open
  var anio = C.vacio(2026); anio.meses[9].ingresos = [C.it('Sueldo', 900000, true)];
  var copia = {version: 1, anios: {2026: anio}}; if(app !== undefined) copia.app = app;
  a.restaurarTexto(JSON.stringify(copia));
  assert.equal(typeof a.pendiente, 'function', 'restore reached its confirmation (app=' + JSON.stringify(app) + ')');
  a.pendiente();
  assert.deepEqual(a.alertas, [], 'no "No parece una copia" alert');
  return JSON.parse(ls.d['kibo.datos.2026']).meses[9].ingresos[0];
}

test('P2 an old kibFinanzas backup and a new TuGasto backup restore the same data', function(){
  var viejo = restaurado('kibFinanzas'), nuevo = restaurado('TuGasto');
  assert.equal(viejo.nombre, 'Sueldo'); assert.equal(viejo.monto, 900000);
  assert.deepEqual(nuevo, viejo);
  assert.deepEqual(restaurado(undefined), viejo, 'a backup without the field also restores');
});

test('P2 a new backup is marked TuGasto and restores into the same years', function(){
  var ls = H.fakeStorage({'kibo.datos.2025': JSON.stringify(C.vacio(2025))});
  var a = H.appAlmacen(ls); a.D = a.normalizar(C.vacio(2025), a.hoy);
  var cp = a.plain(a.armarCopia());
  assert.equal(cp.app, 'TuGasto');
  assert.deepEqual(Object.keys(cp.anios), ['2025']);
  var ls2 = H.fakeStorage({}), b = H.appAlmacen(ls2); b.D = b.normalizar({anio: 2026}, b.hoy);
  b.restaurarTexto(JSON.stringify(cp)); b.pendiente();
  assert.deepEqual(b.alertas, []);
  assert.equal(JSON.parse(ls2.d['kibo.datos.2025']).anio, 2025);
});
