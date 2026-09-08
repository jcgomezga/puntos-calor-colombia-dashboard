# Implementación MB-04 — rendimiento inicial y estabilidad de gráficos

**Fecha:** 8 de septiembre de 2026  
**Bloque:** MB-04 — rendimiento inicial y estabilidad frontend.  
**Hallazgos atendidos:** `PERF-001`, `TECH-001`.  
**Alcance:** reducir el JavaScript requerido para la carga inicial pública y eliminar el warning determinista de dimensiones negativas de Recharts. No modifica geometrías, filtros, conteos, relaciones espaciales, prioridad de clic, simbología ni comportamiento MapLibre.

## 1. Diagnóstico de partida

La auditoría integral registró `PERF-001` como S2: el mayor chunk JavaScript inicial pesaba aproximadamente **6,88 MB decodificado / 1,90 MB gzip**. También registró `TECH-001`: durante prerender, Recharts resolvía temporalmente `width(-1)` y `height(-1)` en sus contenedores responsivos.

El origen estructural del peso inicial era verificable en `app/page.tsx`: el componente cliente importaba estáticamente `dashboard.json`, `history.json`, `departments.json` y `municipalities.json`, además de incorporar el geovisor MapLibre al grafo inicial. `components/geovisor-entry.tsx` volvía a importar `dashboard.json` únicamente para construir diccionarios de nombres territoriales.

## 2. Decisión de arquitectura

Se aplicó una separación entre **código inicial**, **datos públicos de runtime** y **módulo cartográfico diferido**:

1. `dashboard.json`, `history.json`, `departments.json` y `municipalities.json` dejan de ser imports JavaScript y se solicitan desde `/data/` mediante `fetch`.
2. Los datos que cambian con la actualización operativa (`dashboard.json`, `history.json`) usan `cache: "no-cache"`; las geometrías DANE publicadas como recursos estáticos (`departments.json`, `municipalities.json`) usan `cache: "force-cache"`.
3. Mientras se descargan los recursos se conserva una shell estática informativa con título, alcance metodológico e histórico, en vez de entregar una pantalla vacía.
4. El geovisor se carga mediante `next/dynamic(..., { ssr: false })`, por lo que MapLibre queda fuera del conjunto de scripts referenciados directamente por el HTML inicial.
5. Los diccionarios departamento/municipio se construyen una sola vez con los catálogos ya cargados y se pasan al geovisor. Se elimina el segundo import de `dashboard.json` desde `geovisor-entry.tsx`.
6. Los dos `ResponsiveContainer` de Recharts reciben `initialDimension={{ width: 600, height: 240 }}` para evitar el estado inicial `-1 × -1` durante prerender.

## 3. Medición comparable antes/después

Para no cerrar `PERF-001` basándonos únicamente en el warning genérico del bundler, se añadió `scripts/report-pages-js.mjs`. El script lee `out/index.html`, identifica exactamente los scripts JavaScript que la página pública solicita de inicio, resuelve sus archivos del export de Pages y calcula tamaño decodificado y gzip con el mismo procedimiento para la comparación.

Como línea base se extrajo el artefacto `github-pages` del despliegue de MB-03, run **34233205598**, commit `d98379d3139d6bcc710b580afd3e7af729d5ec90`, y se aplicó el mismo cálculo. El candidato MB-04 se midió en CI, run **34236165330**, commit `417dfbdd87fd6bcc81ee48422b2b966577ac4264`.

| Métrica de JavaScript inicial | MB-03 / antes | MB-04 | Reducción |
|---|---:|---:|---:|
| Scripts iniciales | 9 | 9 | — |
| Total decodificado | 7.455.055 B | 967.005 B | **87,0 %** |
| Total gzip | 2.022.381 B | 290.727 B | **85,6 %** |
| Mayor script decodificado | 6.879.997 B | 390.744 B | **94,3 %** |
| Mayor script gzip | 1.845.653 B | 113.126 B | **93,9 %** |

La cifra de línea base reproduce de forma consistente el orden de magnitud de la auditoría original (≈1,90 MB gzip para el chunk dominante). La medición nueva es incluso más estricta para la carga: suma **todos** los scripts referenciados por el HTML inicial y obtiene 290.727 B gzip.

## 4. Presupuesto bloqueante

La CI ya no se limita a informar el tamaño. Se fija un presupuesto de **500.000 bytes gzip para la suma completa del JavaScript inicial** de `out/index.html`.

El candidato actual usa 290.727 B, es decir, aproximadamente **58 % del presupuesto**. Si una modificación futura vuelve a introducir datasets grandes o dependencias pesadas en el grafo inicial y supera ese límite, la CI falla antes de integrar.

El export contiene además dos scripts diferidos no referenciados directamente por el HTML inicial. El mayor pesa **1.031.581 B decodificado / 277.562 B gzip**. Por definición no forma parte de la carga JavaScript inicial medida por `PERF-001`. El warning de Vite sobre algún chunk minificado superior a 500 kB permanece como señal de optimización diferida, pero ya no describe el problema auditado del chunk inicial y no se oculta ni se desactiva.

## 5. Cierre de TECH-001

En los builds anteriores aparecía repetidamente:

`The width(-1) and height(-1) of chart should be greater than 0`

Tras establecer dimensiones iniciales válidas en ambos `ResponsiveContainer`, el run final de validación **34236165330** completó tanto el prerender Vite/Vinext como el export estático Next.js **sin emitir ese warning**. Se mantiene el comportamiento responsivo después de la hidratación porque `ResponsiveContainer` conserva `width="100%"` y `height="100%"`.

## 6. Pruebas y controles añadidos

`tests/performance-contract.test.mjs` fija por regresión que:

- los cuatro JSON grandes no vuelvan a importarse desde `@/public/data/...` al módulo cliente inicial;
- los datos operativos y geometrías se carguen desde sus rutas públicas con la política de caché definida;
- MapLibre continúe como import dinámico client-only;
- `geovisor-entry.tsx` no vuelva a importar `dashboard.json`;
- ambos gráficos conserven dimensiones iniciales válidas;
- exista una shell estática informativa durante la carga.

La CI incorpora además `node scripts/report-pages-js.mjs` después de `npm run build:pages`, por lo que el presupuesto se evalúa sobre el mismo export que se publicaría en GitHub Pages.

## 7. Validación del candidato

Run **34236165330**:

- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades**;
- lint: correcto;
- build Vite/Vinext: correcto;
- suite web: **42/42 pruebas, 0 fallos**;
- export Next.js 16.3.4: correcto;
- warning Recharts `-1 × -1`: **ausente**;
- JavaScript inicial: **290.727 B gzip**, dentro del gate de 500.000 B;
- catálogo territorial: **22.952 fichas**, **439 shards**, máximo **82.273 B**;
- activos MapLibre y shards publicables: verificados.

## 8. Elementos expresamente no modificados

- prioridad de clic entre detecciones y capas de consulta;
- selección entre geometrías contextuales superpuestas;
- clusters, zoom, paneo, popups o controles MapLibre;
- estilos y simbología cartográfica;
- PMTiles y geometrías DANE/RUNAP/ANM/ANLA/ANH;
- filtros, universo operativo, conteos o reglas espaciales;
- tratamiento metodológico de detecciones térmicas.

Los hallazgos MapLibre/cartográficos permanecen reservados para el bloque final con revisión visual del usuario. La ausencia de E2E reales, pendiente residual de `QA-001`, tampoco se declara resuelta por MB-04.

## 9. Criterio de cierre

`PERF-001` puede cerrarse porque el problema confirmado del JavaScript inicial se redujo de 2.022.381 B gzip totales en la línea base reproducida a 290.727 B gzip y quedó protegido por un gate bloqueante. `TECH-001` puede cerrarse porque el warning determinista de Recharts desapareció en ambos caminos de build y queda cubierto por prueba de regresión.
