'use strict';
// Regenerates tests/fixtures/motor-golden.json from the CURRENT engine. Run by hand:
//   node tests/fixtures/generar-golden.js
// Only regenerate when an engine change is intended and reviewed (R4 changes semantics on purpose):
// the golden test exists to prove that a refactor changes no number. Never regenerate to make it pass.
var fs = require('fs');
var path = require('path');
var corpus = require('./motor-corpus');
var api = require('./motor-api').build();

var texto = corpus.canon(corpus.compute(api)) + '\n';
var destino = path.join(__dirname, 'motor-golden.json');
fs.writeFileSync(destino, texto);
console.log('wrote ' + destino + ' (' + texto.length + ' bytes)');
