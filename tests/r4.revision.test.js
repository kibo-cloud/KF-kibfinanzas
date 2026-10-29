'use strict';
// Findings of the R4.2 native review (lineage review-98de80990eaba357), pinned as behavior.
var test = require('node:test');
var assert = require('node:assert/strict');
var la = require('./load-app');
var C = require('./fixtures/r4-casos.js');

var M = la.loadMotor();
function plain(x){ return JSON.parse(JSON.stringify(x)); }
function cuerpo(nombre){
  var s = la.MOTOR_SRC, i = s.indexOf('function ' + nombre + '('), a = s.indexOf('{', i), d = 0, k;
  for(k = a; k < s.length; k++){ if(s[k] === '{') d++; else if(s[k] === '}'){ d--; if(!d) break; } }
  return s.slice(a, k + 1);
}

test('flujosMes decides "paid" with estaPagado, the same predicate pasivos uses (one semantic source)', function(){
  assert.ok(!/\.pagado\s*===\s*true/.test(cuerpo('flujosMes')), 'flujosMes must not re-implement the paid predicate');
  assert.ok(/estaPagado\(/.test(cuerpo('flujosMes')));
  assert.ok(/estaPagado\(/.test(cuerpo('pasivos')));
});

test('a debt row without plan is either a realized installment or a liability, never both', function(){
  var h = C.hoy('2026-10-15'), d = C.vacio(2026);
  d.meses[9].deudas = [C.it('Tarjeta', 40000, true), C.it('Fiado', 15000, false)];
  d = M.normalizar(d, h);
  var f = plain(M.flujosMes(d, 9, h, {})), p = plain(M.pasivos(d, h));
  assert.equal(f.cuotasReal, 40000);
  assert.deepEqual(p.detalle.map(function(x){ return [x.nombre, x.saldo]; }), [['Fiado', 15000]]);
});

test('reposicionExcedente is realized only: a scheduled month reports it apart', function(){
  var h = C.hoy('2026-10-15'), d = C.vacio(2026);
  d.meses[11].reposicionARS = 80000;   // December, future: nothing pending to reponer
  d = M.normalizar(d, h);
  var fut = plain(M.flujosMes(d, 11, h, {}));
  assert.equal(fut.reposicionExcedente, 0);
  assert.equal(fut.reposicionExcedenteProg, 80000);
  d.meses[9].reposicionARS = 30000;    // October, current
  var act = plain(M.flujosMes(d, 9, h, {}));
  assert.equal(act.reposicionExcedente, 30000);
  assert.equal(act.reposicionExcedenteProg, 0);
});
