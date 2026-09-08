# Auditoría web integral — Dashboard nacional de detecciones térmicas

**Fecha:** 8 de septiembre de 2026  
**Aplicación:** <https://jcgomezga.github.io/puntos-calor-colombia-dashboard/>  
**Commit auditado:** `6e1f8319e2c40aed6532f1c7a0a60a69644648f1`  
**Fase:** A — auditoría y diagnóstico. Este documento no contiene una priorización por sprints ni implementa cambios.

# 1. Resumen ejecutivo

El dashboard es funcional como explorador estadístico público: carga, presenta 23.542 detecciones del universo operativo publicado, recalcula coherentemente tarjetas, rankings y series para los filtros ejercitados, permite seleccionar territorio en el mapa básico y comunica de forma responsable que una detección térmica no equivale a un incendio confirmado ni demuestra causalidad. El despliegue auditado coincide con el último commit de `main`, compila, pasa lint y supera sus 28 pruebas existentes.

No está todavía en condición de cierre de una versión pública estable sin una fase posterior de corrección. Se registraron **30 hallazgos: 0 S0, 0 S1, 12 S2, 15 S3 y 3 S4**. Los riesgos principales son: una prioridad de clic que puede impedir consultar geometrías bajo detecciones visibles; fechas y estados crudos o semánticamente incorrectos en fichas de contexto; selector de coberturas reducido a códigos opacos; metadatos y documentación pública desalineados; un chunk inicial de 1,90 MB comprimido; ausencia de pruebas E2E reales; y barreras de teclado/semántica.

La interacción MapLibre profunda quedó parcialmente limitada por el entorno de auditoría, que no expuso WebGL2. El fallback de la aplicación funcionó correctamente. Por rigor, no se presentan como errores confirmados los clusters, popups, paneo, zoom ni consulta de polígonos que no pudieron verificarse en vivo; se documentan por separado los defectos deterministas hallados en código/datos y las pruebas pendientes.

# 2. Alcance

Se realizaron diez pasadas: reconocimiento; controles; geovisor; filtros individuales y combinados; consola/red; responsive y teclado; coherencia de datos; revisión posterior del repositorio; reproducción; y auditoría final de cobertura. Se inspeccionaron la aplicación pública, sus recursos de red, los datos publicados, PMTiles, shards de fichas, código React/Next/MapLibre, scripts, pruebas y workflows. No se modificaron código, datos, UI, workflows ni `main`.

Se contabilizan **112 verificaciones discretas**: 68 funcionales/interactivas, 21 técnicas y de despliegue, 17 de datos y 6 de accesibilidad/responsive. La tabla de este informe agrupa verificaciones relacionadas para mantenerla legible.

# 3. Entorno de prueba

| Dimensión | Condición |
|---|---|
| Fecha/hora | 2026-09-08 UTC |
| Producción | GitHub Pages, commit `6e1f831...` |
| Navegador interactivo | Chromium remoto, 1.348 × 936 px |
| Gráficos | Renderizados correctamente |
| WebGL2 | No disponible en el navegador remoto |
| Validación local | Node 24.19.0, npm 11.9.0, Python 3.12.13 |
| Red | Infraestructura compartida; mediciones puntuales, no SLA |
| Responsive real | No hubo emulación de viewport; se revisaron breakpoints y tamaños CSS |

# 4. Arquitectura pública actual observada

La página es una exportación estática de Next.js. El cliente importa el dataset compacto, filtra `PointRow` en memoria y recalcula métricas, ranking y serie temporal. El geovisor activo se resuelve mediante el alias de TypeScript de `@/components/geovisor-map` hacia `components/geovisor-entry.tsx`, que carga `public-detection-geovisor-map.tsx`, configura el worker MapLibre y usa PMTiles con fichas completas diferidas por shard. Las coberturas IDEAM dependen de un servicio vectorial externo.

La interfaz principal observada sí está centrada en **detecciones térmicas IDEAM**. No se considera un error la ausencia pública de episodios ni del análisis instrumental A/B. Sin embargo, el `<title>` y la descripción de metadatos aún hablan de “episodios algorítmicos”, y el universo operativo publicado no se explica de forma visible.

# 5. Inventario funcional

- Filtros de fecha, departamento, municipio, RUNAP, cobertura, ANM, ANLA, situación ANLA y ANH.
- Restablecimiento total; ocho tarjetas/contadores; ranking territorial y serie temporal día/mes.
- Conmutación Geovisor/Mapa básico.
- Capas de detecciones, DANE, cobertura IDEAM, RUNAP, ANM, ANLA y ANH; opacidad y leyenda.
- Modos de consulta Territorio, Cobertura y Contexto.
- Geovisor MapLibre con clusters/puntos, PMTiles, tiles IDEAM, popups resumidos y fichas diferidas.
- Mapa básico con puntos canvas y polígonos territoriales SVG seleccionables.

# 6. Matriz completa de pruebas

| Elemento | Probado | Resultado | Evidencia | Observaciones |
|---|---|---|---|---|
| Carga inicial, H1 y aviso metodológico | Sí, repetido | Funciona | Captura 01; DOM | Primer acceso remoto lento; título del documento desactualizado |
| Tarjetas por defecto | Sí | Funciona | 23.542; 32; 692; 4 | Coinciden con cálculo independiente |
| Contadores RUNAP/coberturas/ANM/ANLA/ANH | Sí | Funciona | 1.511/88/4.294/12.958/8.491 | Catálogos coherentes |
| Fecha inicial/final | Parcial | No reproducido | DOM/código/datos | Automatización de `<input type=date>` no disparó un evento nativo fiable |
| Departamento | Sí, repetido | Funciona | Tolima 2.069; Cundinamarca 435 | Recalcula y sincroniza mapa básico |
| Municipio | Sí | Funciona | Ibagué 114 | Se habilita al elegir departamento |
| RUNAP dentro/fuera | Sí | Funciona | 1.511/22.031 | Partición exacta |
| Coberturas 1–5 | Sí | Parcial | 1.316/10.305/10.436/1.227/233 | El filtro funciona, pero las etiquetas son códigos |
| ANM dentro/fuera | Sí | Funciona | 4.294/19.248 | Partición exacta |
| ANLA relaciones | Sí | Funciona | 5.114/2.524/5.320/10.584 | La situación es multietiqueta, no excluyente |
| ANLA situación | Sí | Funciona | evaluación 353; licenciado 12.952 | Solapamiento de 347 registros no explicado |
| ANH relaciones | Sí | Funciona | 5.315/733/2.443/15.051 | Partición exacta |
| Restablecer filtros | Sí, tras combinación compleja | Funciona | DOM | Regresa a valores y contadores iniciales |
| Departamento + municipio | Sí | Funciona | Ibagué 114 | Coherente |
| Departamento + RUNAP | Sí | Funciona | Tolima 6 | Coherente con datos |
| Departamento + ANM | Sí | Funciona | Tolima 622 | Coherente con datos |
| Departamento + ANLA | Sí | Funciona | Tolima 840 | Relación “dentro” |
| Departamento + ANH | Sí | Funciona | Tolima 1.036 | Relación “dentro” |
| Municipio + cobertura | Sí | Funciona | Ibagué + grupo 3 = 50 | Coherente |
| RUNAP + ANM | Sí | Funciona | 55 | Coherente |
| ANM + ANLA | Sí | Funciona | 1.137 | Ambos dentro |
| ANLA + ANH | Sí | Funciona | 3.090 | Ambos dentro |
| RUNAP + ANM + ANLA + ANH | Sí | Funciona | 2 | Resultado de alta selectividad |
| Combinación de cero resultados | Sí | Parcial | Captura 02 | Tarjetas a cero; gráficos sin mensaje vacío |
| Día/mes | Sí, ida y vuelta | Funciona | DOM | Título y agregación cambian |
| Tooltip ranking | Sí | Funciona | Cesar: 3.086 | Correcto |
| Tooltip temporal | Sí | Funciona | 1 ago 2026: 678 | Correcto |
| Geovisor | Parcial | Limitación conocida | Fallback WebGL2 | El entorno no permitió validar interacción MapLibre |
| Mapa básico | Sí | Parcial | Captura 01 | Selección territorial sí; texto promete más interacción de la disponible |
| Selección territorial por mapa | Sí, dos veces | Funciona | Estado DOM antes/después | Seleccionó Cundinamarca y habilitó 117 municipios |
| Zoom +/−, rueda, arrastre y escala | No | No verificado | Entorno | Requiere MapLibre/WebGL2 |
| Atribuciones MapLibre | No | No verificado | Entorno | Requiere MapLibre/WebGL2 |
| Clusters y transición a puntos | Código/datos | Pendiente en vivo | Componente activo | Radio 42; `clusterMaxZoom` 9 |
| Check detecciones | Parcial | Comportamiento inconsistente | Automatización | No se confirmó desactivación; no se clasifica como error |
| Check DANE | Sí | Funciona | DOM | Off/on correcto |
| Check cobertura | Sí | Funciona | DOM | Off/on correcto |
| Checks RUNAP/ANM/ANLA/ANH | Sí | Funciona a nivel control | DOM | No se validaron geometrías en vivo |
| Cambio automático a Contexto | Sí, repetido | Funciona | DOM/código | Al apagar última capa vuelve a Territorio |
| Territorio/Cobertura/Contexto | Sí | Funciona a nivel control | DOM | Prioridad real de features pendiente en vivo |
| Leyenda de coberturas | Sí | Funciona | DOM | Se expande y contrae |
| Slider de opacidad | Sí | Funciona | 0,50→0,85 | Estado actualizado |
| Popups de detección | Código/datos | Pendiente en vivo | Componente activo | Campos presentes; 441 FRP sin dato |
| Popups RUNAP/ANM/ANLA/ANH | Código/datos | Parcial | Shards/componente | Fechas/estado crudos; interacción pendiente |
| Popup cobertura | Código | Pendiente en vivo | Componente activo | Dependencia de tiles IDEAM |
| Teclado Tab | Sí | Parcial | Secuencia de foco | Formularios alcanzables; mapa no |
| Estructura de encabezados | Sí | Funciona | DOM | H1 y secciones comprensibles |
| ARIA de botones de estado | Sí | Parcial | DOM | No exponen `aria-pressed` |
| Semántica de gráficos | Sí | Parcial | DOM | `role=application`; sin nombre accesible útil |
| Contraste de textos pequeños | Sí | Parcial | 3,83:1 | Falla AA para texto normal |
| Targets táctiles | CSS | Parcial | 25–29 px | Menores que 44×44 recomendados |
| Responsive desktop | Sí | Funciona | 1.348×936 | Sin desbordamiento crítico observado |
| Responsive laptop/tablet/móvil | CSS | No verificado en vivo | Breakpoints 980/640 | Requiere dispositivo/emulación real |
| Consola | Sí, repetido | Parcial | Warning Recharts | Ruido de extensión excluido |
| Red y 404 | Sí | Parcial | `/docs` y favicon raíz 404 | PMTiles Range correcto |
| IDEAM vector tile | Sí, una muestra | Parcial | HTTP 200, 14,99 s | No permite inferir disponibilidad global |
| PMTiles | Sí | Funciona | HTTP 206 Range | 60,7 MB total, carga parcial |
| Shards de fichas | Código/datos | Funciona estructuralmente | Manifest y archivos | Carga diferida correcta en diseño |
| Build/lint/tests | Sí | Funciona con advertencias | 28/28 | No hay E2E real |
| GitHub Pages | Sí | Funciona | Run 34188428627 | Despliega el SHA auditado |
| Auditoría dependencias | Sí | Hallazgo | `npm audit` | 5 paquetes de producción en severidad alta |

# 7. Geovisor

## Carga y arquitectura

La detección previa de WebGL2 evita un fallo opaco y ofrece un fallback comprensible. El worker MapLibre se configura explícitamente. PMTiles acepta rangos HTTP correctamente. El servicio IDEAM respondió con CORS permisivo y HTTP 200 en la muestra, aunque tardó 14,99 s en el entorno de auditoría.

El código activo crea clusters hasta zoom 9, puntos individuales después, límites y etiquetas DANE con transiciones por zoom, coberturas IDEAM y las geometrías RUNAP/ANM/ANLA/ANH. Al activar contexto, consulta solamente IDs de capas visibles, lo cual es correcto. La ficha completa se carga por shard.

## Consulta con clic

Existe un defecto determinista: el manejador consulta primero clusters/detecciones y retorna antes de evaluar `queryMode`. Por tanto, una detección visible bajo el cursor puede interceptar un intento explícito de consultar Cobertura, Contexto o Territorio. Además, cuando varias geometrías contextuales coinciden, solo se usa el primer feature renderizado; no hay selector de entidades coincidentes.

En modo básico, el canvas de detecciones tiene `pointer-events: none` y `aria-hidden`; solo los polígonos territoriales SVG son interactivos. El texto compartido con el geovisor promete navegación y consulta de detecciones/coberturas/contexto que ese modo no ofrece.

# 8. Filtros

| Combinación | Resultado observado |
|---|---:|
| Tolima | 2.069 |
| Ibagué | 114 |
| Tolima + RUNAP dentro | 6 |
| Tolima + ANM dentro | 622 |
| Tolima + ANLA dentro | 840 |
| Tolima + ANH dentro | 1.036 |
| Ibagué + cobertura 3 | 50 |
| RUNAP dentro + ANM dentro | 55 |
| ANM dentro + ANLA dentro | 1.137 |
| ANLA dentro + ANH dentro | 3.090 |
| Las cuatro capas dentro | 2 |
| ANLA dentro + en evaluación | 172 |
| ANLA dentro + licenciado | 5.114 |
| Tolima + Ibagué + cobertura 5 + cuatro capas dentro | 0 |

Todos los conteos anteriores coincidieron con un cálculo independiente sobre `dashboard.json`. Las familias de cobertura aparecen como “1” a “5”, no como categorías comprensibles. Las situaciones ANLA son multietiqueta; “en evaluación” y “licenciado” se solapan, pero la UI no lo explica. La prueba de rango de fecha quedó no reproducida de forma fiable por la automatización del control nativo.

# 9. Fichas y popups

La ficha de detección tiene fecha, hora, sensor, FRP, confianza y relaciones RUNAP/ANM/ANLA/ANH. No se encontraron `NaN`, coordenadas o minutos inválidos. Hay 441 FRP ausentes, contemplados como “Sin dato”. La confianza se muestra como número sin escala ni definición.

Las fichas de contexto incluyen los campos requeridos en código, pero los datos revelan problemas de presentación: 9.844 fechas de acto ANLA y 453 de 455 fechas de firma ANH son epoch en milisegundos y se imprimirían crudas; 7.066 estados ANM tienen apariencia de fecha/hora. Los enlaces de minuta/ficha se muestran como texto, no como enlaces accionables. La apertura, cierre, clics consecutivos y superposición de popups quedan pendientes de prueba viva con WebGL2.

# 10. Datos

Se verificó el modelo compacto `PointRow`: todas las filas tienen 19 posiciones; no se hallaron índices fuera de catálogo, coordenadas inválidas ni minutos inválidos. El universo público contiene 23.542 de 33.788 filas. Esto respeta la simplificación pública, pero el usuario no recibe una explicación visible de que el total publicado es un universo operativo seleccionado; no se propone exponer A/B, solo documentar el alcance.

Hay 22 detecciones sin asignación departamental/municipal y 25 sin familia de cobertura. Permanecen en el total general, pero no tienen categoría filtrable o visible en ranking. Las particiones espaciales RUNAP, ANM, ANLA y ANH cuadran exactamente. El catálogo de fuentes contiene cinco instrumentos, pero cuatro aportan registros al universo público, por lo que la tarjeta “Fuentes 4” es correcta.

# 11. Rendimiento

El mayor chunk JavaScript pesa 6,88 MB decodificado y 1,90 MB gzip; el build advierte que supera 500 kB. El dataset y geometrías se importan en el cliente y cada cambio de filtros reconstruye GeoJSON de las detecciones. PMTiles evita descargar de inicio sus 60,7 MB completos y las fichas se difieren por shard, dos decisiones positivas.

El primer GET del HTML tardó 11,5 s en una observación del navegador remoto y el tile IDEAM de muestra 14,99 s. Por ser infraestructura compartida, son señales, no métricas universales. No pudo realizarse perfilado de memoria, FPS o latencia de interacción MapLibre.

# 12. Responsive

En 1.348×936 no hubo corte crítico. CSS cambia métricas a dos columnas y el workspace a una columna bajo 980 px; bajo 640 px apila filtros, métricas y gráficos y fija el mapa en 450 px. Sin emulación real no se confirma el comportamiento táctil. El panel de capas mantiene 185 px y los botones MapLibre 29 px, por lo que la ocupación y precisión táctil en móvil son un riesgo muy probable.

# 13. Accesibilidad

Los controles de formulario están asociados mediante `<label>` envolvente y el foco alcanza fechas, selectores, botones y gráficos. Las áreas territoriales del mapa básico no son enfocables y el canvas está oculto a tecnología asistiva. Los botones Geovisor/Mapa básico, Territorio/Cobertura/Contexto y Día/Mes expresan estado solo visualmente, sin `aria-pressed`. Los SVG Recharts tienen `role=application` pero carecen de nombre/alternativa tabular. Se midió 3,83:1 para texto pequeño `#7a857e` sobre blanco; no alcanza 4,5:1. Varios controles están entre 25 y 29 px.

# 14. UX

**Perfil A:** entiende rápidamente que ve detecciones y recibe la advertencia de no equipararlas con incendios. No entiende qué significan cobertura “1–5”, confianza o clusters, ni encuentra ayuda navegable.

**Perfil B:** los filtros, ranking y serie ofrecen una exploración útil, pero el estado no puede enlazarse/compartirse y no hay exportación. El universo operativo, ausencias territoriales y solapamiento de situación ANLA no son transparentes.

**Perfil C:** encuentra las capas esperadas y el cambio automático a Contexto, pero la prioridad de clic, la selección de una sola geometría superpuesta y los atributos crudos reducen la confiabilidad de la consulta.

# 15. Cartografía

El naranja de detecciones mantiene jerarquía sobre el fondo claro y los contextos usan rellenos transparentes. En el mapa básico nacional, dibujar 23.542 puntos individuales produce saturación y solapamiento. No hay una leyenda explícita para tamaño/conteo de clusters ni para la semántica cromática de estados ANLA. La UI advierte correctamente contra inferir incendios o causalidad, pero las relaciones “dentro/cerca” aún pueden interpretarse como asociación sustantiva sin explicación metodológica accesible.

# 16. Errores técnicos

- Recharts emite dos veces: `The width(-1) and height(-1) of chart should be greater than 0...`, tanto en producción como en build.
- `/puntos-calor-colombia-dashboard/docs/` devuelve 404 y el texto del footer no es un enlace.
- El metadato de icono apunta a `/favicon.svg`, que devuelve 404 en la raíz del dominio; el archivo sí existe bajo el `basePath`.
- `npm audit --omit=dev` reporta cinco paquetes de producción con severidad alta. El riesgo efectivo debe contextualizarse porque Pages sirve una exportación estática.
- El workflow de Pages ejecuta lint/build, pero no `npm test`; el CI con tests no se dispara en push directo a `main`.
- Existe un componente geovisor legado de 746 líneas además del componente público activo; aumenta el riesgo de divergencia.

# 17. Registro maestro de hallazgos

| ID | Categoría | Severidad | Confidencia | Clasificación | Descripción corta | Evidencia |
|---|---|---:|---|---|---|---|
| MAP-001 | Geovisor | S2 | Confirmado | ERROR CONFIRMADO | Detecciones visibles interceptan consultas de otra capa | Orden/retornos del handler activo |
| MAP-002 | Geovisor/UX | S2 | Confirmado | PROBLEMA DE UX | El modo básico promete interacciones que no ofrece | Captura 01; canvas no interactivo |
| DATA-001 | Datos/ficha | S2 | Confirmado | ERROR CONFIRMADO | Fechas ANLA/ANH se presentan como epoch crudo | Shards y render del popup |
| DATA-002 | Datos/ficha | S2 | Confirmado | ERROR CONFIRMADO | `estado` ANM contiene mayoritariamente fechas | 7.066 valores de 9.277 |
| DATA-003 | Interpretación | S2 | Confirmado | PROBLEMA DE UX | Universo operativo de 23.542 no se explica | 33.788 filas totales; copy público |
| UX-001 | Filtros | S2 | Confirmado | PROBLEMA DE UX | Coberturas se filtran con códigos opacos 1–5 | DOM/dataset |
| UX-002 | Contenido/SEO | S2 | Confirmado | ERROR CONFIRMADO | `<title>` y descripción hablan de episodios | `app/layout.tsx`; título producción |
| UX-003 | Documentación | S2 | Confirmado | ERROR CONFIRMADO | Referencia a `/docs` no enlaza y la ruta da 404 | HTTP 404; footer |
| PERF-001 | Rendimiento | S2 | Confirmado | LIMITACIÓN CONOCIDA | Chunk principal de 1,90 MB gzip | HEAD/build |
| QA-001 | Calidad | S2 | Confirmado | LIMITACIÓN CONOCIDA | Sin E2E real y tests ausentes del deploy directo | Tests/workflows |
| A11Y-001 | Accesibilidad | S2 | Confirmado | ERROR CONFIRMADO | Consulta/selección cartográfica no operable con teclado | DOM del mapa básico |
| SEC-001 | Dependencias | S2 | Confirmado | LIMITACIÓN CONOCIDA | Cinco paquetes productivos con avisos altos | `npm audit --omit=dev` |
| MAP-003 | Geovisor | S3 | Confirmado | PROBLEMA DE UX | Solo se ofrece el primer contexto en superposición | `queryRenderedFeatures()[0]` |
| MAP-004 | Geovisor | S3 | Muy probable | COMPORTAMIENTO INCONSISTENTE | Sin indicación clara de feature alternativo coincidente | Diseño del popup/handler |
| DATA-004 | Datos | S3 | Confirmado | LIMITACIÓN CONOCIDA | 22 filas sin territorio y 25 sin cobertura no son aislables | Cálculo independiente |
| DATA-005 | Interpretación | S3 | Confirmado | PROBLEMA DE UX | Confianza se muestra sin escala/semántica | Popup/copy |
| UX-004 | Estado vacío | S3 | Confirmado | PROBLEMA DE UX | Gráficos vacíos conservan ejes sin mensaje | Captura 02 |
| UX-005 | Metodología | S3 | Confirmado | PROBLEMA DE UX | Situaciones ANLA solapadas no se explican | 347 registros compartidos |
| CART-001 | Cartografía | S3 | Confirmado | PROBLEMA DE UX | Falta leyenda de clusters y tamaño | UI |
| CART-002 | Cartografía | S3 | Confirmado | PROBLEMA DE UX | Mapa básico nacional queda saturado por puntos | Captura 01 |
| CART-003 | Cartografía | S3 | Confirmado | PROBLEMA DE UX | Leyenda no explica estados/geometrías ANLA | UI/código de estilos |
| PERF-002 | Rendimiento | S3 | Hipótesis | NO REPRODUCIDO | Servicio IDEAM puede dominar la espera | Una muestra de 14,99 s |
| TECH-001 | Frontend | S3 | Confirmado | ERROR CONFIRMADO | Recharts emite warnings de dimensiones negativas | Consola/build |
| A11Y-002 | Accesibilidad | S3 | Confirmado | ERROR CONFIRMADO | Texto pequeño tiene contraste 3,83:1 | Cálculo CSS |
| A11Y-003 | Accesibilidad | S3 | Confirmado | PROBLEMA DE UX | Estados de botones y gráficos carecen de semántica suficiente | DOM |
| A11Y-004 | Accesibilidad | S3 | Confirmado | PROBLEMA DE UX | Varios targets interactivos son de 25–29 px | CSS/DOM |
| RESP-001 | Responsive | S3 | Hipótesis | NO REPRODUCIDO | Panel/cartografía pueden ocupar o exigir precisión excesiva en móvil | CSS a 640 px |
| TECH-002 | GitHub Pages | S4 | Confirmado | ERROR CONFIRMADO | Favicon absoluto omite `basePath` | HTTP 404/200 |
| UX-006 | Investigación | S4 | Confirmado | MEJORA POSIBLE | Estado de filtros no es compartible ni exportable | URL/UI |
| TECH-003 | Deuda técnica | S4 | Confirmado | LIMITACIÓN CONOCIDA | Componente geovisor legado duplicado | Repositorio |

## Fichas resumidas de reproducción e impacto

| ID | Pasos exactos | Esperado / observado | Impacto | Entorno/componente | Origen probable | Recomendación preliminar |
|---|---|---|---|---|---|---|
| MAP-001 | Active una capa contextual; elija Contexto; haga clic donde coincide una detección | Esperado: respetar Contexto. Observado en código: hotspot se consulta primero y retorna | Puede impedir abrir la ficha buscada | MapLibre, handler de clic | Prioridad fija ajena a `queryMode` | Hacer la prioridad dependiente del modo |
| MAP-002 | Abra Mapa básico; siga el texto “navegue… haga clic” | Esperado: consultar detección/capa. Observado: solo territorio SVG recibe clic | Confusión, especialmente en fallback | Chromium sin WebGL2 | Copy compartido con modos no equivalentes | Explicar capacidades del modo básico |
| DATA-001 | Abra ficha ANLA/ANH con fecha | Esperado: fecha humana. Observado: valor epoch de 12/13 dígitos | Ficha ilegible y riesgo de cita errónea | Shards/popup | Falta normalización al generar o renderizar | Formatear/validar fecha según fuente |
| DATA-002 | Abra título ANM cuyo `estado` sea fecha | Esperado: estado administrativo. Observado: fecha/hora | Atributo semánticamente falso | ANM popup/datos | Mapeo de columna de origen | Revisar esquema y rotulado |
| DATA-003 | Compare total público con filas del dataset | Esperado: alcance publicado explícito. Observado: 23.542 de 33.788 sin explicación visible | Comparaciones externas pueden parecer contradictorias | Página/dataset | Copy metodológico incompleto | Documentar universo sin exponer A/B |
| UX-001 | Abra Cobertura | Esperado: nombres de familia. Observado: 1–5 | Filtro indescifrable para no especialistas | Selector | Se usa `level1`, que contiene código | Mostrar código más denominación |
| UX-002 | Abra la página o compártala | Esperado: detecciones IDEAM. Observado: título “Episodios...” | Desalineación conceptual y SEO | Metadata Next | Copy heredado | Alinear metadatos con interfaz pública |
| UX-003 | Intente abrir la metodología indicada al pie | Esperado: destino navegable. Observado: texto no enlazado y 404 | No hay ruta verificable a métodos | Footer/Pages | Ruta documental no publicada | Publicar/enlazar destino real |
| PERF-001 | Cargue la página sin caché | Esperado: payload inicial contenido. Observado: chunk 1,90 MB gzip | Mayor tiempo/CPU/datos, sobre todo móvil | Bundle cliente | Datos/mapa importados estáticamente | Separar carga y medir presupuesto |
| QA-001 | Revise tests y triggers; haga push directo a main | Esperado: E2E/mapa antes de desplegar. Observado: regex/unitarios; Pages no ejecuta `npm test` | Regresiones funcionales pueden publicarse | Workflows/tests | Cobertura y triggers incompletos | Añadir gates E2E en fase posterior |
| A11Y-001 | Navegue solo con Tab y trate de seleccionar mapa | Esperado: alternativa de teclado. Observado: paths no enfocables/canvas oculto | Usuarios de teclado excluidos | Mapa básico | Sin roles/tabindex/alternativa | Proveer operación y equivalente accesible |
| SEC-001 | Ejecute `npm audit --omit=dev` | Esperado: sin altos. Observado: cinco paquetes altos | Riesgo de mantenimiento; explotabilidad variable | Lockfile | Versiones actuales vulnerables | Evaluar advisories y actualizar con pruebas |
| MAP-003 | Superponga varias capas y haga clic | Esperado: identificar todas o elegir. Observado: solo `[0]` | Entidad consultada puede ser arbitraria | MapLibre | Selección del primer feature | Presentar coincidencias o prioridad explícita |
| MAP-004 | Repita clic en solapamiento | Esperado: saber qué capa/feature ganó. Observado: popup único sin alternativas | Baja trazabilidad SIG | Popup | Diseño de consulta singular | Informar coincidencias y capa activa |
| DATA-004 | Compare total con rankings/cobertura | Esperado: categoría “sin asignar”. Observado: 22/25 no aislables | Subtotales visibles no reconcilian fácilmente | Filtros/ranking | Opciones omiten nulos | Exponer/explicar no asignados |
| DATA-005 | Abra detección y lea Confianza | Esperado: escala y significado. Observado: número solo | Riesgo de comparar sensores indebidamente | Popup | Falta contexto de metadato | Añadir definición breve/metodología |
| UX-004 | Cree combinación de cero resultados | Esperado: estado vacío explícito. Observado: ejes 0–4 y ranking vacío | Puede parecer fallo de carga | Gráficos | Sin empty state | Mostrar mensaje sin resultados |
| UX-005 | Compare filtros ANLA | Esperado: aclarar simultaneidad. Observado: evaluación/licenciado se solapan | Sumas parecen erróneas | Filtros | Bitmask multietiqueta no explicado | Indicar que no son excluyentes |
| CART-001 | Observe clusters | Esperado: explicar número/tamaño/color. Observado: sin leyenda | Simbología puede interpretarse como intensidad | Geovisor | Leyenda incompleta | Añadir clave cartográfica breve |
| CART-002 | Abra mapa básico nacional | Esperado: patrón legible. Observado: fuerte solapamiento | Oculta densidades locales | Mapa básico | Todos los puntos simultáneos | Revisar generalización en fase posterior |
| CART-003 | Active ANLA y lea leyenda | Esperado: distinguir estados/geometrías. Observado: sin explicación específica | Lectura temática incompleta | Leyenda/capas | Controles no documentan estilo | Alinear simbología y leyenda |
| PERF-002 | Solicite tile IDEAM de muestra | Esperado: latencia estable. Observado: 14,99 s una vez | Cobertura puede tardar o parecer vacía | Servicio externo | Latencia ajena/intermitente | Medir múltiples muestras y mostrar estado |
| TECH-001 | Cargue/build | Esperado: sin warnings. Observado: `width(-1)/height(-1)` | Señal de render inicial inestable | Recharts | ResponsiveContainer durante prerender | Aislar condiciones de tamaño |
| A11Y-002 | Calcule contraste del texto `#7a857e` | Esperado: ≥4,5:1. Observado: 3,83:1 | Lectura difícil | Footer/detalles | Token demasiado claro | Ajustar token en fase posterior |
| A11Y-003 | Inspeccione botones/gráficos con accesibilidad | Esperado: estado/nombre. Observado: clase visual y `role=application` genérico | Estado no anunciado | React/Recharts | ARIA incompleto | Añadir estado y alternativa textual |
| A11Y-004 | Mida controles | Esperado: target cómodo. Observado: 25–29 px | Error táctil | Capas/MapLibre | Dimensiones compactas | Llevar targets hacia 44×44 |
| RESP-001 | Revise CSS bajo 640 px | Esperado: espacio suficiente. Observado: mapa 450 px/panel 185 px | Riesgo de oclusión | CSS móvil | Valores fijos | Validar en dispositivos antes de clasificar |
| TECH-002 | Solicite icono declarado | Esperado: 200. Observado: raíz 404; basePath 200 | Favicon ausente/petición fallida | Metadata/Pages | URL absoluta incorrecta | Hacer URL compatible con basePath |
| UX-006 | Aplique filtros y copie URL | Esperado: reproducir análisis. Observado: URL sin estado/exportación | Limita colaboración periodística | Estado React | No hay serialización | Considerar URL/exportación después |
| TECH-003 | Compare componentes de geovisor | Esperado: una implementación canónica. Observado: legado de 746 líneas | Riesgo de editar archivo equivocado | Repositorio | Migración incompleta | Declarar/retirar legado con pruebas futuras |

# 18. Elementos que funcionan correctamente

- La interfaz pública mantiene detecciones individuales como objeto principal; no expone episodios ni A/B.
- El aviso diferencia detección térmica, incendio confirmado y causalidad.
- Tarjetas, ranking y serie temporal fueron coherentes en filtros con muchos, pocos y cero registros.
- Restablecer filtros recupera el estado inicial.
- Departamento y municipio están encadenados correctamente; la selección del mapa básico sincroniza el selector.
- Las particiones RUNAP, ANM, ANLA y ANH coinciden con el dataset.
- Día/mes y tooltips de ambos gráficos funcionan.
- Activar una capa contextual cambia automáticamente a Contexto; al apagar la última vuelve a Territorio.
- El geovisor detecta ausencia de WebGL2 y ofrece un fallback en lugar de fallar silenciosamente.
- El código consulta solo capas contextuales visibles.
- PMTiles soporta Range y las fichas completas usan carga diferida por shard.
- Build, lint y 28 pruebas pasan; el último despliegue y actualización de datos fueron exitosos y corresponden al SHA auditado.

# 19. Riesgos

- **Técnicos:** bundle grande, dependencia IDEAM, advisories de dependencias, duplicación del geovisor y cobertura E2E insuficiente.
- **Metodológicos:** universo publicado y situaciones multietiqueta no explicados; confianza sin semántica.
- **Interpretativos:** “cerca/dentro” puede leerse como causalidad; códigos de cobertura y estados crudos inducen errores.
- **Mantenimiento:** CI no bloquea todos los despliegues con tests; metadatos y docs ya divergen de la interfaz.
- **Operación:** sin pruebas GPU/móviles/multinavegador no se puede afirmar estabilidad cartográfica completa.

# 20. Deuda técnica identificada

Importaciones estáticas pesadas, reconstrucción completa de GeoJSON en cambios de filtro, dos implementaciones de geovisor, catálogo de coberturas embebido en componente, tests basados principalmente en inspección de fuente/regex, metadatos heredados, ausencia de contrato validado para los atributos de contexto y falta de presupuesto de rendimiento/a11y automatizado. Se documenta la deuda; no se define todavía su orden de ejecución.

# 21. Pruebas que no pudieron realizarse

- Zoom, rueda, paneo, escala, atribución y rendimiento FPS/memoria de MapLibre.
- Expansión real de clusters, transición a puntos, puntos de borde y zoom profundo.
- Apertura/cierre consecutivo de detecciones y popups RUNAP/ANM/ANLA/ANH/cobertura.
- Resolución real de clicks superpuestos y fallos transitorios de tiles en navegador GPU.
- Viewports tablet/móvil, orientación, gestos táctiles y múltiples navegadores/dispositivos.
- Lectura completa con NVDA, JAWS, VoiceOver o TalkBack.
- Aplicación fiable del rango de fechas mediante automatización del control nativo.
- Pruebas prolongadas para fugas de memoria e intermitencia.

La causa principal fue la ausencia de WebGL2 y de emulación de viewport en el navegador remoto. No se transformaron estas limitaciones en defectos del producto.

# 22. Conclusión

El dashboard está operativo y ofrece una base analítica coherente, con varias decisiones técnicas acertadas. Su preparación actual es **beta pública funcional, todavía no lista para declararse estable**. Antes de una declaración de estabilidad debe cerrarse la validación MapLibre en entorno GPU/móvil y tratarse los hallazgos S2, especialmente consulta por clic, semántica de fichas, claridad del universo/coberturas, accesibilidad, payload y puertas de CI. La siguiente conversación puede usar este documento como checkpoint de entrada para la Fase B, sin reabrir la auditoría ni asumir que las recomendaciones preliminares constituyen ya una ruta.
