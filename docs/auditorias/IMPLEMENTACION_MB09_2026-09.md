# MB-09 — geovisor, cartografía y accesibilidad espacial

**Fecha:** 8 de septiembre de 2026  
**Rama:** `fix/mb09-geovisor-cartography-accessibility`  
**Base funcional:** `main`  
**Estado:** **CERRADO** — implementación técnica completa, validación visual del usuario aprobada, PR #15 fusionado y GitHub Pages verificado.

## Alcance

MB-09 cierra el bloque cartográfico reservado para el final de la ruta de mejoras. Se intervienen interacción, leyendas, responsive, accesibilidad espacial, fallback básico y estados de la dependencia remota IDEAM. No se alteran geometrías fuente, el archivo PMTiles contextual, relaciones espaciales precomputadas, conteos analíticos ni el contrato de fichas territoriales por shards.

## Línea base MB-09A

El diagnóstico previo se ejecutó en Chrome headless con WebGL2 vía ANGLE/Vulkan SwiftShader. MapLibre creó correctamente su canvas y cargó sus assets locales. La medición objetiva del panel de capas mostró aproximadamente **19,16 %** de oclusión del geovisor en escritorio y **49,97 %** a 390 px de ancho.

El VectorTileServer de coberturas IDEAM respondió 6/6 solicitudes HTTP 200 desde GitHub Actions, con tiempos totales de **3,11 a 5,49 s** y media de **4,14 s**. Esa medición es diagnóstica y no representa por sí sola la latencia de todos los usuarios.

## Cambios implementados

### Consulta espacial y superposiciones

- `Detección` pasa a ser un modo de consulta explícito junto con `Territorio`, `Cobertura` y `Contexto`.
- Toda consulta del canvas se enruta por el modo elegido; una detección ya no intercepta una consulta explícita de cobertura o contexto.
- Contexto consulta todas las entidades renderizadas en el punto, deduplica representaciones fill/line de una misma entidad y presenta un selector cuando existen varias coincidencias.
- La ficha completa por `detail_key` continúa cargándose de forma perezosa desde el shard correspondiente.

Esto atiende `MAP-001`, `MAP-003` y `MAP-004`.

### Lectura cartográfica

- Se añade leyenda de clusters: los umbrales visuales representan cantidad de detecciones agrupadas y se aclara expresamente que no representan intensidad ni severidad de incendio.
- La simbología puntual ANLA adopta la misma distinción por `situacion` que polígonos y líneas; la leyenda diferencia `En evaluación` y `Licenciado`.
- El Mapa básico deja de prometer fichas que no ofrece. Su copy explica que allí las detecciones son referencia visual y que las fichas de detección, cobertura y contexto requieren el Geovisor.
- A escala nacional y con alta densidad, el Mapa básico realiza una agregación visual en cuadrícula. Esta generalización no modifica el conjunto filtrado ni los conteos analíticos.

Esto atiende `MAP-002`, `CART-001`, `CART-002` y `CART-003`.

### Accesibilidad espacial y responsive

- Los territorios SVG del Mapa básico son enfocables y seleccionables con `Enter` o barra espaciadora.
- El Geovisor incorpora `Consultar centro del mapa`: el usuario puede desplazar el mapa, elegir el modo de consulta y ejecutar la consulta sin depender de un clic preciso sobre el canvas.
- Se publica feedback mediante región `aria-live`.
- Los controles MapLibre aumentan su área de interacción y alcanzan 44×44 px en móvil.
- El panel de capas es colapsable y arranca colapsado en pantallas de hasta 640 px, evitando que el panel completo cubra aproximadamente la mitad del mapa como ocurría en la línea base de 390 px.
- El panel abierto usa scroll interno para no desbordar la superficie cartográfica.

Esto atiende `A11Y-001`, el residual cartográfico de `A11Y-004` y `RESP-001`.

### Dependencia remota IDEAM

La cobertura IDEAM ahora distingue estados `loading`, `ready` y `error`. La consulta informa si las teselas siguen cargando o si el servicio no está disponible, en lugar de confundir esos estados con una ausencia real de cobertura en el punto.

Esto atiende el riesgo documentado como `PERF-002` sin replicar ni modificar la fuente oficial.

## Gates automáticos

Además del E2E general existente, MB-09 incorpora `scripts/check-geovisor-webgl-e2e.mjs`, ejecutado por `npm run test:e2e` tanto en CI de pull request como antes del despliegue de GitHub Pages.

El gate cartográfico usa Chrome real con WebGL2 por SwiftShader y exige, entre otros contratos:

- creación del canvas MapLibre;
- `Detección` como modo inicial;
- disponibilidad de `Consultar centro del mapa`;
- tamaño mínimo de controles cartográficos;
- panel móvil colapsado a 390 px;
- oclusión del panel colapsado inferior al 15 % de la superficie del geovisor;
- reapertura del panel móvil;
- territorios enfocables en Mapa básico;
- superposición cero del panel con escala y atribución en los escenarios finales de prueba.

## Cierre ejecutado

- revisión visual automatizada y WebGL2 completada;
- capturas finales inspeccionadas;
- aprobación visual del usuario recibida el 8 de septiembre de 2026;
- PR #15 fusionado por squash en `9c8f4389647411862d994427b0d694d7a2c31102`;
- GitHub Pages run `34260487411` completado con `build=success` y `deploy=success`;
- cierre documental posterior registrado mediante PR #16.

La matriz global y los residuales aceptados de la auditoría se consolidan en `CIERRE_AUDITORIA_INTEGRAL_2026-09.md`.
