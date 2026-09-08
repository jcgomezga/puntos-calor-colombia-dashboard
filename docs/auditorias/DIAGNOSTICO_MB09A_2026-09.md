# MB-09A — diagnóstico técnico del geovisor, cartografía y accesibilidad espacial

**Fecha:** 8 de septiembre de 2026  
**Rama:** `audit/mb09a-cartography-diagnosis`  
**Base:** `main` @ `93d4948ecf99767d801ef591e9f1384fb4a794fa`  
**Objetivo:** reproducir y localizar técnicamente los hallazgos cartográficos pendientes antes de modificar la experiencia MapLibre.

## Regla de esta etapa

MB-09A es **diagnóstico**. No cambia geometrías, fuentes, PMTiles, orden de capas, clustering, estilos, popups, prioridades de clic, responsive ni controles del geovisor. Las correcciones se diseñan para MB-09B sobre una rama separada.

## Hallazgos pendientes y causa técnica actual

| ID | Estado en `main` actual | Evidencia/causa técnica | Hipótesis de corrección para MB-09B | Validación visual posterior |
|---|---|---|---|---|
| `MAP-001` | **Confirmado** | Existen handlers específicos para `hotspot-clusters` y `hotspot-unclustered` que actúan sin consultar `queryMode`. El handler general, además, consulta hotspots primero y retorna antes de Cobertura/Contexto/Territorio. | Unificar o condicionar la prioridad de clic al modo de consulta. En modo Contexto/Cobertura/Territorio, una detección visible no debe interceptar la intención explícita del usuario. | Clic sobre una detección que coincida con cobertura y con una capa contextual; comprobar qué ficha gana en cada modo. |
| `MAP-002` | **Confirmado** | `DashboardMap` solo hace interactivos los polígonos territoriales SVG. El canvas de detecciones tiene `pointer-events: none` y `aria-hidden`. El caption común sigue prometiendo clic en detección, territorio, cobertura o contexto también cuando se usa Mapa básico. | Copy dependiente del modo y/o una alternativa funcional explícita; no fingir equivalencia con MapLibre. | Abrir Mapa básico y comprobar que instrucciones y affordances coinciden con sus capacidades reales. |
| `MAP-003` | **Confirmado** | En modo Contexto se usa `queryRenderedFeatures(...)[0]`. Cualquier segunda geometría coincidente se descarta silenciosamente. | Deduplicar por entidad/capa y presentar coincidencias múltiples o un selector explícito. | Punto de prueba con al menos dos entidades coincidentes; verificar lista/selector y ficha elegida. |
| `MAP-004` | **Confirmado por diseño actual** | El popup contextual es singular y no informa cuántas entidades/capas coincidieron ni qué criterio decidió la entidad mostrada. | Mostrar número/tipo de coincidencias y hacer la selección trazable. | Repetir clic en superposición y comprobar que el usuario entiende qué entidad está consultando y qué alternativas existen. |
| `CART-001` | **Confirmado también visualmente** | Los clusters codifican tamaño/color por `point_count` (umbrales 100 y 1.000; radios 15/20/26), pero la UI no contiene una leyenda para esa codificación. La captura WebGL2 nacional muestra simultáneamente clusters como `18`, `282`, `1.1k`, `2.4k`, `3.1k`, `4.5k` y `6.9k` sin explicación de tamaño/color. | Añadir leyenda breve que explique número, tamaño y que el cluster representa conteo de detecciones, no intensidad del incendio. | Vista nacional y zoom intermedio con clusters de distintos tamaños. |
| `CART-002` | **Confirmado por implementación** | El Mapa básico dibuja cada detección del conjunto filtrado una por una. A escala nacional solo reduce alpha cuando hay >8.000 puntos; no agrega ni generaliza. | Generalización/densidad o muestreo visual controlado únicamente para el fallback, preservando los conteos analíticos. | Vista nacional del Mapa básico y comparación con geovisor; comprobar legibilidad sin inducir pérdida de datos. |
| `CART-003` | **Confirmado** | ANLA usa colores distintos por `situacion` en polígonos/líneas, pero el control solo muestra un swatch degradado sin explicar `En evaluación` frente a `Licenciado`; los puntos ANLA usan un único azul. | Leyenda ANLA explícita y coherencia entre geometría, situación y simbología. | Activar ANLA donde existan geometrías de ambas situaciones y revisar correspondencia leyenda-mapa-popup. |
| `A11Y-001` | **Confirmado** | En Mapa básico, los `<path>` tienen `onClick` pero no son enfocables ni tienen operación por teclado. En MapLibre la consulta espacial depende del clic sobre canvas; no existe una alternativa equivalente accesible para seleccionar una entidad geográfica. | Definir operación equivalente: controles/resultado accesible por teclado y/o lista de entidades consultables; conservar navegación cartográfica como mejora visual, no como única vía. | Recorrido completo solo con teclado y lector de accesibilidad/inspector semántico. |
| `A11Y-004` residual cartográfico | **Confirmado** | Los botones nativos de navegación MapLibre siguen en 29×29 px y las filas del panel de capas tienen mínimo 25 px. MB-05 dejó este residual deliberadamente para MB-09. | Llevar targets cartográficos hacia 44×44 px sin ocluir el mapa; revisar checkboxes, consulta y panel móvil. | Desktop táctil/tablet/móvil. |
| `RESP-001` cartográfico | **Confirmado con WebGL2 real por software** | A 390×844, el canvas visible mide 342×400 px y el panel de capas 185×373,5 px. El panel ocupa aproximadamente **49,97 % del área del geovisor**; la captura confirma que tapa prácticamente la mitad derecha del mapa. La atribución ocupa además 342×64 px en la franja inferior. | Convertir el panel de capas en control colapsable/expandible en móvil; revisar posición de atribución, escala y navegación, preservando acceso a todas las capas. | 390 px y 320 px; capas, popup, atribución, zoom y controles sin superposición crítica. |
| `PERF-002` | **Riesgo externo confirmado; magnitud dependiente de red** | La cobertura IDEAM depende del VectorTileServer externo. Un sondeo desde GitHub Actions a tres teselas sobre Colombia, dos intentos por zoom (z5-z7), obtuvo 6/6 respuestas HTTP 200 pero con **1,07–2,56 s hasta primer byte** y **3,11–5,49 s hasta completar**, media 4,14 s. Las respuestas observadas fueron de 2,57–3,49 MB. Esto confirma que el servicio puede introducir espera material, aunque no representa la latencia de todos los usuarios. | Distinguir estado `cargando cobertura` / `cobertura no disponible` de un mapa realmente vacío; evitar bloquear la disponibilidad de detecciones y capas locales por la cobertura IDEAM; mantener caché/uso progresivo. | Red normal, throttling y fallo simulado del servicio IDEAM. |

## Prueba WebGL2/MapLibre en GitHub Actions

Se creó instrumentación temporal de diagnóstico con Chrome headless y SwiftShader, sin modificar la aplicación pública. El resultado cambia una limitación importante de la auditoría original: aunque el entorno interactivo del asistente no ofrece WebGL2, **el runner de GitHub Actions sí puede renderizar MapLibre mediante WebGL2 por software y generar capturas reproducibles**.

### Evidencia principal

Ejecución `34253939647` sobre `3bb78be66b432cbaa4a8dbc6776cb2ba2c848554`: **success**.

El contexto gráfico reportó:

- WebGL 2.0 / OpenGL ES 3.0 Chromium;
- ANGLE sobre Vulkan;
- renderer SwiftShader Device (Subzero);
- un canvas MapLibre efectivo;
- ningún mensaje `.geovisor-error` durante la prueba;
- PMTiles locales respondieron correctamente con HTTP 206/range requests.

La ejecución inmediatamente anterior sobre el mismo probe visual (`34253375605`) tuvo un arranque transitorio de Chrome sin DevTools Protocol en un runner y pasó al reejecutar el job. Esto se trata como inestabilidad del harness diagnóstico, no como defecto del dashboard. Si el probe se convierte en gate permanente durante MB-09B, deberá incorporar reintento de arranque antes de bloquear CI.

### Observación visual — escritorio

La captura 1440×900 muestra el geovisor renderizado con cobertura IDEAM, límites territoriales, etiquetas y clusters. El panel de capas ocupa aproximadamente **19,16 %** del área del geovisor; es invasivo pero todavía deja una superficie cartográfica amplia.

La cobertura nacional posee una carga visual alta por su simbología multicolor y por la densidad de información. No se modifica todavía: MB-09B debe preservar su valor analítico y evaluar si la opacidad/jerarquía necesita un ajuste conservador.

La ausencia de leyenda de clusters es visible: el usuario observa círculos de tamaños y colores distintos con conteos abreviados, pero no existe una explicación de qué codifican tamaño/color ni de que el número es conteo de detecciones.

### Observación visual — capas de contexto

Con RUNAP, ANM, ANLA y ANH activadas simultáneamente, MapLibre continúa estable y los PMTiles cargan. Se observan polígonos contextuales extensos, incluidos bloques alejados de la masa continental. MB-09A **no los clasifica como error geométrico**: pueden corresponder a áreas válidas terrestres/marinas de las fuentes oficiales. Cualquier cambio requeriría trazabilidad contra la entidad de origen.

La UI no ofrece una leyenda suficiente para interpretar la semántica ANLA por situación, lo que refuerza `CART-003`.

### Observación visual — móvil 390 px

La captura móvil confirma el problema responsive: el panel permanece abierto de forma permanente y cubre casi media superficie cartográfica. Además compite espacialmente con navegación, escala y atribución. El mapa sigue técnicamente renderizado, pero el área disponible para inspección directa queda excesivamente reducida.

Por tanto, `RESP-001` deja de ser una hipótesis basada solo en CSS y se considera **reproducido**.

## Medición directa del servicio IDEAM

El VectorTileServer no aparece en el `Network` de la página porque las solicitudes de teselas se ejecutan desde el worker de MapLibre; la captura demuestra, sin embargo, que la cobertura sí se pinta. Para medir la dependencia externa de forma reproducible se añadió un sondeo HTTP separado al mismo endpoint publicado.

Run `34253939647`, centro aproximado `-73.5, 4.5`, zooms 5, 6 y 7, dos solicitudes por zoom:

| Métrica | Resultado |
|---|---:|
| Respuestas correctas | 6/6 HTTP 200 |
| Primer byte mínimo | 1.069,5 ms |
| Primer byte máximo | 2.560,3 ms |
| Tiempo total mínimo | 3.114,3 ms |
| Tiempo total máximo | 5.493,6 ms |
| Tiempo total medio | 4.143,3 ms |
| Tamaño observado por respuesta | 2.568.205–3.487.658 bytes |
| Cache-Control | `max-age=86400` |

La interpretación es deliberadamente limitada: son tiempos desde infraestructura de GitHub Actions y no un benchmark representativo de Colombia ni de cada usuario. Sí son suficientes para confirmar que la dependencia remota puede aportar varios segundos y que la interfaz necesita un estado de carga/fallo granular para la cobertura.

## Observaciones adicionales relevantes

1. `clusterMaxZoom` continúa en 9 y `clusterRadius` en 42; no se propone cambiarlos sin comparar capturas antes/después.
2. Los colores actuales de detecciones conservan prioridad visual sobre el fondo; cualquier ajuste debe verificarse contra cobertura y capas de contexto activas.
3. Las capas territoriales y contextuales siguen siendo opcionales y el modo Contexto se activa automáticamente al encender RUNAP/ANM/ANLA/ANH.
4. La ficha completa de contexto continúa cargándose por shard a partir de `detail_key`; MB-09 no debe romper ese contrato.
5. El mensaje de error del servicio IDEAM/PMTiles es global al geovisor. MB-09B debe separar al menos la indisponibilidad de cobertura externa de la disponibilidad de capas/detecciones locales.

## Conclusión MB-09A y diseño de MB-09B

El diagnóstico técnico ya es suficiente para empezar la implementación sin hacerlo a ciegas. La estrategia propuesta para MB-09B es:

1. **Interacción primero:** corregir `MAP-001`, `MAP-003` y `MAP-004` con prioridad de clic dependiente del modo y selección explícita de coincidencias múltiples.
2. **Semántica/cartografía:** corregir `MAP-002`, `CART-001` y `CART-003` con copy específico por modo y leyendas interpretables, sin cambiar geometrías de origen.
3. **Accesibilidad espacial:** resolver `A11Y-001` y el residual `A11Y-004` mediante una vía equivalente de consulta por teclado/lista y targets cartográficos adecuados.
4. **Responsive:** hacer colapsable el panel en móvil y probar 320/390/768 px con capturas WebGL2.
5. **Resiliencia IDEAM:** añadir estado granular de carga/fallo de cobertura y verificar que detecciones/PMTiles continúan disponibles si la dependencia externa tarda o falla.
6. **Mapa básico:** reducir saturación visual sin cambiar totales ni filtros y ajustar sus instrucciones a las capacidades reales.

MB-09B debe ejecutarse en una rama nueva desde `main`. La instrumentación SwiftShader puede reutilizarse en esa rama como herramienta temporal de comparación antes/después, pero no debe fusionarse automáticamente a producción hasta demostrar que es estable y útil como gate de largo plazo.