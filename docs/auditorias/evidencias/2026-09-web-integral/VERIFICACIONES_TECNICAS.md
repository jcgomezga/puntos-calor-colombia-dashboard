# Verificaciones técnicas reproducibles

## Identidad del despliegue

- Commit auditado: `6e1f8319e2c40aed6532f1c7a0a60a69644648f1`.
- Ejecución de GitHub Pages: `34188428627`, finalizada correctamente el 8 de septiembre de 2026 a las 04:51:45 UTC.
- La ejecución de actualización de datos previa (`34188028080`) también terminó correctamente.

## Validación local

- `npm ci`: correcto.
- `npm run lint`: correcto.
- `npm run build:pages`: correcto; emitió dos advertencias de Recharts por `width(-1)` y `height(-1)` durante el prerender.
- `npm test`: 28 de 28 pruebas correctas.
- Node.js `v24.19.0`; npm `11.9.0`; Python `3.12.13`.

## Red y recursos

| Recurso | Resultado |
|---|---:|
| HTML inicial | 28.568 bytes decodificados |
| Mayor chunk JavaScript | 6.875.220 bytes decodificados; 1.898.026 bytes comprimidos |
| `dashboard.json` | 2.933.081 bytes decodificados; 678.689 bytes comprimidos |
| `context-layers.pmtiles` | 60.668.987 bytes |
| Solicitud Range PMTiles 0–16383 | HTTP 206 y `Content-Range` correcto |
| Tile IDEAM de muestra | HTTP 200, CORS `*`, 403.291 bytes; 14,99 s en una sola medición |
| `/puntos-calor-colombia-dashboard/docs/` | HTTP 404 |
| `/favicon.svg` en raíz del dominio | HTTP 404 |
| favicon dentro del `basePath` | HTTP 200 |

La duración de una petición aislada en infraestructura compartida no debe tratarse como un benchmark universal. Se conserva como señal de dependencia externa y no como SLA.

## Dependencias

`npm audit --omit=dev` reportó cinco paquetes de producción con severidad alta: `next` (directo), y las dependencias transitivas `fast-uri`, `nanoid`, `postcss` y `sharp`. El despliegue observado es una exportación estática, por lo que varias rutas de explotación del servidor Next no están presentes en GitHub Pages; el resultado sigue requiriendo evaluación y actualización controlada.

## Comprobaciones independientes de datos

| Comprobación | Resultado |
|---|---:|
| Filas compactas totales | 33.788 |
| Universo público (`point[7] === 1`) | 23.542 |
| Filas fuera del universo público | 10.246 |
| Departamentos con detecciones | 32 |
| Municipios con detecciones | 692 |
| Fuentes con detecciones públicas | 4 |
| Fechas | 69, del 2026-07-01 al 2026-09-07 |
| Detecciones del 2026-09-07 | 199 |
| RUNAP dentro / fuera | 1.511 / 22.031 |
| ANM dentro / fuera | 4.294 / 19.248 |
| ANLA dentro / 0–1 / 1–5 / >5 km | 5.114 / 2.524 / 5.320 / 10.584 |
| ANH dentro / 0–1 / 1–5 / >5 km | 5.315 / 733 / 2.443 / 15.051 |
| Cobertura familias 1/2/3/4/5 | 1.316 / 10.305 / 10.436 / 1.227 / 233 |
| Sin asignación departamental/municipal | 22 |
| Sin familia de cobertura | 25 |
| FRP ausente | 441 |
| Longitud inválida de `PointRow` | 0 |
| Coordenadas inválidas | 0 |
| Minutos inválidos | 0 |

En los detalles de contexto se observaron 9.844 fechas ANLA en milisegundos Unix de 12/13 dígitos, 453 de 455 fechas de firma ANH en el mismo formato y 7.066 valores de `estado` ANM con apariencia de fecha/hora. El frontend presenta esos valores sin normalización adicional.

## Limitación principal del entorno

El Chromium remoto usado para la interacción tuvo viewport fijo de 1.348 × 936 px y no expuso WebGL2. La aplicación mostró correctamente su fallback. Por ello no se adjudicaron como fallos del producto las pruebas de zoom, paneo, clusters, clics en geometrías ni popups MapLibre que no pudieron ejecutarse en vivo. Se revisaron sus rutas de código y datos, pero se mantienen como pendientes de validación en un navegador con GPU/WebGL2.
