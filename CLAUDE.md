# TuGasto (repositorio KF-kibfinanzas)

Contexto del proyecto para Claude Code. Leer antes de trabajar aca; el protocolo general
esta en `../CLAUDE.md`.

## Que es

PWA de finanzas personales que vive entera en el telefono: sin servidor, sin cuenta, sin
conexion. Antes se llamaba kibFinanzas; las copias de seguridad viejas siguen abriendo.
Publicada en `https://kibo-cloud.github.io/KF-kibfinanzas/`. Version actual 1.34.1
(CHANGELOG en `LEEME.md`). Incluye "Version para PC" (`tugasto-AAAA.html` autocontenido con
datos entre `/*DATOS_INICIO*/` y `/*DATOS_FIN*/`) y politica de privacidad para Google Play.

## Stack

- Sitio estatico sin dependencias: casi toda la app esta en `index.html` (~8660 lineas).
- `sw.js` (26 lineas): cache `kibfinanzas-offline-v48`; solo borra caches con su prefijo.
- CSP declarada en `index.html`.
- Prefijo de datos `kibo.` (KCO usa `kibco.` y no lo toca).
- El sitio publicado son 9 archivos en la raiz (`LEEME.md`).

## Como correr

Servir la carpeta con un servidor estatico o abrir `index.html` (tambien funciona como
`file://` en la version para PC). Comando exacto de servidor local: por verificar.

## Como probar (de `package.json`)

| Comando | Que hace |
|---|---|
| `npm test` | `node --test "tests/**/*.test.js"` |
| `npm run test:e2e` | `node tests/e2e/run.mjs` (Node 22+; salida 0 ok, 1 falla, 2 sin navegador) |

- El E2E copia el sitio a un directorio temporal, inyecta `window.__kf` solo en la copia y
  fija la fecha en 2026-10-04 12:00 local. Nunca escribe en el repo.
- `tests/fixtures/` guarda goldens del motor (`motor-golden*.json`) y generadores; los
  tests `motor.golden*` y `r4.*` protegen el contrato financiero R4.
- `tests/load-app.js` carga la app para tests en Node.
- Conteo actual de tests verdes (1.34.1): `npm test` 951/951, `npm run test:e2e` 549/549.

## Mapa de archivos

| Archivo | Rol |
|---|---|
| `index.html` | app completa (UI, motor financiero, persistencia, CSP) |
| `sw.js` | service worker offline |
| `privacidad.html` | politica de privacidad publicada |
| `manifest.webmanifest`, `icono-*.png`, `maskable-512.png`, `apple-180.png`, `favicon-64.png` | PWA |
| `tests/*.test.js` | ~60 archivos por loop/tema (r4, r5, l1-l8, n2-n7, s2-s5, motor, seguridad) |
| `tests/e2e/run.mjs` | E2E headless sin dependencias |
| `odd/tasks/` | features ODD y contratos de diseno |

## Arquitectura

No hay `graphify-out/`. Para preguntas de arquitectura, proponer `/graphify` en esta carpeta
antes de leer `index.html` a mano (es un archivo monolitico grande). Contrato del modelo
financiero aprobado: `odd/tasks/repair-sprint-1-r4-design.md` (Q1-Q15, fuente de verdad R4).

## Features ODD

| Documento | Estado |
|---|---|
| `estado-pago-totales.md` (Sprint 0) | cerrada |
| `repair-sprint-1.md` | 10/10 cerradas; R3 cerrado, R4 disenado |
| `repair-sprint-1-r4-design.md` | contrato aprobado 2026-10-05 |
| `repair-sprint-1-r4.5-matrix.md` | matriz de aceptacion D16 |
| `stabilization-quick-sales.md` | 10/10 cerradas; tabla S1 resuelta en 1.34.0 |
| `owner-decisions-closure.md` | D0-D9 hechas (v1.34.0, rama `feat/owner-decisions`); revision nativa no aplicable (`lens_context_budget_exceeded`), auditoria independiente cerrada en D9; follow-up A10. Luego 1.34.1: marca del encabezado "TuGasto" en lugar de "TG" (`0fd5f46`) |
| `alpha-product-surface.md` | L1-L10 hechas (v1.33.0, veredicto ALPHA_READY); P1-P12 reconciliada; abierta solo P11 (GitHub bloqueado: cuenta equivocada en esta PC) |

## Estado git, gentle-ai y graphify

- Rama actual: `feat/owner-decisions` (desde `fix/repair-sprint-1` dd6a132). Ultimo cambio: release 1.34.1 (marca TuGasto, 2026-10-29). Carpetas de version: v1.33.0, v1.34.0, v1.34.1.
- Sin remoto: GitHub bloqueado (cuenta equivocada en esta PC); las versiones quedan locales.
- RDD: `on (decided by default)`; global y clone-local sin definir.
- `.atl/skill-registry.md`: **no existe**. Proponer `gentle-ai skill-registry refresh`.
- `graphify-out/`: **no existe**. Proponer `/graphify`.

## Riesgos y huecos conocidos

- Datos financieros reales del usuario en `localStorage`: todo cambio del motor debe pasar
  los goldens y las pruebas de migracion (`r4.migracion`, `n4.integridad`).
- Cambio visible para instalados exige subir la version de cache en `sw.js`.
- Si cambia `privacidad.html`, actualizar la fecha al inicio del archivo (`LEEME.md`).
- Remoto de GitHub y push requieren destino explicito del usuario.

## Pistas para el proximo paso

1. Revision nativa del rango de `owner-decisions-closure` (dd6a132..HEAD).
2. 1.34.1 entregada en local (sin GitHub).
