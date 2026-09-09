# kibFinanzas

Todo vive en el teléfono. Sin servidor, sin cuenta, sin conexión.
Estos 8 archivos son el sitio completo; van todos juntos en la raíz del repo.

## Instalar desde el celular (sin PC)

1. Descargá kibfinanzas-sitio.zip y abrilo con la app Archivos → Extraer.
2. En Chrome entrá a github.com, iniciá sesión y creá un repositorio
   público (por ejemplo `kibfinanzas`).
3. En el repo: Add file → Upload files → "choose your files" → elegí los
   8 archivos extraídos (mantené apretado para seleccionar varios) →
   Commit changes. Si no ves el botón Add file, activá "Sitio de
   escritorio" en el menú de Chrome.
4. Settings → Pages → Source: Deploy from a branch, main, / (root) → Save.
   En un par de minutos aparece la dirección: https://TUUSUARIO.github.io/kibfinanzas/
5. Abrí esa dirección en Chrome, esperá que cargue, menú ⋮ → Instalar app.

## Copias de seguridad

Ajustes → Hacer copia de seguridad → mandala a Drive, WhatsApp o mail.
El archivo trae todos los años. Cada 30 días sin copia la app te lo recuerda.
Restaurar una copia: Ajustes → Restaurar, o el botón que aparece al abrir
una app vacía.

## APK (opcional)

Con el sitio publicado, en pwabuilder.com pegás la dirección y te genera
el .apk. Del zip que te da, copiá assetlinks.json a una carpeta
`.well-known/` en el repo para que no muestre la barra de Chrome.

## CHANGELOG

v1.2 · 2026-09-08 — Ojito en el encabezado para tapar todos los montos con puntos (modo privado); la elección queda guardada, los campos muestran el número real al editarlos, y copia, CSV e impresión salen siempre con los números reales.
v1.1 · 2026-09-08 — La app pasa a llamarse kibFinanzas: nombre centrado en el encabezado, firma "Desarrollado por Kevin Vasquez" en Ajustes, número de versión visible y las copias se guardan como kibfinanzas-copia-AAAA-MM-DD.json (las copias viejas siguen abriendo).
v1.0 — Primera versión publicada.
