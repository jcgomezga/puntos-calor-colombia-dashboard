# Diccionario de datos — versión 0.6.0

Los campos de ingesta quedaron congelados al finalizar la Fase 2 y los territoriales al finalizar la Fase 3.

| Campo normalizado | Tipo | Descripción | Regla inicial |
|---|---|---|---|
| `hotspot_id` | texto | Identificador reproducible | ID oficial o hash de atributos estables |
| `fecha_hora_col` | fecha-hora | Hora local de Colombia | Zona `America/Bogota` |
| `fecha_hora_utc` | fecha-hora | Instante UTC | ISO 8601 |
| `latitud` | decimal | Latitud WGS84 | Control inicial: −5 a 14 |
| `longitud` | decimal | Longitud WGS84 | Control inicial: −82 a −66 |
| `satelite` | texto | Plataforma satelital | Valor original normalizado |
| `sensor` | texto | Sensor o producto | MODIS/VIIRS según fuente |
| `frp` | decimal | Potencia radiativa | Mantener unidad de la fuente |
| `confianza` | texto/decimal | Confianza reportada | No homogeneizar sin regla |
| `escenario_a` | booleano | Incluido con todos los sensores | Verdadero para filas válidas |
| `escenario_b` | booleano | Incluido sin Suomi-NPP | Falso para plataforma SNPP |
| `dpto_codigo` | texto | Código DANE departamental | Unión espacial MGN 2025 |
| `departamento` | texto | Departamento oficial | Derivado de MGN 2025 |
| `mpio_codigo` | texto | Código DANE municipal | Unión espacial MGN 2025 |
| `municipio` | texto | Municipio oficial | Derivado de MGN 2025 |
| `asignacion_territorial` | texto | Estado del cruce espacial | `asignado`, `sin_asignacion` o estado de revisión |
| `metodo_asignacion_territorial` | texto | Procedimiento que resolvió el cruce | Caché geométrico o consulta exacta DANE |
| `fuente_archivo` | texto | Archivo de procedencia | Obligatorio |
| `fecha_descarga_utc` | fecha-hora | Momento de adquisición | Obligatorio |
| `cumple_corte_historico` | booleano | Indica si la observación pertenece al histórico admitido | Verdadero solo para fechas locales desde `2026-07-01`; las filas falsas no se almacenan |

## Campos congelados por la Fase 2

Las salidas mensuales contienen, en este orden: `hotspot_id`, `fecha_hora_col`, `fecha_hora_utc`, `fecha_local`, `latitud`, `longitud`, `fuente`, `satelite`, `sensor`, `temperatura_c`, `temperatura_alt_c`, `frp_mw`, `confianza`, `captura`, `scan_km`, `track_km`, `escenario_a`, `escenario_b`, `fuente_archivo` y `fecha_descarga_utc`.

`cumple_corte_historico` funciona como regla de admisión y no se escribe en las filas publicadas: toda fila almacenada debe cumplirla.

## Regla temporal transversal

La fecha de observación se evalúa en `America/Bogota`. El límite inferior es inclusivo: `2026-07-01 00:00:00`. La ingesta de la Fase 2 deberá aplicar este control antes de deduplicar, territorializar, resumir o publicar.

## Productos territoriales

- `data/territorial/hotspots_YYYY-MM.csv`: histórico mensual enriquecido.
- `public/data/dashboard.json`: índices, catálogos, puntos compactos y metadatos para la interfaz.
- `public/data/departments.json`: límites departamentales para visualización.
- `public/data/municipalities.json`: límites municipales simplificados para visualización.

El arreglo compacto de puntos usa el esquema declarado en `pointSchema`. Los índices territoriales `-1` identifican observaciones sin intersección oficial; no se fuerzan al polígono más cercano.

## Productos históricos

- `data/summaries/historical_daily.csv`: resumen nacional por fecha y escenario.
- `data/summaries/historical_monthly.csv`: resumen nacional por mes y escenario.
- `public/data/history.json`: versión compacta utilizada por la interfaz.
- `data/metadata/history_latest_run.json`: cierre de la última construcción.

Cada fila histórica contiene:

| Campo | Tipo | Descripción |
|---|---|---|
| `period` | fecha o mes | `AAAA-MM-DD` en el resumen diario y `AAAA-MM` en el mensual |
| `scenario` | texto | `A` para todos los sensores; `B` para el escenario sin Suomi-NPP |
| `status` | texto | Solo mensual: `closed` para meses anteriores y `open` para el mes de la observación más reciente |
| `hotspots` | entero | Detecciones únicas del periodo y escenario |
| `departments` | entero | Departamentos con al menos una detección territorialmente asignada |
| `municipalities` | entero | Municipios con al menos una detección territorialmente asignada |
| `runap` | entero | Hotspots dentro de áreas RUNAP |
| `mining` | entero | Hotspots dentro de títulos mineros vigentes |
| `anlaWithin5` | entero | Hotspots dentro o hasta 5 km de una entidad ANLA |
| `anhWithin5` | entero | Hotspots dentro o hasta 5 km de un área contractual asignada ANH |

Los valores espaciales cuentan hotspots únicos, no el número de relaciones individuales. Un mes `open` no debe compararse como si tuviera la misma cobertura temporal que un mes `closed`.

## Productos de episodios preliminares

- `data/episodes/episodes.csv`: una fila por episodio de tres o más detecciones.
- `data/episodes/hotspot_episode_membership.csv`: clasificación de cada hotspot del escenario B.
- `data/episodes/episode_state.json.gz`: estado persistente para conservar identidades entre ejecuciones.
- `data/episodes/episode_lineage.csv`: eventos auditables `created`, `merged`, `split` y `retired`.
- `data/metadata/episodes_latest_run.json`: cierre cuantitativo de la última ejecución.

La versión `episodes-b-1000m-24h-min3-v1` enlaza detecciones del escenario B que estén simultáneamente a un máximo de 1.000 m y 24 horas. Los componentes de tres o más miembros son episodios preliminares; los de dos son pares candidatos y los de uno, detecciones aisladas. La agrupación no se corta en límites municipales.

En `dashboard.json`, cada punto agrega `episodeClass` y `episodeIndex`. Los códigos de clase son: `-1` no evaluado por pertenecer solo al escenario A, `0` aislado, `1` par, `2` episodio y `3` episodio encadenado. `episodeIndex = -1` indica que la detección no pertenece a un episodio robusto.

Los episodios son inferencias espacio-temporales sobre anomalías térmicas. No confirman incendios, áreas quemadas ni causalidad.
