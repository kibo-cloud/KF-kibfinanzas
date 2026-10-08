'use strict';
// L1 (P3b redesign): the money shown by "El año" and the Patrimonio (ex "USD") tab of a year WITHOUT `arrastre`, recorded BEFORE the
// redesign (on ec9db4a). The redesign changes labels and layout of those tabs (so their byte pins anio-legacy.json / usd-legacy.json
// were regenerated with a reason), but a legacy year must keep its numbers: tests/l1.vistas.test.js checks that the set of money
// amounts on screen and the year tables are still exactly these. Run by hand and ONLY with a reason:
//   TUGASTO_GOLDEN_RAZON="why" node tests/fixtures/generar-l1-numeros.js
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var V = require('./anio-vistas');
var U = require('./usd-vistas');

var razon = String(process.env.TUGASTO_GOLDEN_RAZON || '').trim();
if(!razon){
  console.error('refusing to write l1-legacy-numeros.json: set TUGASTO_GOLDEN_RAZON to the reason for this regeneration');
  process.exit(1);
}
// every money amount in the HTML (text and attribute values), as a sorted set: "$1.234", "-$5", "US$ 12,50"
function montos(html){
  var m = html.match(/-?(?:US\$\s?|\$)-?[\d.]+(?:,\d+)?/g) || [], s = {};
  m.forEach(function(x){ s[x.replace(/\s+/g, ' ')] = 1; });
  return Object.keys(s).sort();
}
var commit = 'unknown';
try { commit = cp.execSync('git rev-parse HEAD', {cwd: __dirname}).toString().trim(); } catch(e) { /* not a git checkout */ }
var anio = {}, usd = {};
V.corpus().forEach(function(c){
  var app = V.appAnio(c.d, c.otros, V.TRAB_PASES()), html = V.sinAnalisis(app.anio());
  anio[c.nombre] = {montos: montos(html), doceMeses: V.tabla(html, 'anTabla'), anioPorAnio: V.tabla(html, 'anAnios')};
});
U.legacy().forEach(function(c){
  var app = U.appUSD(c.d, U.TRAB()), html = app.usd();
  usd[c.nombre] = {montos: montos(html), dolaresMes: V.tabla(html, 'usdMeses')};
});
var texto = JSON.stringify({meta: {razon: razon, baseCommit: commit}, anio: anio, usd: usd}, null, 1) + '\n';
var destino = path.join(__dirname, 'l1-legacy-numeros.json');
fs.writeFileSync(destino, texto);
console.log('wrote ' + destino + ' (' + texto.length + ' bytes)');
