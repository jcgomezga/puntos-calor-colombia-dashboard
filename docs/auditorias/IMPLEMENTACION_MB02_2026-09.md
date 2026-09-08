# Implementación MB-02 — contrato y calidad de fichas territoriales

**Fecha:** 8 de septiembre de 2026  
**Bloque:** MB-02 — contrato y calidad de fichas  
**Hallazgos tratados:** DATA-001 y DATA-002  
**Alcance excluido:** interacción MapLibre, simbología, prioridad de clic, rendimiento estructural y lógica espacial.

## 1. Problema

La auditoría integral detectó dos problemas de calidad en las fichas territoriales:

1. Las fechas de ANLA y ANH podían llegar al navegador como epoch de ArcGIS y mostrarse como números de 12–13 dígitos. Los campos de fecha de ANM también requieren un contrato explícito porque la fuente los publica como campos Date.
2. El atributo ANM `estado_exp`, aunque está declarado por el servicio oficial como campo de texto `ESTADO_EXP`, presentó en el corte auditado una mayoría de valores con apariencia de fecha. Mostrarlo como “Estado” convertía una inconsistencia de fuente/esquema en una afirmación administrativa potencialmente falsa.

La decisión de calidad es conservadora: **no se inventa ni infiere un estado ANM**. El atributo se conserva en los insumos de trazabilidad existentes, pero se omite de la ficha pública hasta que su semántica pueda reconciliarse con una fuente oficial fiable.

## 2. Contrato público v2

Se introduce `CONTEXT_DETAIL_CONTRACT_VERSION = 2`.

### Fechas

Los campos conocidos de fecha se normalizan a `YYYY-MM-DD`:

- RUNAP: `fecha_registro`, si existe.
- ANM: `fecha_inscripcion`, `fecha_terminacion`.
- ANLA: `fecha_acto`.
- ANH: `fecha_firma`.

El normalizador reconoce epoch en milisegundos, epoch en segundos y cadenas ISO/fecha. Si una cadena no puede interpretarse con seguridad, se conserva tal cual en vez de inventar una fecha.

### Estado ANM

Para `anm:*`, el contrato público fuerza `estado = ""`. El popup ya omite valores vacíos, de modo que el campo no se presenta como un estado administrativo.

El constructor enriquecido también deja de incorporar `estado_exp` en el PMTiles y en el catálogo detallado de futuras reconstrucciones.

## 3. Compatibilidad con el catálogo actual

No se reescribe manualmente en este bloque el archivo canónico grande `public/data/context-details.json`. En cada `predev`, `prebuild` y `prebuild:pages`, `scripts/shard-context-details.mjs` deriva los fragmentos públicos y aplica el contrato v2.

Esto permite corregir la publicación actual sin duplicar ni editar a mano un catálogo de decenas de miles de fichas. En la próxima reconstrucción reproducible mediante `build_context_tiles_enriched.py`, el catálogo canónico nuevo ya se generará normalizado.

El cargador del navegador aplica además una segunda defensa: normaliza los campos conocidos al recuperar una ficha y usa `?v=2` en la URL del fragmento. Así se evita que una caché anterior mantenga fichas epoch o el estado ANM problemático después del despliegue.

## 4. Fuente ANM verificada

El servicio oficial utilizado por el pipeline es:

`https://gisanm.anm.gov.co/server/rest/services/Hosted/Titulos_mineros/FeatureServer/0`

Su esquema declara:

- `fecha_insc`: `esriFieldTypeDate`.
- `fecha_term`: `esriFieldTypeDate`.
- `estado_exp`: `esriFieldTypeString`, alias `ESTADO_EXP`.

La existencia formal del campo no resuelve la anomalía observada en sus valores. Por ello no se reinterpretó ni renombró automáticamente.

## 5. Pruebas añadidas

`tests/context-detail-catalog.test.mjs` valida:

- epoch milisegundos → fecha ISO;
- epoch segundos → fecha ISO;
- cadenas ISO → fecha ISO;
- cadenas no interpretables → preservación del valor;
- omisión pública del estado ANM;
- normalización ANLA/ANH en futuras reconstrucciones;
- preservación del número de fichas al fragmentar;
- `contractVersion = 2` en shards y manifest;
- cache-busting v2 y saneamiento defensivo en el cargador del navegador.

## 6. Elementos protegidos

Este bloque no cambia:

- conteos de detecciones;
- filtros RUNAP/ANM/ANLA/ANH;
- relaciones espaciales;
- geometrías PMTiles publicadas en este PR;
- capas MapLibre;
- prioridad de clic;
- clustering;
- universo operativo de detecciones;
- exclusión pública de episodios y A/B.

## 7. Criterio de cierre

MB-02 puede cerrarse cuando lint, build, pruebas web, exportación GitHub Pages y verificación de activos aprueben en CI. La comprobación visual profunda de MapLibre permanece reservada para MB-07; para MB-02 basta confirmar posteriormente que una ficha ANLA/ANH muestra fechas legibles y que ANM no presenta un supuesto “Estado” derivado del atributo inconsistente.
