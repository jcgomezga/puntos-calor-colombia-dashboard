# Implementación MB-02 — contrato y calidad de fichas territoriales

**Fecha:** 8 de septiembre de 2026  
**Bloque:** MB-02 — contrato y calidad de fichas.  
**Hallazgos atendidos:** `DATA-001`, `DATA-002`.  
**Alcance:** normalización de valores publicados en fichas RUNAP/ANM/ANLA/ANH. No cambia geometrías, relaciones espaciales, conteos, filtros ni MapLibre.

## 1. Diagnóstico de partida

La auditoría integral confirmó dos defectos de datos de presentación:

- `DATA-001`: fechas ANLA/ANH podían llegar a la ficha como epoch ArcGIS de 12/13 dígitos.
- `DATA-002`: el atributo ANM `estado_exp`, aunque el servicio lo declara como texto y semánticamente corresponde al estado del expediente, contenía valores con forma de fecha en una parte mayoritaria de los registros auditados (7.066 de 9.277 valores no vacíos examinados).

La fuente operativa ANM permanece en esta fase en `Hosted/Titulos_mineros/FeatureServer/0`. Su esquema oficial declara `fecha_insc` y `fecha_term` como fechas y `estado_exp` como texto. Dado que la inconsistencia se encuentra en el contenido publicado, no se reasigna una fecha a un supuesto estado ni se inventa una clasificación administrativa.

## 2. Decisión de calidad

Se adopta un contrato de publicación defensivo:

1. Las fechas ArcGIS inequívocas se normalizan a `YYYY-MM-DD`.
2. Se aceptan epoch en segundos/milisegundos, `/Date(...)/` e ISO 8601.
3. Los formatos locales ambiguos se conservan sin reinterpretarlos.
4. Para ANM, si `estado` tiene forma de fecha, se publica vacío y la fila `Estado` no aparece en la ficha. Es preferible omitir un atributo dudoso antes que mostrar una fecha como si fuera un estado administrativo.
5. Si ANM entrega un estado textual válido, se conserva.
6. El catálogo canónico `context-details.json` mantiene el valor fuente para trazabilidad; la normalización se aplica en el contrato de publicación de shards y nuevamente en la carga diferida del navegador como defensa ante caché o artefactos anteriores.

## 3. Implementación

### `lib/context-detail-values.mjs`

Nuevo módulo puro y reutilizable con:

- `normalizeDateValue()`;
- `isDateLikeValue()`;
- `normalizeContextDetail()`.

### `scripts/shard-context-details.mjs`

Los shards publicados se generan ya normalizados. El manifiesto agrega dos contadores de control:

- `quality.normalizedDateFields`;
- `quality.suppressedAnmStateDates`.

Esto permite auditar en cada compilación cuántos valores fueron corregidos en la capa de publicación.

### `components/context-detail-catalog.ts`

La carga diferida vuelve a aplicar `normalizeContextDetail()` al registro solicitado. Esto evita que un shard antiguo almacenado en caché vuelva a mostrar epoch crudo o un estado ANM con forma de fecha.

## 4. Campos cubiertos

- **ANM:** `estado`, `fecha_inscripcion`, `fecha_terminacion`.
- **ANLA:** `fecha_acto`.
- **ANH:** `fecha_firma`.
- **RUNAP:** sin cambios.

## 5. Elementos expresamente no modificados

- geometrías PMTiles;
- universo de detecciones;
- relaciones RUNAP/ANM/ANLA/ANH;
- filtros y contadores;
- orden o prioridad de clic;
- estilos cartográficos;
- selección de fuente geométrica ANM.

Una eventual migración a otra capa ANM debe tratarse como cambio de fuente y someterse a una auditoría espacial independiente; no se mezcla con esta corrección semántica.

## 6. Pruebas añadidas

`tests/context-detail-values.test.mjs` verifica:

- epoch → ISO;
- `/Date(...)/` → ISO;
- ISO con hora → fecha;
- no reinterpretación de fechas locales ambiguas;
- detección de valores con forma de fecha;
- supresión fail-closed de `estado` ANM cuando parece fecha;
- conservación de estados ANM textuales válidos;
- normalización de fechas ANLA/ANH;
- ausencia de cambios en RUNAP;
- integración del mismo contrato en sharding y carga diferida.

## 7. Criterio de cierre

MB-02 puede cerrarse cuando lint, build Vite/Vinext, pruebas web y exportación GitHub Pages terminen correctamente y, tras publicación, una muestra de fichas confirme:

- ANLA/ANH sin epoch de 12/13 dígitos;
- ANM sin fechas mostradas bajo `Estado`;
- fechas ANM/ANLA/ANH legibles en `YYYY-MM-DD` cuando el origen sea inequívoco;
- ausencia de cambios en conteos o relaciones espaciales.
