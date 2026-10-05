'use strict';
// VERBATIM copy of the baseline engine pieces from commit 7f7ad40 (the pre-R4 app that older installs still run):
// SECS, mesVacio, normalizar, num. Used to prove that an OLD app version preserves the R4 year/month-level fields.
// Do not edit: regenerate only from `git show 7f7ad40:index.html`.
var SECS = [
  {k:'ingresos',        t:'Ingresos'},
  {k:'gastosFijos',     t:'Gastos fijos'},
  {k:'gastosVariables', t:'Gastos variables'},
  {k:'deudas',          t:'Deudas'}
];
function mesVacio(){
  return {
    ingresos:[{nombre:'Sueldo',monto:0},{nombre:'Otros ingresos',monto:0}],
    gastosFijos:[{nombre:'Alquiler',monto:0},{nombre:'Luz',monto:0},{nombre:'Gas',monto:0},
                 {nombre:'Internet',monto:0},{nombre:'Celular',monto:0},{nombre:'Transporte',monto:0}],
    gastosVariables:[{nombre:'Supermercado',monto:0},{nombre:'Comida afuera',monto:0},{nombre:'Salidas',monto:0},
                     {nombre:'Ropa',monto:0},{nombre:'Salud',monto:0},{nombre:'Otros',monto:0}],
    deudas:[{nombre:'Préstamo',monto:0},{nombre:'Tarjeta de crédito',monto:0}],
    ahorroMesARS:0, metaAhorroPct:0.10, ahorroMesUSD:0, compraARS:0, compraUSD:0,
    retiroARS:0, ventaUSD:0, ventaARS:0, reposicionARS:0, movimientos:[]
  };
}
function normalizar(d){
  d = d && typeof d === 'object' ? d : {};
  d.version = 1;
  d.anio = num(d.anio) || 2026;
  d.actualizado = d.actualizado || '';
  d.ahorroAnioAnterior = num(d.ahorroAnioAnterior);
  d.usdAnioAnterior = num(d.usdAnioAnterior);
  d.aReponerAnterior = num(d.aReponerAnterior);   // lo que quedó por reponer al ahorro al cerrar el año anterior
  d.cotizacionUSD = num(d.cotizacionUSD) || 1499;
  d.cotizacionFecha = d.cotizacionFecha || '';
  if(!Array.isArray(d.cripto)) d.cripto = [{activo:'BTC',cantidad:0,precioUSD:0}];
  d.cripto = d.cripto.map(function(c){ return {activo:String(c&&c.activo||''),cantidad:num(c&&c.cantidad),precioUSD:num(c&&c.precioUSD)}; });
  if(!Array.isArray(d.meses)) d.meses = [];
  for(var i=0;i<12;i++){
    var m = d.meses[i] && typeof d.meses[i]==='object' ? d.meses[i] : mesVacio();
    for(var s=0;s<SECS.length;s++){
      var k = SECS[s].k;
      if(!Array.isArray(m[k])) m[k] = [];
      m[k] = m[k].map(function(it){
        var o = {nombre:String(it&&it.nombre||''),monto:num(it&&it.monto),tope:Math.max(0,num(it&&it.tope))};
        var fr = it && it.frec; o.frec = (fr==='semanal'||fr==='quincenal'||fr==='dias'||fr==='mensual') ? fr : '';
        o.dias = []; if(it && Object.prototype.toString.call(it.dias)==='[object Array]'){ for(var qd=0;qd<it.dias.length;qd++){ var vd=Math.round(num(it.dias[qd])); if(vd>=0&&vd<=31&&o.dias.length<31) o.dias.push(vd); } }
        if(it && it.pagado === true) o.pagado = true;
        if(it && it.pagado === false) o.pagado = false;
        return o;
      });
    }
    m.ahorroMesARS = num(m.ahorroMesARS);
    m.ahorroMesUSD = num(m.ahorroMesUSD);
    m.compraARS = num(m.compraARS);
    m.compraUSD = num(m.compraUSD);
    m.retiroARS = num(m.retiroARS);       // pesos que saqué del ahorro
    m.ventaUSD = num(m.ventaUSD);         // dólares que vendí
    m.ventaARS = num(m.ventaARS);         // pesos que me dieron por esos dólares
    m.reposicionARS = num(m.reposicionARS); // pesos que devolví al ahorro
    if(!Array.isArray(m.movimientos)) m.movimientos = [];
    m.movimientos = m.movimientos.filter(function(x){ return x && typeof x==='object'; }).map(function(x){
      return {id:String(x.id||''), fecha:String(x.fecha||''), sec:String(x.sec||'gastosVariables'), nombre:String(x.nombre||''), monto:num(x.monto)};
    });
    m.metaAhorroPct = m.metaAhorroPct==null ? 0.10 : num(m.metaAhorroPct);
    d.meses[i] = m;
  }
  d.meses.length = 12;
  if(!d.planDeudas || typeof d.planDeudas!=='object') d.planDeudas = {};
  Object.keys(d.planDeudas).forEach(function(k){
    var p = d.planDeudas[k] || {};
    d.planDeudas[k] = {recargo:num(p.recargo), total:num(p.total), cuotas:Math.max(0, Math.round(num(p.cuotas))), pagadasAntes:Math.max(0, Math.round(num(p.pagadasAntes)))};
  });
  if(!d.ui || typeof d.ui!=='object') d.ui = {};
  if(['auto','claro','oscuro'].indexOf(d.ui.tema)<0) d.ui.tema = 'auto';
  if(!d.ui.col || typeof d.ui.col!=='object') d.ui.col = {};
  return d;
}
function num(v){ var n = typeof v==='number' ? v : parseFloat(v); return isFinite(n) ? n : 0; }
module.exports = {normalizar: normalizar};
