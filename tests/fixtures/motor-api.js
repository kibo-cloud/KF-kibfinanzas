'use strict';
// Adapter for the golden corpus: the engine loaded AS A WHOLE (the <script id="motor"> block evaluated in a bare vm context,
// no regex extraction, no DOM, no app globals). Every function already takes explicit arguments, so the API is TGMotor itself.
var loadMotor = require('../load-app').loadMotor;

function build(){
  return loadMotor();   // bare context, poisoned Date: the corpus passes an explicit `hoy` built from TODAY
}

module.exports = {build: build};
