'use strict';
// Pins what "El año" (renderAnio HTML, incl. "Los doce meses" and "Año por año") and the year CSV show for a year WITHOUT `arrastre`,
// over every motor-corpus dataset (owner decision 2026-10-06: such a year must stay byte-identical). Generated ONCE on 0ad13c1, before
// the year views moved to the chain. Run by hand and ONLY with a reason:
//   TUGASTO_GOLDEN_RAZON="why this output changes" node tests/fixtures/generar-anio-legacy.js
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var cp = require('child_process');
var V = require('./anio-vistas');

var razon = String(process.env.TUGASTO_GOLDEN_RAZON || '').trim();
if(!razon){
  console.error('refusing to write anio-legacy.json: set TUGASTO_GOLDEN_RAZON to the reason for this regeneration');
  process.exit(1);
}
function sha(t){ return crypto.createHash('sha256').update(t).digest('hex'); }
var commit = 'unknown';
try { commit = cp.execSync('git rev-parse HEAD', {cwd: __dirname}).toString().trim(); } catch(e) { /* not a git checkout */ }
var data = {};
V.corpus().forEach(function(c){
  var app = V.appAnio(c.d, c.otros, V.TRAB_PASES());
  var html = V.sinAnalisis(app.anio()), csv = app.csv();   // L6: pinned without the analysis sections (tests/l6.analisis.test.js)
  data[c.nombre] = {html: sha(html), htmlLargo: html.length, csv: csv};
});
var texto = JSON.stringify({meta: {razon: razon, baseCommit: commit}, data: data}, null, 1) + '\n';
var destino = path.join(__dirname, 'anio-legacy.json');
fs.writeFileSync(destino, texto);
console.log('wrote ' + destino + ' (' + texto.length + ' bytes)');
