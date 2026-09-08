# MB-09A — diagnóstico técnico del geovisor, cartografía y accesibilidad espacial

**Fecha:** 8 de septiembre de 2026  
**Rama:** `audit/mb09a-cartography-diagnosis`  
**Base:** `main` @ `93d4948ecf99767d801ef591e9f1384fb4a794fa`  
**Objetivo:** reproducir y localizar técnicamente los hallazgos cartográficos pendientes antes de modificar la experiencia MapLibre.

## Regla de esta etapa

MB-09A es **diagnóstico**. No cambia geometrías, fuentes, PMTiles, orden de capas, clustering, estilos, popups, prioridades de clic, responsive ni controles del geovisor. Las correcciones se diseñarán después de cerrar esta matriz y de intentar una ejecución real de MapLibre/WebGL2 en CI.

## Hallazgos pendientes y causa técnica actual

| ID | Estado en `main` actual | Evidencia/cause técnica | Hipótesis de corrección para MB-09B | Validación visual posterior |
|---|---|---|---|---|
| `MAP-001` | **Confirmado** | Existen handlers específicos para `hotspot-clusters` y `hotspot-unclustered` que actúan sin consultar `queryMode`. El handler general, además, consulta hotspots primero y retorna antes de Cobertura/Contexto/Territorio. | Unificar o condicionar la prioridad de clic al modo de consulta. En modo Contexto/Cobertura/Territorio, una detección visible no debe interceptar la intención explícita del usuario. | Clic sobre una detección que coincida con cobertura y con una capa contextual; comprobar qué ficha gana en cada modo. |
| `MAP-002` | **Confirmado** | `DashboardMap` solo hace interactivos los polígonos territoriales SVG. El canvas de detecciones tiene `pointer-events: none` y `aria-hidden`. El caption común sigue prometiendo clic en detección, territorio, cobertura o contexto también cuando se usa Mapa básico. | Copy dependiente del modo y/o una alternativa funcional explícita; no fingir equivalencia con MapLibre. | Abrir Mapa básico y comprobar que instrucciones y affordances coinciden con sus capacidades reales. |
| `MAP-003` | **Confirmado** | En modo Contexto se usa `queryRenderedFeatures(...)[0]`. Cualquier segunda geometría coincidente se descarta silenciosamente. | Deduplicar por entidad/capa y presentar coincidencias múltiples o un selector explícito. | Punto de prueba con al menos dos entidades coincidentes; verificar lista/selector y ficha elegida. |
| `MAP-004` | **Confirmado por diseño actual** | El popup contextual es singular y no informa cuántas entidades/capas coincidieron ni qué criterio decidió la entidad mostrada. | Mostrar número/tipo de coincidencias y hacer la selección trazable. | Repetir clic en superposición y comprobar que el usuario entiende qué entidad está consultando y qué alternativas existen. |
| `CART-001` | **Confirmado** | Los clusters codifican tamaño/color por `point_count` (umbrales 100 y 1.000; radios 15/20/26), pero la UI no contiene una leyenda para esa codificación. | Añadir leyenda breve que explique número, tamaño y que el cluster representa conteo de detecciones, no intensidad del incendio. | Vista nacional y zoom intermedio con clusters de distintos tamaños. |
| `CART-002` | **Confirmado** | El Mapa básico dibuja cada detección del conjunto filtrado una por una. A escala nacional solo reduce alpha cuando hay >8.000 puntos; no agrega ni generaliza. | Generalización/densidad o muestreo visual controlado únicamente para el fallback, preservando los conteos analíticos. | Vista nacional del Mapa básico y comparación con geovisor; comprobar legibilidad sin inducir pérdida de datos. |
| `CART-003` | **Confirmado** | ANLA usa colores distintos por `situacion` en polígonos/líneas, pero el control solo muestra un swatch degradado sin explicar `En evaluación` frente a `Licenciado`; los puntos ANLA usan un único azul. | Leyenda ANLA explícita y coherencia entre geometría, situación y simbología. | Activar ANLA donde existan geometrías de ambas situaciones y revisar correspondencia leyenda-mapa-popup. |
| `A11Y-001` | **Confirmado** | En Mapa básico, los `<path>` tienen `onClick` pero no son enfocables ni tienen operación por teclado. En MapLibre la consulta espacial depende del clic sobre canvas; no existe una alternativa equivalente accesible para seleccionar una entidad geográfica. | Definir operación equivalente: controles/resultado accesible por teclado y/o lista de entidades consultables; conservar navegación cartográfica como mejora visual, no como única vía. | Recorrido completo solo con teclado y lector de accesibilidad/inspector semántico. |
| `A11Y-004` residual cartográfico | **Confirmado** | Los botones nativos de navegación MapLibre siguen en 29×29 px y las filas del panel de capas tienen mínimo 25 px. MB-05 dejó este residual deliberadamente para MB-09. | Llevar targets cartográficos hacia 44×44 px sin ocluir el mapa; revisar checkboxes, consulta y panel móvil. | Desktop táctil/tablet/móvil. |
| `RESP-001` cartográfico | **Pendiente de prueba real** | Bajo 640 px, `.map-surface` queda en 450 px de alto y `.layer-control` permanece absoluto con 185 px de ancho. No existe todavía una prueba de oclusión interna de canvas/popup/panel. | Diseñar panel adaptable/colapsable solo después de medir la oclusión real. | 390 px y 320 px; capas, popup, atribución, zoom y controles sin superposición crítica. |
| `PERF-002` | **Hipótesis aún no cerrada** | La cobertura IDEAM depende del VectorTileServer externo. `ready` se activa tras crear las capas, no cuando las teselas de cobertura están visibles. Existe mensaje de error, pero no un estado específico de latencia de cobertura. | Medir varias solicitudes y, si la dependencia domina la espera, distinguir `cargando/no disponible` de una cobertura realmente vacía. | Activación/desactivación de cobertura bajo red lenta o fallo simulado. |

## Observaciones adicionales relevantes

1. `clusterMaxZoom` continúa en 9 y `clusterRadius` en 42; no se propone cambiarlos sin validación visual.
2. Los colores actuales de detecciones conservan prioridad visual sobre el fondo, pero cualquier ajuste se decidirá con capturas reales.
3. Las capas territoriales y contextuales siguen siendo opcionales y el modo Contexto se activa automáticamente al encender RUNAP/ANM/ANLA/ANH.
4. La ficha completa de contexto continúa cargándose por shard a partir de `detail_key`; MB-09 no debe romper ese contrato.
5. El mensaje de error del servicio IDEAM/PMTiles es global al geovisor. Debe comprobarse si una incidencia parcial queda presentada con la granularidad adecuada.

## Siguiente prueba de MB-09A

Se incorporará un **probe temporal de WebGL2/MapLibre en GitHub Actions** usando Chrome headless con SwiftShader. Su finalidad es responder, antes de tocar el mapa, a cuatro preguntas:

1. ¿El runner puede crear un contexto WebGL2 por software?
2. ¿MapLibre crea su canvas y supera el fallback `Este navegador no ofrece WebGL2`?
3. ¿Se observan solicitudes reales a worker, PMTiles y VectorTileServer IDEAM?
4. ¿Podemos reutilizar ese entorno para pruebas cartográficas deterministas en MB-09B?

El probe es instrumentación de diagnóstico de la rama; no forma parte todavía del producto público.