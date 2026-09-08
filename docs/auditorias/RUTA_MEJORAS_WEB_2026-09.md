# Ruta priorizada de mejoras — Dashboard nacional de detecciones térmicas

**Fecha:** 8 de septiembre de 2026  
**Fuente:** `docs/auditorias/AUDITORIA_WEB_INTEGRAL_2026-09.md`  
**Priorización:** `docs/auditorias/PRIORIZACION_AUDITORIA_WEB_2026-09.md`  
**Fase:** C — ruta de mejoras. Este documento define secuencia, alcance, archivos probables, criterios de aceptación y gates. No implementa todavía cambios productivos.

## Decisión operativa aprobada

La implementación se organizará en dos grandes tramos:

1. **Primero:** ajustes generales del portal que no dependen de inspección visual profunda de MapLibre/WebGL2.
2. **Al final:** geovisor/cartografía. La validación visual final de MapLibre, capas, popups, solapamientos, clusters y móvil será realizada por el usuario.

La prioridad técnica de `MAP-001` y otros hallazgos cartográficos no disminuye; únicamente se posterga su ejecución para concentrar el QA visual en una sola fase controlada.

# 1. Objetivo de la Fase C

Convertir los 30 hallazgos auditados y su priorización P0–P4 en una secuencia implementable, segura y verificable que:

- reduzca primero riesgos de interpretación y consistencia pública;
- proteja filtros, conteos y datos ya validados;
- aumente la calidad del despliegue antes de refactors estructurales;
- reduzca carga y deuda técnica sin romper GitHub Pages, Vinext o MapLibre;
- mejore accesibilidad y estados de interfaz;
- deje el geovisor para una última fase de inspección visual directa;
- preserve episodios y sensibilidad A/B para una futura sección de **Análisis detallado**, fuera del portal principal.

# 2. Principios de implementación

## 2.1 Una causa raíz por cambio, no un parche por hallazgo

Los cambios deben agruparse por causa raíz. Cuando una modificación cierre varios IDs, se deben cerrar juntos y documentar en el PR.

## 2.2 PR pequeños y reversibles

Cada bloque operativo debe entrar por una rama corta y un PR independiente. No se recomienda acumular MB-01 a MB-07 en una sola rama.

Esquema sugerido:

- `fix/public-clarity-methodology`
- `fix/context-data-contract`
- `chore/qa-security-gates`
- `perf/frontend-payload`
- `fix/accessibility-responsive`
- `fix/interface-empty-states`
- `fix/geovisor-interactions`

## 2.3 No tocar datos validados sin contrato

Ningún refactor de frontend debe cambiar los conteos de filtros ya verificados. Cambios de ANM/ANLA/ANH que alteren atributos deben pasar por validaciones de esquema y regeneración reproducible.

## 2.4 Publicación progresiva

Los bloques no cartográficos pueden publicarse progresivamente después de CI y revisión funcional. El bloque final MapLibre no se considerará cerrado hasta la inspección visual del usuario.

# 3. Invariantes protegidos contra regresión

Durante toda la ruta deben mantenerse:

1. Detecciones individuales como objeto principal de la interfaz pública.
2. Episodios y A/B fuera del portal principal.
3. Advertencia: detección térmica ≠ incendio confirmado; relación espacial ≠ causalidad.
4. Conteos y filtros RUNAP/ANM/ANLA/ANH coherentes con `dashboard.json`.
5. Restablecimiento de filtros.
6. Encadenamiento departamento → municipio.
7. Ranking y serie temporal día/mes.
8. Cambio automático a Contexto al activar RUNAP/ANM/ANLA/ANH.
9. Consulta solo de capas contextuales visibles.
10. Fallback cuando no hay WebGL2.
11. PMTiles con HTTP Range y fichas completas por shards.
12. GitHub Pages con `basePath` correcto.

# 4. Gate mínimo antes de cada merge

Antes de integrar cualquier bloque productivo:

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run build:pages`
5. Verificar que los activos MapLibre y shards se publican correctamente.
6. Verificar que los conteos base y filtros protegidos no cambian salvo que el PR lo declare explícitamente.
7. No hacer merge si CI está rojo o si el cambio toca geovisor y falta la validación visual exigida para ese bloque.

# 5. Secuencia global de implementación

| Orden | Macrobloque | Objetivo | Hallazgos | Riesgo | Validación visual usuario |
|---|---|---|---|---|---|
| 1 | MB-01 Claridad pública y metodología | Alinear qué muestra el portal y cómo se explica | DATA-003/004/005, UX-001/002/003/005, TECH-002 | Bajo–medio | No necesaria |
| 2 | MB-02 Contrato y calidad de fichas | Corregir semántica/fechas de contexto | DATA-001/002 | Medio | Solo verificación funcional puntual |
| 3 | MB-03 Calidad de entrega y seguridad | Evitar publicar regresiones y tratar advisories | QA-001, SEC-001, TECH-003 | Medio–alto | No necesaria |
| 4 | MB-04 Rendimiento y estabilidad frontend | Reducir payload y eliminar warnings | PERF-001, TECH-001, PERF-002 | Alto | No necesaria para cierre técnico; sí comprobar percepción |
| 5 | MB-05 Accesibilidad y responsive | Mejorar teclado, contraste, ARIA y táctil | A11Y-001/002/003/004, RESP-001 | Medio | Sí en móvil al final del bloque |
| 6 | MB-06 Estados de interfaz/fallback | Hacer explícitos vacío y capacidades del mapa básico | UX-004, MAP-002 | Bajo | No necesaria salvo fallback |
| 7 | MB-07 Geovisor/cartografía | Resolver prioridad de clic, superposiciones y leyendas | MAP-001/003/004, CART-001/002/003 | Alto | **Obligatoria** |
| 8 | MB-08 Investigación posterior | Compartir/exportar estado | UX-006 | Medio | Posterior |

# 6. MB-01 — Claridad pública y metodología

## Objetivo

Cerrar las inconsistencias entre la interfaz pública actual —centrada en detecciones térmicas— y textos, filtros, metadata y documentación heredada. Debe mejorar comprensión sin reintroducir episodios ni selector A/B.

## Hallazgos cubiertos

- `DATA-003` — universo operativo no explicado.
- `DATA-004` — filas sin territorio/cobertura difíciles de reconciliar.
- `DATA-005` — confianza sin semántica.
- `UX-001` — coberturas con códigos opacos.
- `UX-002` — metadata habla de episodios.
- `UX-003` — metodología indicada pero no navegable.
- `UX-005` — situaciones ANLA solapadas no explicadas.
- `TECH-002` — favicon incompatible con `basePath`.

## MB-01A — Metadata, favicon y copy heredado

### Archivos probables

- `app/layout.tsx`
- `app/page.tsx`
- `tests/*.test.mjs` relacionados con metadata/copy

### Cambios previstos

1. Sustituir el título heredado `Episodios de detecciones térmicas · Colombia` por un título centrado en detecciones, por ejemplo:
   - **Detecciones térmicas IDEAM · Colombia**
2. Sustituir la descripción heredada por una descripción que mencione detecciones térmicas y contexto territorial, sin episodios.
3. Corregir el favicon para que funcione bajo el `basePath` de GitHub Pages.
4. Añadir una prueba que impida reintroducir palabras de la arquitectura antigua en metadata pública.

### Criterios de aceptación

- El `<title>` público no contiene “episodios”.
- La meta description no contiene “episodios algorítmicos”.
- El favicon responde correctamente en GitHub Pages.
- `npm test` incluye una aserción contra regresión de metadata.

## MB-01B — Filtro de coberturas comprensible

### Archivos probables

- `app/page.tsx`
- opcionalmente `lib/land-cover.ts` si se centraliza el catálogo de familias
- pruebas de filtros/copy

### Decisión recomendada

Mostrar código + nombre de la familia de nivel 1, no solo el código.

Catálogo esperado:

- `1 · Territorios artificializados`
- `2 · Áreas agrícolas`
- `3 · Bosques y áreas seminaturales`
- `4 · Áreas húmedas`
- `5 · Superficies de agua`

La lógica de filtrado debe continuar usando `level1Code`; solo cambia la presentación.

### Criterios de aceptación

- Ninguna opción visible del filtro es únicamente `1`, `2`, `3`, `4` o `5`.
- Los conteos de cada familia permanecen iguales a los auditados.
- Restablecer filtros sigue funcionando.

## MB-01C — Página pública de metodología mínima

### Archivos probables

- nuevo `app/metodologia/page.tsx`
- `app/page.tsx` para enlace de footer/ayuda
- `app/globals.css` solo si se requiere estilo mínimo
- tests de rutas/exportación estática

### Decisión recomendada

Publicar ahora una página **Metodología** separada de la futura sección **Análisis detallado**.

Ruta recomendada:

- `/metodologia/`

No usar `/docs/` como URL pública porque el directorio del repositorio no es una ruta de Next.js.

### Contenido mínimo obligatorio

1. Qué es una detección térmica.
2. Fuente IDEAM y periodo histórico.
3. Alcance del universo operativo mostrado.
4. Advertencia de que la selección operativa responde a control de calidad instrumental.
5. Explicación de que la sensibilidad A/B y episodios se conservan internamente para análisis detallado, sin exponerlos como controles del portal principal.
6. Qué significan las relaciones RUNAP/ANM/ANLA/ANH.
7. Explicación de confianza: indicador reportado por la fuente/producto satelital, no probabilidad directa de incendio; su interpretación puede depender del sensor/producto.
8. Explicación de situación ANLA como posible condición multietiqueta/no excluyente.
9. Nota sobre detecciones sin asignación territorial o sin cobertura cuando aplique.
10. Fuentes y enlaces institucionales principales.

### Texto público recomendado para el universo operativo

> El portal muestra un universo operativo de detecciones térmicas construido a partir de los datos disponibles de IDEAM y de criterios de control de calidad instrumental documentados en la metodología. Por esta razón, el total mostrado puede diferir del total bruto descargado. La evaluación de sensibilidad instrumental se conserva para el análisis detallado y no se presenta como un selector en la interfaz principal.

### Criterios de aceptación

- El footer enlaza a una URL real y navegable.
- `/metodologia/` devuelve 200 bajo GitHub Pages.
- No aparece un selector A/B en la interfaz principal.
- La metodología explica por qué el total público puede diferir del bruto.
- El copy mantiene la advertencia no causal.

## MB-01D — Nulos y reconciliación de subtotales

### Decisión recomendada

No crear de inmediato nuevos filtros “Sin asignación” si su utilidad es marginal. Primero hacer reconciliables los totales mediante una nota metodológica y, si existe un bloque de alcance, indicar explícitamente el número de detecciones sin asignación territorial/cobertura del corte actual.

Si el dato cambia automáticamente, el texto debe obtenerlo de `dashboard.metadata` o de un cálculo derivado, no quedar escrito a mano.

### Criterios de aceptación

- El usuario puede entender por qué el total general no siempre coincide con la suma de categorías visibles.
- No se introducen números estáticos que queden obsoletos.

## MB-01E — Situación ANLA y confianza

### Archivos probables

- `app/page.tsx`
- `components/public-detection-geovisor-map.tsx` solo para texto de popup si no requiere inspección cartográfica
- `app/metodologia/page.tsx`

### Cambios previstos

1. Añadir una nota breve al filtro ANLA indicando que “En evaluación” y “Licenciado” pueden no ser categorías mutuamente excluyentes en el dataset integrado.
2. En la ficha de detección, rotular “Confianza” de forma que no sugiera probabilidad de incendio; añadir una ayuda breve o remitir a metodología.
3. Evitar comparar directamente valores de confianza entre productos/sensores sin contexto.

### Criterios de aceptación

- El usuario no puede inferir razonablemente que las dos situaciones ANLA deben sumar 100 %.
- La ficha de detección no presenta “Confianza” como probabilidad de incendio.

## MB-01 — Orden seguro de implementación

1. Metadata + favicon.
2. Nombres de cobertura.
3. Crear `/metodologia/`.
4. Enlazar footer y ayuda.
5. Añadir explicación de universo operativo, ANLA y confianza.
6. Añadir tests de copy/rutas.
7. Ejecutar gates completos.
8. Publicar y verificar solo texto/rutas; no tocar MapLibre.

## Riesgo de regresión MB-01

**Bajo.** El principal riesgo es alterar inadvertidamente filtros al modificar `app/page.tsx`. Por eso las pruebas deben confirmar conteos conocidos y la selección `level1Code` debe permanecer intacta.

# 7. MB-02 — Contrato y calidad de fichas

## Objetivo

Evitar presentar atributos falsos o ilegibles en ANM/ANLA/ANH.

## Hallazgos

- `DATA-001`
- `DATA-002`

## Archivos probables

- `scripts/build_context_tiles.py`
- script/proceso que genera `public/data/context-details.json`
- `scripts/shard-context-details.mjs`
- `components/public-detection-geovisor-map.tsx`
- tests de contrato de contexto

## Ruta técnica

1. Rastrear origen exacto de `estado` ANM hasta `anm_titles_join.geojson.gz` y metadatos fuente.
2. Determinar si existe un campo administrativo correcto.
3. Si no existe, eliminar/renombrar el campo en la ficha; no reinterpretar una fecha como estado.
4. Normalizar fechas ANLA/ANH en la capa de generación o mediante un helper único y probado.
5. Regenerar `context-details.json` y shards.
6. Validar recuentos de registros y claves antes/después.

## Criterios de aceptación

- Ninguna fecha epoch se muestra cruda.
- `Estado` ANM solo se muestra si existe un atributo semánticamente válido.
- Las 22.952 fichas o el conteo vigente se preservan salvo causa documentada.
- Manifest/shards cierran con el catálogo fuente.
- PMTiles no pierde geometrías.

# 8. MB-03 — Calidad de entrega y seguridad

## Objetivo

Aumentar protección contra regresiones antes de refactors de rendimiento y accesibilidad.

## Hallazgos

- `QA-001`
- `SEC-001`
- `TECH-003`

## Cambios previstos

### QA

- Añadir `npm test` al workflow de Pages antes de `build:pages`.
- Mantener CI específico del geovisor.
- Incorporar al menos una prueba funcional/E2E reproducible de filtros y estado de la página.
- No convertir el servicio externo IDEAM en dependencia determinista de un E2E de deploy.

### Seguridad

- Enumerar advisories de `npm audit --omit=dev`.
- Clasificar cada advisory según alcanzabilidad real en exportación estática.
- Actualizar dependencias de forma incremental.
- Prohibir `npm audit fix --force` sin revisión.

### Deuda geovisor legado

- Declarar `public-detection-geovisor-map.tsx` como implementación canónica actual.
- Retirar componente legado solo después de confirmar que ningún alias/test/build lo usa.

## Criterios de aceptación

- Ningún deploy a Pages ocurre sin `npm test`.
- Dependencias actualizadas pasan build, tests y exportación.
- No quedan dos implementaciones activas o ambiguas del geovisor.

# 9. MB-04 — Rendimiento y estabilidad frontend

## Objetivo

Reducir el payload inicial y eliminar warnings sin modificar resultados.

## Hallazgos

- `PERF-001`
- `TECH-001`
- `PERF-002`

## Presupuesto propuesto antes del refactor

Registrar una línea base y fijar inicialmente:

- reducción mínima del 25 % del mayor chunk gzip respecto de la línea base auditada de ~1,90 MB, sin sacrificar funcionalidad;
- cero warnings `width(-1)/height(-1)` de Recharts en build normal;
- ningún cambio en conteos de filtros protegidos.

El 25 % es un primer objetivo de ingeniería, no un SLA definitivo.

## Estrategias candidatas

1. Carga diferida del geovisor/MapLibre cuando sea seguro.
2. Separar datos pesados del bundle de código si la exportación estática lo permite.
3. Evitar reconstrucciones de GeoJSON innecesarias.
4. Revisar importaciones de librerías no usadas.
5. Resolver condición inicial de tamaño de Recharts.
6. Medir varias muestras IDEAM antes de diseñar estados especiales por latencia externa.

## Criterios de aceptación

- Mejora medible frente a baseline.
- Cero regresiones en filtros/conteos.
- GitHub Pages conserva rutas y assets.
- Worker MapLibre sigue funcionando.

# 10. MB-05 — Accesibilidad y responsive

## Objetivo

Mejorar operación no visual, semántica y uso táctil sin destruir densidad de información.

## Hallazgos

- `A11Y-001/002/003/004`
- `RESP-001`

## Decisión recomendada para A11Y-001

No hacer miles de geometrías del mapa tabulables. Proveer un **equivalente accesible** mediante filtros/selectores/listado sincronizado para las tareas territoriales principales y mantener el mapa como visualización complementaria.

## Cambios

- contraste de texto normal ≥4,5:1;
- `aria-pressed` en toggles de estado;
- nombres accesibles/alternativa textual para gráficos;
- targets táctiles más grandes;
- revisión real en móvil antes de cerrar `RESP-001`.

## Criterios de aceptación

- flujo principal operable con teclado sin depender del mapa;
- estado activo de toggles anunciado;
- textos pequeños cumplen contraste AA;
- usuario valida móvil real antes del cierre del bloque.

# 11. MB-06 — Estados de interfaz y fallback

## Hallazgos

- `UX-004`
- `MAP-002`

## Cambios

1. Cuando no hay resultados, sustituir gráficos vacíos por mensaje explícito y mantener contexto de filtros.
2. Diferenciar copy del Geovisor y del Mapa básico.
3. En mapa básico, no prometer consulta de coberturas/contexto/detecciones si no existe esa interacción.

## Criterios de aceptación

- cero resultados nunca parece un fallo de carga;
- el fallback describe solo capacidades reales.

# 12. MB-07 — Geovisor y cartografía final

## Hallazgos

- `MAP-001`
- `MAP-003`
- `MAP-004`
- `CART-001`
- `CART-002`
- `CART-003`

## Regla de ejecución

Este bloque se implementa **después** de todos los ajustes anteriores y se cierra únicamente con validación visual del usuario en Chrome/WebGL2.

## Cambios previstos

1. Hacer que el `queryMode` activo determine la prioridad del clic.
2. Evitar que una detección intercepte una consulta explícita de Contexto/Cobertura/Territorio.
3. Cuando existan varias entidades contextuales coincidentes, ofrecer selección o listado, no `queryRenderedFeatures()[0]` silencioso.
4. Indicar claramente la capa/entidad seleccionada.
5. Añadir leyenda de clusters: número, tamaño y significado.
6. Añadir semántica de estados/geometrías ANLA.
7. Revisar saturación del mapa básico nacional.

## Matriz de QA visual obligatoria

El usuario probará al menos:

- RUNAP, ANM, ANLA, ANH por separado;
- dos y cuatro capas superpuestas;
- detección sobre polígono;
- modo Territorio, Cobertura y Contexto;
- clusters y puntos individuales;
- zoom nacional, regional y municipal;
- popups consecutivos;
- Chrome desktop con WebGL2;
- móvil real si el panel se modifica.

## Criterio de cierre

No cerrar `MAP-001/003/004` solamente por tests de código. Se requiere confirmación visual del usuario.

# 13. MB-08 — Investigación posterior

## Hallazgo

- `UX-006`

Después de estabilizar el núcleo, evaluar:

- URL con filtros serializados;
- enlace compartible;
- exportación CSV de subconjunto filtrado;
- entrada **Análisis detallado** para episodios, sensibilidad A/B, recurrencia y análisis territoriales avanzados.

# 14. Decisiones humanas y recomendación adoptada para la ruta

| Tema | Recomendación de la ruta | Estado |
|---|---|---|
| Universo operativo | Explicarlo sin selector A/B | Propuesto para MB-01 |
| Destino metodológico | Crear `/metodologia/` ahora; reservar “Análisis detallado” para después | Propuesto |
| Estado ANM | Auditar fuente; eliminar campo si no existe estado válido | Requiere evidencia MB-02 |
| A11Y mapa | Equivalente accesible por controles/listado, no miles de shapes tabulables | Propuesto |
| Performance budget | Primer objetivo: -25 % del chunk gzip principal | Propuesto |
| QA MapLibre | Cierre visual por usuario | **Aprobado** |

# 15. Unidad de trabajo recomendada para comenzar implementación

La primera rama productiva debería ser:

`fix/public-clarity-methodology`

## Alcance exacto del primer PR

Incluye:

- UX-002 metadata;
- TECH-002 favicon;
- UX-001 nombres de cobertura;
- DATA-003 texto de universo operativo;
- UX-003 `/metodologia/` y enlace real;
- DATA-005 explicación de confianza;
- UX-005 nota sobre situación ANLA;
- DATA-004 explicación dinámica de registros no asignados si se puede derivar sin cambiar contrato de datos.

No incluye:

- cambios a PMTiles;
- cambio de esquema de fichas;
- refactor de bundle;
- cambios MapLibre;
- cambios visuales de clusters;
- episodios/A-B en la UI principal.

## Archivos que probablemente se tocarán

- `app/layout.tsx`
- `app/page.tsx`
- nuevo `app/metodologia/page.tsx`
- `app/globals.css` solo si hace falta estilo básico de la página metodológica
- pruebas nuevas o existentes bajo `tests/`

## Pruebas de aceptación del primer PR

1. Home carga y muestra el mismo total operativo antes/después.
2. Filtros Tolima, Ibagué, RUNAP, ANM, ANLA, ANH y cobertura conservan conteos auditados para el mismo dataset.
3. El filtro de cobertura muestra nombres legibles.
4. Metadata pública ya no menciona episodios.
5. Favicon no da 404 bajo Pages.
6. Footer enlaza a `/metodologia/`.
7. `/metodologia/` se exporta y abre correctamente bajo `basePath`.
8. La metodología explica universo operativo, confianza, ANLA multietiqueta y no causalidad.
9. No existe selector A/B ni capa de episodios en la home.
10. `npm ci`, `lint`, `test`, `build:pages` en verde.

# 16. Checkpoint para Fase D — implementación

> La Fase C quedó definida en `docs/auditorias/RUTA_MEJORAS_WEB_2026-09.md`. Iniciar Fase D con una rama productiva `fix/public-clarity-methodology` derivada de `main`. Implementar únicamente el primer PR de MB-01: metadata, favicon, nombres de coberturas, página pública `/metodologia/`, explicación del universo operativo, confianza, situación ANLA y reconciliación de nulos sin cambiar la lógica de filtros. Ejecutar todos los gates y validar que los conteos protegidos no cambian. No tocar todavía contrato de fichas, performance estructural ni MapLibre. El geovisor queda para MB-07 y será validado visualmente por el usuario.
