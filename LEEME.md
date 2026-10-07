# TuGasto

TuGasto (antes kibFinanzas). Las copias de seguridad y los datos guardados con el nombre anterior siguen
abriendo igual: no hay que hacer nada.

Todo vive en el teléfono. Sin servidor, sin cuenta, sin conexión.

En línea: https://kibo-cloud.github.io/KF-kibfinanzas/ (la dirección todavía lleva el nombre anterior del repositorio)
Estos 9 archivos son el sitio completo; van todos juntos en la raíz del repo.

## Instalar desde el celular (sin PC)

1. Descargá el zip del sitio y abrilo con la app Archivos → Extraer.
2. En Chrome entrá a github.com, iniciá sesión y creá un repositorio
   público (por ejemplo `tugasto`).
3. En el repo: Add file → Upload files → "choose your files" → elegí los
   9 archivos extraídos (mantené apretado para seleccionar varios) →
   Commit changes. Si no ves el botón Add file, activá "Sitio de
   escritorio" en el menú de Chrome.
4. Settings → Pages → Source: Deploy from a branch, main, / (root) → Save.
   En un par de minutos aparece la dirección: https://TUUSUARIO.github.io/tugasto/
5. Abrí esa dirección en Chrome, esperá que cargue, menú ⋮ → Instalar app.

## Copias de seguridad

Ajustes → Hacer copia de seguridad → mandala a Drive, WhatsApp o mail.
El archivo trae todos los años. Cada 15 días sin copia la app te lo recuerda.
En Ajustes, **Dónde viven tus datos** dice si el sistema se comprometió a
conservarlos o si los puede borrar para hacer lugar.
Restaurar una copia: Ajustes → Restaurar, o el botón que aparece al abrir
una app vacía.

## Versión para PC

Ajustes → **Guardar la versión para PC** genera un `tugasto-AAAA.html`: la app
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

v1.32.0 · 2026-10-07 — El saldo pasa de un mes al otro. La primera vez la app te pregunta cuánto dinero tenés disponible ahora (lo podés omitir) y desde ese mes cada mes arranca con lo que te quedó el anterior: en Mes ves el saldo inicial (con Editar), lo que entró, lo que salió y lo que te queda hoy, más lo proyectado al cierre como estimado. Al terminar un mes podés confirmar con cuánto cerraste de verdad; la diferencia queda anotada y nunca se inventa un movimiento. Lo que cargás en meses que todavía no llegaron queda programado: no cuenta como pagado en la torta, en los topes ni en las cuotas, aunque lo hayas tildado antes. Los pases de Trabajo con fecha futura se descuentan recién ese día, y si el renglón "Del trabajo" tiene más que lo que pasaste, ese resto lo tildás vos cuando lo cobres. En Dólares, "Patrimonio total" ahora muestra de qué está hecho: disponible, ahorro en pesos, dólares y cripto (estimados a tu cotización), plata del trabajo, el patrimonio bruto, las deudas que te faltan pagar y el neto. El año, su CSV y "Año por año" usan los mismos números que la tarjeta del mes. Los años que ya tenías sin esto se ven igual que antes. Antes del primer cambio se guarda una copia de tus datos por 30 días.
v1.31.4 · 2026-10-04 — Mantenimiento interno: el motor de cálculos quedó separado para poder probarlo mejor. No cambia ningún número.
v1.31.3 · 2026-10-04 — Los números mal escritos ya no se guardan a escondidas: si escribís algo que la app no entiende (por ejemplo "1e3" o "12.5,3"), el campo se marca, no se cambia nada y al salir te avisa "No entendí «…» como número" y vuelve al último valor. Ahora se leen bien las cantidades chicas (0,001 de cripto) y el punto de miles (1.234 son mil doscientos treinta y cuatro). El botón Gasto de la tarjeta de arriba ahora abre el gasto rápido. La app ya no se considera vacía si cargaste montos sin tildarlos (no te vuelve a mostrar el cartel de app vacía y sí te recuerda hacer la copia de seguridad). Al deshacer un gasto rápido, el renglón vuelve a como estaba, tildado o no. Una cuota de deuda solo cuenta como paga si está tildada y tiene monto, y la última cuota de un plan lleva el resto del redondeo para que todas sumen exactamente el total (100.000 en 3 cuotas: 33.333, 33.333 y 33.334). Si al restaurar una copia algún año no entra, te dice cuál en lugar de decir que restauró todo, y el guardado vuelve a funcionar solo cuando el navegador se recupera. Seguridad: los avisos de abajo muestran como texto lo que venga de tus datos, los CSV exportados no ejecutan fórmulas escondidas en nombres o conceptos, y volver a la versión anterior a la 1.30 solo toca los datos de esta app.
v1.31.2 · 2026-10-04 — Las barras de tope de cada categoría ahora se llenan solo con lo que ya pagaste (tildado): un gasto pendiente no consume el tope ni dispara el aviso de "Te pasaste del tope" hasta que lo tildes, y si lo destildás deja de contar.
v1.31.1 · 2026-10-04 — La torta "En qué se te va" del mes y el ranking "En qué se te fue la plata" del año ahora muestran solo lo que ya pagaste (tildado), igual que los totales: lo pendiente no aparece hasta que lo tildes y vuelve a salir si lo destildás.
v1.31.0 · 2026-10-04 — Los totales ahora cuentan solo lo que ya pasó de verdad: un ingreso suma cuando lo cobraste (lo tildás) y un gasto, una cuota o una deuda resta cuando la pagaste. Lo que cargás sin tildar queda como pendiente y no mueve el disponible, el ahorro sugerido ni los gráficos del mes y del año. Ahora Ingresos y Gastos variables también tienen el círculo para tildar, igual que Gastos fijos y Deudas; el renglón "Del trabajo" siempre cuenta porque ya está cobrado. Lo que ya tenías cargado en meses anteriores y en el actual sigue viéndose como estaba (tildado), y lo nuevo arranca sin tildar. Lo que sumás con el botón de gasto rápido queda tildado porque ya lo gastaste. Al crear un año nuevo, todo arranca sin tildar, y las cuotas que se cargan de meses ya pasados quedan pagadas.
v1.30.8 · 2026-09-22 — Carpetas con color para los productos rápidos: se eligen o se crean al cargar el producto (sin carpeta va a General), arriba hay una tira para ver una sola carpeta y en Todas cada carpeta se pliega; el buscador, la grilla compacta, el stock y el cobro al toque siguen igual.
v1.30.7 · 2026-09-22 — Para quien tiene muchos productos rápidos: buscador que filtra mientras escribís y botón para pasar a una grilla compacta (nombre, precio y stock, 2 o 3 columnas según el ancho) que cobra igual con un toque y elige medio manteniendo apretado; la app recuerda la vista elegida.
v1.30.6 · 2026-09-22 — En los productos rápidos el medio de pago pasa a ser "por defecto (para cobro a 1 toque)" y es opcional: con "Preguntar siempre", cada toque pregunta efectivo o virtual; en Trabajo (modo Simple) lo cobrado en el mes se ve separado en Digital y Efectivo, con el total abajo.
v1.30.5 · 2026-09-22 — Productos rápidos con medio de pago al tocar y stock: el toque cobra con el medio de siempre, el iconito de la esquina o mantener apretado deja elegir Efectivo o Transferencia para esa venta, así no hace falta cargar el mismo producto dos veces; stock opcional que baja solo con cada venta, se ve en la tarjeta y en cero la marca Agotado pero deja vender igual o reponer.
v1.30.4 · 2026-09-17 — La tarjeta de arriba de Mes ya no queda estirada al alto del gráfico: toma el alto de la hoja que estás mirando y se acomoda sola al pasar de una a otra.
v1.30.3 · 2026-09-12 — La tarjeta de arriba de Mes se desliza al costado y muestra una segunda hoja: un gráfico de anillo con en qué se te va la plata este mes, agrupando fijos, variables y deudas, con el porcentaje y el monto de cada uno y el resto juntado en "Otros". Está hecho con SVG a mano, sin librerías ni internet, y los colores salen de variables CSS, así que respeta el tema claro y el oscuro. El deslizamiento se queda dentro de la tarjeta y nunca cambia de pestaña; también se puede tocar los puntitos de abajo.
v1.30.2 · 2026-09-12 — Se saca el renglón "te alcanza para X por día" de la vista del mes: confundía más de lo que ayudaba. En Ingresos, cada renglón puede decir cada cuánto lo cobrás (mensual, semanal, quincenal o los días que elijas, marcándolos en una grilla): ponés el total del mes o cuánto es cada pago y la app hace la otra cuenta. En el plan de cuotas y en las facturas, el porcentaje de recargo, interés o descuento pasa a ser opcional: si lo dejás vacío, las cuentas salen sin recargo, como hasta ahora.
v1.30.1 · 2026-09-12 — Arregla el ícono roto de "Volver a como estaba antes de la 1.30" en Ajustes, que mostraba la palabra undefined.
v1.30.1 · 2026-09-12 — Arregla el ícono roto de "Volver a como estaba antes de la 1.30" en Ajustes, que mostraba la palabra undefined.
v1.30 · 2026-09-12 — Llega la pestaña Trabajo para quien vende o factura por su cuenta: se prende en Ajustes y trae dos modos. Simple: ventas sueltas, productos rápidos de un toque con costo y ganancia, e ingresos por semana o quincena de plataformas y changas. Profesional: facturas con cliente y plazo, cobros con sugerencia automática, retenciones, echeqs, cobranza de la semana con recordatorio por el menú de compartir, abonos que se repiten solos, tope del monotributo y CSV para el contador. Lo cobrado se pasa a Ingresos del mes en el renglón "Del trabajo". En Mes aparece el ritmo del mes: cuánto te alcanza por día y aviso si a ese ritmo no llegás. Arreglos de la base: el service worker ya no borra cachés ajenas y el gesto para cambiar de pestaña no se traba sobre renglones cortados. Al actualizar se guarda una copia de tus datos por 30 días, por si querés volver atrás.
v1.28 · 2026-09-09 — Se cambia de pestaña deslizando el dedo para los costados, sin tocar los botones de abajo. El gesto respeta lo que ya se mueve al costado (la tira de meses, las tablas anchas) y no actúa con una hoja abierta. Dentro de una subpantalla de Ajustes, deslizar a la derecha vuelve al principio.
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
