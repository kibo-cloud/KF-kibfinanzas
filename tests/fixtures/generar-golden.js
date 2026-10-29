'use strict';
// Regenerates tests/fixtures/motor-golden.json from the CURRENT engine (TGMotor, loaded as a whole). Run by hand:
//   TUGASTO_GOLDEN_RAZON="why" node tests/fixtures/generar-golden.js   (refuses to write without a reason)
// Only regenerate when an engine change is intended and reviewed (R4 changes semantics on purpose):
// (The committed fixture was generated at f95a625 from the engine BEFORE it moved out of the app script.)
// the golden test exists to prove that a refactor changes no number. Never regenerate to make it pass.
var fs = require('fs');
var path = require('path');
var corpus = require('./motor-corpus');
var api = require('./motor-api').build();

if(!String(process.env.TUGASTO_GOLDEN_RAZON || '').trim()){
  console.error('refusing to write motor-golden.json: set TUGASTO_GOLDEN_RAZON to the reason for this regeneration (design doc section 9)');
  process.exit(1);
}
var texto = corpus.canon(corpus.compute(api)) + '\n';
var destino = path.join(__dirname, 'motor-golden.json');
fs.writeFileSync(destino, texto);
console.log('wrote ' + destino + ' (' + texto.length + ' bytes)');
