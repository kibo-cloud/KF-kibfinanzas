# kibFinanzas

Todo vive en el teléfono. Sin servidor, sin cuenta, sin conexión.

En línea: https://kibo-cloud.github.io/KF-kibfinanzas/
Estos 9 archivos son el sitio completo; van todos juntos en la raíz del repo.

## Instalar desde el celular (sin PC)

1. Descargá kibfinanzas-sitio.zip y abrilo con la app Archivos → Extraer.
2. En Chrome entrá a github.com, iniciá sesión y creá un repositorio
   público (por ejemplo `kibfinanzas`).
3. En el repo: Add file → Upload files → "choose your files" → elegí los
   9 archivos extraídos (mantené apretado para seleccionar varios) →
   Commit changes. Si no ves el botón Add file, activá "Sitio de
   escritorio" en el menú de Chrome.
4. Settings → Pages → Source: Deploy from a branch, main, / (root) → Save.
   En un par de minutos aparece la dirección: https://TUUSUARIO.github.io/kibfinanzas/
5. Abrí esa dirección en Chrome, esperá que cargue, menú ⋮ → Instalar app.

## Copias de seguridad

Ajustes → Hacer copia de seguridad → mandala a Drive, WhatsApp o mail.
El archivo trae todos los años. Cada 15 días sin copia la app te lo recuerda.
En Ajustes, **Dónde viven tus datos** dice si el sistema se comprometió a
conservarlos o si los puede borrar para hacer lugar.
Restaurar una copia: Ajustes → Restaurar, o el botón que aparece al abrir
una app vacía.

## Versión para PC

Ajustes → **Guardar la versión para PC** genera un `kibfinanzas-AAAA.html`: la app
entera en un archivo, con los datos del año abierto embebidos entre
`/*DATOS_INICIO*/` y `/*DATOS_FIN*/`. Se abre con doble clic en cualquier
computadora, sin instalar nada. Es una foto del momento: no se sincroniza.

## Privacidad

`privacidad.html` es la política de privacidad publicada, en la dirección
`.../privacidad.html`. Google Play la exige para publicar. Se enlaza desde
Ajustes → Privacidad. Si cambia, actualizar también la fecha de arriba del archivo.

## APK (opcional)

Con el sitio publicado, en pwabuilder.com pegás la dirección y te genera
el .apk. Del zip que te da, copiá assetlinks.json a una carpeta
`.well-known/` en el repo para que no muestre la barra de Chrome.

## CHANGELOG

v1.27 · 2026-09-09 — La app guarda sus propias copias: cada vez que hacés una, se archiva también adentro de la app. En Ajustes aparecen las últimas cinco con fecha, y cada una se puede restaurar o compartir de un toque. Son una red contra errores de carga, no contra perder el teléfono.
v1.26 · 2026-09-09 — Cuando compartir la copia falla, la app ya no lo esconde: descarga igual y avisa con el motivo exacto del navegador. Alternativa nueva: "Copiar la copia al portapapeles", en Ajustes, para pegarla en un mail, una nota o un documento de Drive cuando el menú de compartir no funciona.
v1.25 · 2026-09-09 — Diagnóstico de compartir: Ajustes → Dónde viven tus datos ahora dice qué tipos de archivo acepta compartir este navegador. Y cuando la copia cae en Descargas, el aviso suma un botón "Probar compartir" que reintenta con un .txt y, si el navegador lo rechaza, informa el motivo exacto.
v1.24 · 2026-09-09 — La copia intenta compartirse de tres formas antes de rendirse a Descargas: Chrome en Android bloquea el envío de archivos .json, así que ahora se prueba también como texto y como .txt. Si igual no se puede, el aviso explica cómo compartirla a mano desde la app Archivos. Restaurar acepta también .txt.
v1.23 · 2026-09-09 — Arregla la fecha de fin de las deudas: se proyectaba desde el mes que estabas mirando, así que en el panel del año (que mira diciembre) las cuotas se corrían meses o hasta un año entero. Ahora la proyección arranca siempre en el primer mes sin pagar, así que Mes y Año dan la misma fecha y cambiar de año no la estira.
v1.22 · 2026-09-09 — El check de la v1.21 le comía lugar al nombre y se cortaban las palabras. Se recupera espacio: check y cruz más chicos, menos relleno y separación en la fila, y la columna del monto más angosta. El nombre gana unos 30 píxeles respecto de antes de los checks.
v1.21 · 2026-09-09 — Check de pagado en gastos fijos y deudas, y arregla la incoherencia entre Mes y Año: el panel de Deudas del año contaba como pagadas las cuotas de meses futuros que ya estaban cargadas. Ahora se tildan solas las de los meses que ya pasaron y el actual, las futuras quedan sin tildar, y se puede corregir a mano en los dos sentidos.
v1.20 · 2026-09-09 — Arregla el hueco vacío arriba de la tarjeta principal: la tarjeta del mes y la del año compartían la clase "resumen" desde la v1.17, así que el mes quedó pegajoso bajo el encabezado, con el relleno y el círculo decorativo de la otra. Ahora cada una tiene lo suyo.
v1.19 · 2026-09-09 — Menos aire muerto arriba: encabezado más compacto, las vistas arrancan pegadas y el primer bloque de cada pestaña ya no suma margen propio. El halo de color pasa de 320 a 240 px para que no se lea como una franja vacía.
v1.18 · 2026-09-09 — Pasada de aspecto: el disponible final pasa a ser el saldo centrado de la pantalla, con cuatro accesos redondos abajo (gasto, copia, el año, dólares). Cada sección lleva su ícono en un cuadradito tintado, la pestaña activa de la barra de abajo se marca con una píldora, las tarjetas tienen esquinas más redondeadas y hay un halo verde suave detrás del encabezado.
v1.17 · 2026-09-09 — El resumen del año pasa a ser una tarjeta con anillo animado de porcentaje ahorrado, letra más grande y solo lo esencial en pocas líneas. Se pueden reordenar las categorías con "Cambiar el orden", para ese mes o de ese mes en adelante. Borrar una categoría ahora ofrece Deshacer, y borrar un activo de cripto pregunta antes en vez de borrarlo de una.
v1.16 · 2026-09-09 — Píldora de confirmación: un cartelito chico baja desde el encabezado, con un tilde que se dibuja, cuando terminás de cargar y quedó guardado ("Cambios guardados") y cuando hacés la copia de seguridad ("Copia de seguridad hecha"). No sale en cada tecla: espera a que termines y no se repite antes de siete segundos. Si el navegador no pudo guardar, sale en rojo.
v1.15 · 2026-09-09 — Movimiento con más carácter: al cambiar de pestaña la pantalla entra desde el costado según la dirección, las hojas se cierran arrastrándolas para abajo (con vuelta elástica si el arrastre es corto) y los números grandes suben hasta su valor nuevo en vez de saltar.
v1.14 · 2026-09-09 — Segunda tanda de animaciones: las secciones se pliegan y despliegan con la altura animada en vez de aparecer y desaparecer de golpe, los bloques entran escalonados al cambiar de pestaña, el gráfico de líneas se dibuja solo, las barras del ranking crecen desde cero y los meses, las pestañas y los encabezados responden al toque. Todo se apaga con "reducir movimiento" del sistema.
v1.13 · 2026-09-09 — Año y USD pasan a secciones plegables, como Mes y Ajustes: cada bloque se abre y cierra tocando el encabezado, que muestra al costado el número que lo resume. Las tablas anchas arrancan cerradas. Lo que abrís o cerrás queda guardado.
v1.12 · 2026-09-09 — Arreglado: al terminar de escribir en un campo, la pantalla ya no vuelve arriba de todo; se queda donde estabas. El guardado ahora se ve: el puntito del encabezado hace un pop y el texto se pone verde un segundo. Animaciones suaves al abrir hojas, al aparecer avisos y filas, en las barras de tope y cuando cambia el disponible final. Todo se apaga solo si el teléfono tiene activado "reducir movimiento".
v1.11 · 2026-09-09 — Ajustes rehecho: en vez de una pared de texto, una lista agrupada en Copia de seguridad, Año, Exportar, Aspecto y Ayuda, con ícono en cada renglón y un subtítulo que dice el estado (cuándo fue la última copia, si el sistema garantiza conservar los datos). Lo largo —dónde viven tus datos, el método de uso y privacidad— pasa a su propia pantalla con botón de volver.
v1.10 · 2026-09-09 — Ajustes → "Guardar la versión para PC": la app se arma a sí misma en un solo archivo .html con los datos del año adentro, para abrir en la computadora con doble clic, sin instalar nada. Ya no hace falta pedirla aparte.
v1.9 · 2026-09-09 — Pantalla de bienvenida la primera vez que se abre la app: qué es, que los datos viven solo en ese teléfono y que las copias son la única red de seguridad; se puede volver a ver desde Ajustes. Nueva sección Privacidad en Ajustes y archivo privacidad.html publicado, que es lo que pide Google Play.
v1.8 · 2026-09-09 — La pestaña Año abre con "En criollo": promedio de lo que entra y lo que se va, el mes de más y el de menos gasto, qué porcentaje estás ahorrando, con cuánto cerrás diciembre a ese ritmo y qué meses gastaste más de lo que entró. Los chips del gasto rápido se ordenan por lo que más usás, y el ícono de la app suma un atajo (mantener apretado) para abrir directo en gasto rápido.
v1.7 · 2026-09-09 — Topes por categoría en gastos fijos y variables: se cargan con el botón "Poner topes", se pueden aplicar de ese mes en adelante o solo a ese mes, y la fila muestra una barrita que se pone roja al pasarse. Abajo del disponible final avisa en cuántas categorías te pasaste. Un tope en cero no cambia nada, las copias viejas abren con todos los topes en cero y los topes se arrastran al crear el año siguiente.
v1.6 · 2026-09-09 — Ajustes suma "Dónde viven tus datos": dice si el sistema se comprometió a conservarlos o si los puede borrar para hacer lugar, y cuánto ocupan. Si el navegador no está guardando (ventana privada o almacenamiento bloqueado) ahora aparece un aviso arriba que no se puede cerrar, en vez de un renglón chico. El recordatorio de copia pasa de 30 a 15 días.
v1.5.5 · 2026-09-09 — La app publicada arranca con categorías genéricas y todo en cero (Sueldo, Alquiler, Supermercado, Préstamo…), lista para recomendar. Quien ya la usa no ve ningún cambio: sus categorías viven en el teléfono.
v1.5 · 2026-09-09 — Nueva sección "Saqué del ahorro" (pesos sacados, dólares vendidos, pesos repuestos): lo sacado se suma al disponible del mes y queda un pendiente "a reponer" que se arrastra entre meses y años; columnas nuevas en Año y en el CSV. Botón de borrar en rojo pleno y rojos más suaves en el tema oscuro.
v1.4 · 2026-09-09 — El encabezado muestra el monograma KF en vez del nombre completo, para que el estado de guardado se lea entero. El nombre completo sigue en Ajustes y en la impresión.
v1.3 · 2026-09-09 — El ojo para tapar los montos pasa del encabezado a la fila del Disponible final (y suma un interruptor en Ajustes); al guardar un plan de deuda divide el total por la cantidad de cuotas y ofrece cargarlas solas mes a mes, y lo que no entra en el año se carga al crear el año siguiente.
v1.2 · 2026-09-08 — Ojito en el encabezado para tapar todos los montos con puntos (modo privado); la elección queda guardada, los campos muestran el número real al editarlos, y copia, CSV e impresión salen siempre con los números reales.
v1.1 · 2026-09-08 — La app pasa a llamarse kibFinanzas: nombre centrado en el encabezado, firma "Desarrollado por Kevin Vasquez" en Ajustes, número de versión visible y las copias se guardan como kibfinanzas-copia-AAAA-MM-DD.json (las copias viejas siguen abriendo).
v1.0 — Primera versión publicada.
