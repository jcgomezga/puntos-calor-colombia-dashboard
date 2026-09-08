# Priorización de la auditoría web integral — Dashboard nacional de detecciones térmicas

**Fecha:** 8 de septiembre de 2026  
**Fuente de auditoría:** `docs/auditorias/AUDITORIA_WEB_INTEGRAL_2026-09.md`  
**Fase:** B — priorización. No implementa correcciones.  
**Criterio operativo adicional aprobado:** primero se abordarán los ajustes no dependientes de la inspección visual profunda del geovisor; los ajustes específicamente cartográficos/MapLibre se ejecutarán al final y su validación visual será realizada por el usuario.

# 1. Resumen ejecutivo

La auditoría documentó 30 hallazgos: 12 S2, 15 S3 y 3 S4. No existen S0 ni S1. La priorización resultante tampoco identifica P0 bloqueantes: el portal es una beta pública funcional y los conteos/filtros principales son coherentes. Sin embargo, sí existen riesgos P1 que conviene resolver antes de declarar una versión estable.

La prioridad se concentra en cinco frentes: (1) corregir semántica y normalización de datos mostrados al público; (2) alinear metadatos, metodología y documentación con la arquitectura real de detecciones; (3) reducir riesgo de regresión mediante gates de calidad y revisar dependencias; (4) mejorar carga inicial y accesibilidad estructural; y (5) cerrar al final el modelo de interacción del geovisor, especialmente la prioridad de clic y las superposiciones.

La decisión de secuencia distingue **prioridad** de **orden de implementación**. `MAP-001` es P1 por impacto, pero se ejecutará en el bloque final de geovisor para que pueda validarse visualmente con WebGL2 por el usuario. En cambio, varios P2/P3 no cartográficos pueden resolverse antes porque son de bajo riesgo y mejoran de inmediato claridad, accesibilidad y consistencia.

# 2. Metodología de priorización

Se usó una escala 1–5 para los siguientes factores:

- **I — Impacto de usuario:** 1 marginal; 5 afecta una tarea principal o puede inducir una conclusión errónea.
- **F — Frecuencia/probabilidad:** 1 rara/hipotética; 5 ocurre de forma sistemática o en una ruta principal.
- **RI — Riesgo interpretativo:** 1 mínimo; 5 puede llevar a citar/interpretar datos de forma sustantivamente incorrecta.
- **RM — Riesgo metodológico:** 1 mínimo; 5 afecta el alcance o significado analítico comunicado.
- **RT — Riesgo técnico:** 1 cosmético; 5 compromete estabilidad, seguridad o mantenibilidad relevante.
- **A — Alcance:** 1 componente/caso raro; 5 afecta la experiencia completa o todas las sesiones.
- **E — Esfuerzo estimado:** 1 muy bajo; 5 alto/estructural.
- **C — Complejidad:** 1 localizada; 5 cruza arquitectura/datos/infraestructura.
- **RG — Riesgo de regresión:** 1 muy bajo; 5 alto.
- **B — Beneficio esperado:** 1 marginal; 5 mejora significativa y verificable.

La prioridad no se calcula mecánicamente con una suma. Se aplicó esta regla:

- **P0:** bloquea uso seguro/operación y requiere acción inmediata.
- **P1:** riesgo alto de interpretación, confiabilidad, seguridad, accesibilidad crítica, performance estructural o regresión.
- **P2:** problema importante que afecta claridad/UX/calidad, pero no bloquea el uso principal.
- **P3:** mejora posterior o deuda moderada; conviene resolver después de estabilizar P1/P2.
- **P4:** opcional o baja urgencia.

Cuando un hallazgo depende de validación WebGL2/móvil, se mantiene su prioridad intrínseca, pero se marca para el **bloque final de geovisor**.

# 3. Matriz maestra de los 30 hallazgos

| ID | S | P | I | F | RI | RM | RT | A | E | C | RG | B | Dependencia / causa raíz | Decisión |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| MAP-001 | S2 | **P1** | 5 | 4 | 4 | 2 | 3 | 4 | 3 | 3 | 4 | 5 | CR-07 | Resolver en bloque final geovisor; prioridad de clic debe respetar modo activo |
| MAP-002 | S2 | P2 | 3 | 3 | 2 | 1 | 1 | 3 | 1 | 1 | 1 | 4 | CR-08 | Ajustar copy/capacidades del fallback; implementación antes del bloque visual si no toca MapLibre |
| DATA-001 | S2 | **P1** | 5 | 5 | 5 | 3 | 2 | 4 | 2 | 2 | 2 | 5 | CR-02 | Normalizar/formatear fechas ANLA/ANH y validar contrato de atributos |
| DATA-002 | S2 | **P1** | 5 | 5 | 5 | 4 | 2 | 4 | 3 | 3 | 3 | 5 | CR-02 | Corregir mapeo/rotulado de `estado` ANM; no maquillar una columna semánticamente errónea |
| DATA-003 | S2 | **P1** | 4 | 5 | 5 | 5 | 1 | 5 | 1 | 1 | 1 | 5 | CR-03 | Explicar el universo operativo sin reintroducir A/B en interfaz |
| UX-001 | S2 | **P1** | 4 | 5 | 4 | 2 | 1 | 5 | 1 | 1 | 1 | 5 | CR-04 | Sustituir códigos 1–5 por código + denominación comprensible |
| UX-002 | S2 | **P1** | 4 | 5 | 3 | 3 | 1 | 5 | 1 | 1 | 1 | 5 | CR-01 | Alinear `<title>` y metadata con detecciones térmicas |
| UX-003 | S2 | **P1** | 4 | 5 | 4 | 4 | 1 | 5 | 2 | 2 | 2 | 5 | CR-01 | Publicar/enlazar metodología real; eliminar 404 documental |
| PERF-001 | S2 | **P1** | 4 | 5 | 1 | 1 | 4 | 5 | 5 | 5 | 4 | 5 | CR-05 | Reducir payload/carga inicial con medición y presupuesto; no optimizar a ciegas |
| QA-001 | S2 | **P1** | 5 | 5 | 3 | 3 | 5 | 5 | 4 | 4 | 3 | 5 | CR-06 | Añadir tests funcionales/E2E y gate antes de publicar |
| A11Y-001 | S2 | **P1** | 5 | 5 | 1 | 1 | 2 | 3 | 3 | 3 | 3 | 5 | CR-09 | Proveer operación/alternativa de teclado para selección cartográfica |
| SEC-001 | S2 | **P1** | 4 | 5 | 1 | 1 | 5 | 5 | 3 | 3 | 4 | 4 | CR-06 | Revisar advisories individualmente, actualizar de forma controlada y probar |
| MAP-003 | S3 | P2 | 4 | 3 | 4 | 2 | 2 | 3 | 3 | 3 | 4 | 4 | CR-07 | Resolver junto con MAP-004 al final del geovisor |
| MAP-004 | S3 | P2 | 3 | 3 | 4 | 2 | 1 | 3 | 2 | 2 | 3 | 4 | CR-07 | Mostrar capa/feature ganador y alternativas coincidentes |
| DATA-004 | S3 | P2 | 3 | 2 | 3 | 3 | 1 | 2 | 2 | 2 | 2 | 3 | CR-03 | Hacer reconciliables los nulos o explicarlos; no ocultarlos silenciosamente |
| DATA-005 | S3 | P2 | 4 | 5 | 4 | 4 | 1 | 4 | 1 | 1 | 1 | 5 | CR-03 | Añadir semántica/escala de confianza, con cautela entre sensores |
| UX-004 | S3 | P2 | 3 | 3 | 2 | 1 | 1 | 4 | 1 | 1 | 1 | 4 | CR-04 | Añadir estado vacío explícito en gráficos/ranking |
| UX-005 | S3 | P2 | 4 | 4 | 4 | 4 | 1 | 3 | 1 | 1 | 1 | 5 | CR-03 | Explicar que situación ANLA es multietiqueta/no excluyente |
| CART-001 | S3 | P2 | 3 | 5 | 3 | 2 | 1 | 4 | 1 | 1 | 1 | 4 | CR-10 | Añadir leyenda de clusters/tamaño en bloque geovisor final |
| CART-002 | S3 | P3 | 3 | 3 | 2 | 1 | 2 | 2 | 3 | 3 | 3 | 3 | CR-08 | Revisar generalización del mapa básico después de prioridades funcionales |
| CART-003 | S3 | P2 | 3 | 4 | 4 | 3 | 1 | 3 | 2 | 2 | 2 | 4 | CR-10 | Explicar estados/geometrías ANLA en leyenda; validar visualmente al final |
| PERF-002 | S3 | P3 | 3 | 2 | 1 | 1 | 3 | 3 | 3 | 3 | 2 | 3 | CR-11 | Medir varias muestras antes de diseñar fallback/estado de carga |
| TECH-001 | S3 | P2 | 3 | 5 | 1 | 1 | 3 | 4 | 2 | 2 | 2 | 4 | CR-05 | Eliminar warning Recharts y estabilizar condición de tamaño |
| A11Y-002 | S3 | P2 | 3 | 5 | 1 | 1 | 1 | 5 | 1 | 1 | 1 | 4 | CR-09 | Corregir token de contraste ≥4,5:1 para texto normal |
| A11Y-003 | S3 | P2 | 4 | 5 | 1 | 1 | 2 | 4 | 2 | 2 | 2 | 4 | CR-09 | Añadir `aria-pressed`, nombres y alternativa textual de gráficos |
| A11Y-004 | S3 | P2 | 4 | 4 | 1 | 1 | 1 | 4 | 2 | 2 | 2 | 4 | CR-09 | Aumentar targets táctiles; coordinar con validación móvil |
| RESP-001 | S3 | P3 | 3 | 2 | 1 | 1 | 2 | 3 | 2 | 2 | 2 | 3 | CR-09 | No corregir por hipótesis; validar primero en móvil real |
| TECH-002 | S4 | P2 | 2 | 5 | 1 | 1 | 1 | 5 | 1 | 1 | 1 | 3 | CR-01 | Quick win: favicon compatible con `basePath` |
| UX-006 | S4 | P4 | 2 | 2 | 1 | 1 | 1 | 2 | 4 | 3 | 3 | 3 | CR-12 | Diferir URL compartible/exportación hasta estabilizar núcleo |
| TECH-003 | S4 | P3 | 2 | 5 | 1 | 1 | 3 | 3 | 2 | 2 | 3 | 3 | CR-13 | Declarar implementación canónica y retirar legado con cobertura de pruebas |

# 4. P0

**Ninguno.** No se identificó un defecto que obligue a retirar el portal o impida su uso principal. La coherencia de filtros y conteos fue verificada.

# 5. P1 — alta prioridad

## P1 no geovisor: ejecutar primero

1. **DATA-001 — fechas ANLA/ANH crudas.** Riesgo directo de lectura/cita errónea.
2. **DATA-002 — estado ANM semánticamente incorrecto.** Es más grave que un simple formato: hay que auditar el esquema de origen.
3. **DATA-003 — universo operativo no explicado.** Debe aclararse sin reintroducir A/B en la UI.
4. **UX-001 — coberturas 1–5 opacas.** Alta frecuencia y esfuerzo muy bajo.
5. **UX-002 — metadata habla de episodios.** Inconsistencia conceptual/SEO fácil de corregir.
6. **UX-003 — metodología indicada pero inaccesible.** Debe existir un destino público real.
7. **QA-001 — ausencia de gate E2E/`npm test` antes de deploy.** Debe cerrarse antes de cambios de mayor riesgo.
8. **SEC-001 — advisories altos.** Requiere revisión individual, no un `npm audit fix --force` automático.
9. **PERF-001 — 1,90 MB gzip inicial.** Necesita refactor medido; no es quick win.
10. **A11Y-001 — mapa no operable por teclado.** Debe existir un equivalente funcional accesible.

## P1 geovisor: ejecutar al final

11. **MAP-001 — prioridad de clic.** El modo Contexto/Cobertura/Territorio debe prevalecer sobre detecciones cuando el usuario lo ha elegido. Se mantiene P1, pero su implementación y QA visual se desplazan al bloque final de geovisor por decisión de trabajo.

# 6. P2 — prioridad media

- MAP-002, MAP-003, MAP-004.
- DATA-004, DATA-005.
- UX-004, UX-005.
- CART-001, CART-003.
- TECH-001, TECH-002.
- A11Y-002, A11Y-003, A11Y-004.

Estos hallazgos deben resolverse antes de declarar una versión estable, pero pueden seguir a los P1. Varios son quick wins y conviene incorporarlos dentro del mismo cambio que ataque su causa raíz.

# 7. P3 — prioridad posterior

- CART-002 — saturación del mapa básico.
- PERF-002 — latencia IDEAM aún no reproducida con suficiente evidencia.
- RESP-001 — riesgo móvil pendiente de validación real.
- TECH-003 — geovisor legado duplicado.

# 8. P4 — opcional

- UX-006 — URL compartible/exportación del estado de filtros.

Es valioso para investigación/periodismo, pero no debe competir con semántica de datos, accesibilidad, QA, rendimiento o confiabilidad del geovisor.

# 9. Causas raíz / clústeres de problemas

## CR-01 — Desalineación entre arquitectura pública actual y metadata/documentación

**Afecta:** UX-002, UX-003, TECH-002.  
**Descripción:** la UI migró a detecciones, pero metadata, rutas documentales y algunos assets conservan supuestos de etapas anteriores o no consideran `basePath`.  
**Tratamiento:** una corrección coordinada de metadata, enlaces públicos y URLs de assets puede cerrar varios defectos a la vez.

## CR-02 — Contrato de atributos de contexto no normalizado

**Afecta:** DATA-001, DATA-002.  
**Descripción:** la capa de presentación recibe fechas/estados con semántica heterogénea por fuente.  
**Tratamiento:** definir contrato por institución (tipo, formato, etiqueta, nulos, enlaces) y validar antes de renderizar. No resolver únicamente con `String(...)` o formateo superficial.

## CR-03 — Transparencia metodológica insuficiente en variables públicas

**Afecta:** DATA-003, DATA-004, DATA-005, UX-005.  
**Descripción:** el cálculo es coherente, pero el alcance del universo, nulos, confianza y multietiquetas no se explican.  
**Tratamiento:** microcopy + metodología pública verificable, evitando exponer complejidad A/B en el portal principal.

## CR-04 — Semántica de filtros/estados incompleta

**Afecta:** UX-001, UX-004.  
**Descripción:** filtros funcionan, pero algunas etiquetas y estados vacíos no explican qué ocurre.  
**Tratamiento:** nombres humanos y estados vacíos explícitos.

## CR-05 — Carga/render cliente pesado

**Afecta:** PERF-001, TECH-001.  
**Descripción:** importaciones estáticas y render inicial de componentes grandes elevan payload y producen warnings.  
**Tratamiento:** perfilado, separación de carga y condiciones de tamaño antes de render; establecer presupuesto de bundle.

## CR-06 — Gobernanza de calidad/dependencias insuficiente

**Afecta:** QA-001, SEC-001.  
**Descripción:** el despliegue no está completamente protegido por pruebas funcionales y existen advisories altos.  
**Tratamiento:** gate reproducible antes de cambios estructurales; actualización de dependencias con CI y smoke tests.

## CR-07 — Modelo de consulta geoespacial singular y prioridad fija

**Afecta:** MAP-001, MAP-003, MAP-004.  
**Descripción:** el handler privilegia detecciones y luego reduce múltiples coincidencias a un único feature.  
**Tratamiento:** rediseñar consulta según `queryMode`, obtener todas las coincidencias visibles relevantes y ofrecer prioridad/selector explícito. **Bloque final de geovisor.**

## CR-08 — Fallback cartográfico no equivalente al geovisor

**Afecta:** MAP-002, CART-002.  
**Descripción:** el modo básico cumple como fallback territorial, pero el copy y densidad de puntos sugieren capacidades/legibilidad superiores.  
**Tratamiento:** declarar sus capacidades reales y posteriormente revisar generalización.

## CR-09 — Accesibilidad y responsive no tratados como contrato transversal

**Afecta:** A11Y-001, A11Y-002, A11Y-003, A11Y-004, RESP-001.  
**Descripción:** semántica, contraste, targets y móvil se resolvieron de forma parcial, no como requisito de aceptación.  
**Tratamiento:** introducir criterios a11y/responsive verificables y validación humana móvil.

## CR-10 — Leyenda cartográfica incompleta

**Afecta:** CART-001, CART-003.  
**Descripción:** algunas variables visuales no tienen explicación suficiente.  
**Tratamiento:** completar leyenda después de estabilizar interacción MapLibre; validación visual por usuario.

## CR-11 — Dependencia externa IDEAM sin observabilidad suficiente

**Afecta:** PERF-002.  
**Descripción:** una muestra lenta no permite afirmar un problema permanente.  
**Tratamiento:** medir varias sesiones/tiles antes de añadir fallbacks complejos.

## CR-12 — Estado React no serializado

**Afecta:** UX-006.  
**Descripción:** filtros no se comparten por URL ni exportación.  
**Tratamiento:** diferir hasta fase posterior.

## CR-13 — Migración incompleta / componente legado

**Afecta:** TECH-003.  
**Descripción:** coexistencia de implementación pública y legado aumenta riesgo de editar el archivo incorrecto.  
**Tratamiento:** retirar solo cuando tests cubran la implementación canónica.

# 10. Dependencias

## Dependencias estrictas

- **QA-001 → PERF-001 / SEC-001 / TECH-003:** antes de refactors o upgrades de dependencias conviene tener gates funcionales suficientes.
- **CR-02 contrato de atributos → DATA-001 y DATA-002:** no conviene parchear cada campo sin acordar semántica por fuente.
- **MAP-001 → MAP-003/MAP-004:** primero definir la prioridad por modo; después resolver múltiples features coincidentes.
- **Validación WebGL2 por usuario → cierre de MAP-001/MAP-003/MAP-004/CART-001/CART-003:** el código puede probarse automáticamente, pero el cierre visual requiere la inspección acordada.

## Dependencias recomendadas

- UX-002 + UX-003 + TECH-002 en un mismo bloque de alineación pública.
- DATA-003 + DATA-005 + UX-005 + DATA-004 en un mismo bloque de transparencia metodológica.
- A11Y-002 + A11Y-003 + A11Y-004 juntos; A11Y-001 puede requerir una solución más estructural.
- TECH-001 conviene resolver antes de medir de nuevo PERF-001.
- RESP-001 debe validarse después de aumentar targets táctiles, no antes.

## Independientes / quick fixes

- UX-001.
- UX-004.
- TECH-002.
- UX-002.
- A11Y-002.

# 11. Quick wins

Ordenados por relación impacto/esfuerzo:

1. **UX-002:** metadata pública de detecciones, no episodios.
2. **UX-001:** nombres comprensibles de cobertura.
3. **UX-004:** estado explícito “Sin resultados”.
4. **TECH-002:** favicon compatible con `basePath`.
5. **A11Y-002:** corregir token de contraste.
6. **UX-005:** aclarar multietiqueta ANLA.
7. **DATA-003:** añadir explicación breve del universo operativo.
8. **DATA-005:** contextualizar “Confianza”.
9. **MAP-002:** copy específico para Mapa básico, sin prometer capas/popups inexistentes.

DATA-001 parece pequeño visualmente, pero no se clasifica como quick win puro hasta validar el contrato de tipos de fecha de las fuentes.

# 12. Cambios estructurales / de alto riesgo

## PERF-001

Puede requerir cambiar importaciones estáticas, partición del dataset, lazy loading o arquitectura cliente. Riesgo de afectar filtros y sincronización del mapa. Requiere baseline de bundle y pruebas de regresión.

## QA-001

Añadir E2E y gates afecta pipelines de publicación. Debe diseñarse para no generar falsos negativos por servicios externos o WebGL2 en CI.

## SEC-001

No aplicar actualizaciones forzadas. Algunas vulnerabilidades pueden no ser explotables en exportación estática, pero la actualización puede romper Next/Vite/MapLibre. Evaluar advisory por advisory.

## A11Y-001

La interacción cartográfica accesible puede necesitar un equivalente no visual/listado territorial, no solo `tabIndex` en miles de geometrías.

## CR-02 / DATA-002

Cambiar significado de campos ANM puede requerir reconstruir catálogo/shards, no solo modificar el popup.

## CR-07 / MAP-001-003-004

Cambiar el modelo de clic afecta hotspots, territorio, cobertura y contexto. Se implementará al final y se validará visualmente en Chrome/WebGL2 por el usuario.

# 13. Riesgos de implementación

- Corregir labels o metadatos sin actualizar tests puede reintroducir copy antiguo automáticamente.
- Cambiar esquema de fichas puede desincronizar PMTiles, manifest y shards.
- Optimizar bundle puede romper el `basePath` o lazy assets en GitHub Pages.
- Actualizar dependencias puede afectar worker MapLibre y build Vinext/Next.
- Aumentar targets en móvil puede ocluir el mapa si no se rediseña panel de capas.
- Cambiar prioridad de clic puede hacer imposible abrir detecciones si no se define claramente qué ocurre en cada `queryMode`.
- El servicio IDEAM es externo: las pruebas E2E no deben convertir su latencia temporal en fallo determinista del deploy.

# 14. Elementos protegidos contra regresión

Durante las fases de implementación deben conservarse explícitamente:

1. Detecciones individuales como objeto principal de la interfaz pública.
2. Episodios y A/B fuera del portal principal, conservados en backend/documentación para “Análisis detallado”.
3. Advertencia de que detección térmica ≠ incendio confirmado y relación espacial ≠ causalidad.
4. Coherencia actual de filtros y conteos RUNAP/ANM/ANLA/ANH.
5. Restablecimiento de filtros.
6. Encadenamiento departamento → municipio y sincronización con mapa básico.
7. Día/mes y tooltips de gráficos.
8. Cambio automático a Contexto al activar RUNAP/ANM/ANLA/ANH y retorno a Territorio al apagar la última capa.
9. Consulta únicamente de capas contextuales visibles.
10. Fallback ante ausencia de WebGL2.
11. PMTiles con HTTP Range y fichas completas por shards diferidos.
12. Publicación GitHub Pages con `basePath` correcto.

# 15. Macrobloques propuestos

Estos bloques no son todavía sprints; son agrupaciones para la Fase C.

## MB-01 — Claridad pública y metodología
DATA-003, DATA-004, DATA-005, UX-001, UX-002, UX-003, UX-005, TECH-002.

## MB-02 — Contrato y calidad de fichas
DATA-001, DATA-002.

## MB-03 — Calidad de entrega y seguridad
QA-001, SEC-001, TECH-003.

## MB-04 — Rendimiento y estabilidad frontend
PERF-001, TECH-001, PERF-002.

## MB-05 — Accesibilidad y responsive
A11Y-001, A11Y-002, A11Y-003, A11Y-004, RESP-001.

## MB-06 — Estados de interfaz
UX-004, MAP-002.

## MB-07 — Geovisor/cartografía final
MAP-001, MAP-003, MAP-004, CART-001, CART-002, CART-003.

## MB-08 — Funciones de investigación posteriores
UX-006.

# 16. Hallazgos que requieren decisión humana

1. **DATA-003 — alcance del universo operativo:** aprobar el texto público exacto. La recomendación es explicar que se aplica un criterio operativo de calidad sin mostrar un selector A/B.
2. **DATA-002 — ANM:** si la fuente no contiene un estado administrativo fiable, decidir si el campo se reemplaza por otro atributo verificable o se elimina de la ficha.
3. **UX-003 — destino “Metodología/Análisis detallado”:** decidir si se publica una página metodológica mínima ahora o si se enlaza temporalmente a documentación pública estable.
4. **A11Y-001:** elegir si el equivalente accesible del mapa será una lista/tabla sincronizada, además del mapa, en vez de intentar hacer miles de geometrías tabulables.
5. **PERF-001:** aprobar un objetivo de rendimiento/budget antes del refactor (p. ej., tamaño de chunk inicial y tiempo de interacción bajo una conexión de referencia).
6. **Geovisor:** el usuario realizará la validación visual final de los cambios MapLibre y móvil; no se cerrarán esos hallazgos solo con inspección de código.

# 17. Orden recomendado para la Fase C

Atendiendo la preferencia de trabajo acordada, la futura implementación debería ordenar los macrobloques así:

1. **MB-01 — claridad pública/metodología** (quick wins primero).
2. **MB-02 — contrato y calidad de fichas**.
3. **MB-03 — QA/seguridad**, antes de refactors mayores.
4. **MB-04 — rendimiento/estabilidad frontend**.
5. **MB-05 — accesibilidad/responsive**.
6. **MB-06 — estados de interfaz/fallback**.
7. **MB-07 — geovisor/cartografía**, al final, con inspección visual directa del usuario.
8. **MB-08 — compartir/exportar**, posterior.

Este orden no reduce la prioridad intrínseca de MAP-001; únicamente posterga su ejecución para concentrar la validación visual MapLibre en una única etapa controlada.

# 18. Conclusiones

La auditoría no muestra una aplicación rota, sino una beta funcional con deuda concreta. La estrategia más eficiente no es corregir los 30 hallazgos de uno en uno: 13 causas raíz permiten resolver varios simultáneamente. Los primeros cambios deberían ser de claridad, semántica de datos y gobernanza de calidad; los cambios de rendimiento y accesibilidad estructural deben venir después de mejorar los gates; y la interacción MapLibre debe concentrarse en un bloque final para que el usuario pueda verificarla visualmente de manera sistemática.

**Distribución final:** P0 = 0; P1 = 11; P2 = 14; P3 = 4; P4 = 1.

## Checkpoint para Fase C

> Continuar desde `docs/auditorias/PRIORIZACION_AUDITORIA_WEB_2026-09.md`. Construir la Fase C — Ruta de mejoras sin reabrir la auditoría. Mantener la secuencia aprobada: primero ajustes no geovisor (claridad/metodología → fichas → QA/seguridad → rendimiento → accesibilidad/responsive → estados de interfaz) y dejar MapLibre/cartografía para el bloque final, cuya validación visual realizará el usuario. No iniciar implementación hasta aprobar la ruta y las decisiones humanas pendientes.
