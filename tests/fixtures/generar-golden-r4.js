'use strict';
// Regenerates tests/fixtures/motor-golden-r4.json (the NEW R4.2 functions only). Run by hand and ONLY with a reason:
//   TUGASTO_GOLDEN_RAZON="why this output changes" node tests/fixtures/generar-golden-r4.js
// The fixture stores {meta:{razon, baseCommit, hash}, data}; the golden test fails if the hash does not match the data or the reason is empty.
// Never regenerate to make a failing test pass: a failing golden first gets an explanation (design doc section 9).
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var cp = require('child_process');
var corpus = require('./motor-corpus-r4');
var api = require('./motor-api').build();

var razon = String(process.env.TUGASTO_GOLDEN_RAZON || '').trim();
if(!razon){
  console.error('refusing to write motor-golden-r4.json: set TUGASTO_GOLDEN_RAZON to the reason for this regeneration');
  process.exit(1);
}
var commit = 'unknown';
try { commit = cp.execSync('git rev-parse HEAD', {cwd: __dirname}).toString().trim(); } catch(e) { /* not a git checkout */ }
var data = JSON.parse(corpus.canon(corpus.compute(api)));
var hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
var texto = JSON.stringify({meta: {razon: razon, baseCommit: commit, hash: hash}, data: data}) + '\n';
var destino = path.join(__dirname, 'motor-golden-r4.json');
fs.writeFileSync(destino, texto);
console.log('wrote ' + destino + ' (' + texto.length + ' bytes, hash ' + hash + ')');
