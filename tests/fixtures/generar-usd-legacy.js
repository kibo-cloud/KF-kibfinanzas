'use strict';
// Pins what the Dólares tab (renderUSD HTML, incl. "Patrimonio total") shows for a year WITHOUT `arrastre` (owner decision 2026-10-06:
// such a year looks exactly as before; R5 N3b adds the auditable composition only to a model year). Generated ONCE on 8d1ee42, before
// the composition was added. Run by hand and ONLY with a reason:
//   TUGASTO_GOLDEN_RAZON="why this output changes" node tests/fixtures/generar-usd-legacy.js
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var cp = require('child_process');
var U = require('./usd-vistas');

var razon = String(process.env.TUGASTO_GOLDEN_RAZON || '').trim();
if(!razon){
  console.error('refusing to write usd-legacy.json: set TUGASTO_GOLDEN_RAZON to the reason for this regeneration');
  process.exit(1);
}
function sha(t){ return crypto.createHash('sha256').update(t).digest('hex'); }
var commit = 'unknown';
try { commit = cp.execSync('git rev-parse HEAD', {cwd: __dirname}).toString().trim(); } catch(e) { /* not a git checkout */ }
var data = {};
U.legacy().forEach(function(c){
  var app = U.appUSD(c.d, U.TRAB()), html = app.usd();
  data[c.nombre] = {html: sha(html), htmlLargo: html.length, patrimonio: U.seccionPatrimonio(html)};
});
var texto = JSON.stringify({meta: {razon: razon, baseCommit: commit}, data: data}, null, 1) + '\n';
var destino = path.join(__dirname, 'usd-legacy.json');
fs.writeFileSync(destino, texto);
console.log('wrote ' + destino + ' (' + texto.length + ' bytes)');
