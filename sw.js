/* kibFinanzas · service worker
   Deja la app entera en caché para que abra sin conexión y la actualiza
   en segundo plano cuando hay señal. Los datos no pasan por acá: viven
   en el almacenamiento del navegador. */
var VERSION = 'kibfinanzas-offline-v17';
var BASE = ['./', './index.html', './manifest.webmanifest', './favicon-64.png', './privacidad.html',
            './icono-192.png', './icono-512.png', './maskable-512.png', './apple-180.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(BASE); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k !== VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(function(c){
    return c.match(e.request, {ignoreSearch:true}).then(function(hit){
      var red = fetch(e.request).then(function(r){ if(r && r.ok) c.put(e.request, r.clone()); return r; })['catch'](function(){ return hit; });
      return hit || red;
    });
  }));
});
