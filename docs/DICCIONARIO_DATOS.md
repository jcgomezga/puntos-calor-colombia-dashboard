# Diccionario de datos — versión 0.2.0

Los campos de ingesta quedaron congelados al finalizar la Fase 2. Los campos territoriales permanecen sujetos a la validación del esquema DANE en la Fase 3.

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
| `dpto_ccdgo` | texto | Código DANE departamental | Unión espacial MGN 2025 |
| `dpto_cnmbr` | texto | Departamento oficial | Derivado de MGN 2025 |
| `mpio_ccdgo` | texto | Código DANE municipal | Unión espacial MGN 2025 |
| `mpio_cnmbr` | texto | Municipio oficial | Derivado de MGN 2025 |
| `fuente_archivo` | texto | Archivo de procedencia | Obligatorio |
| `fecha_descarga_utc` | fecha-hora | Momento de adquisición | Obligatorio |
| `cumple_corte_historico` | booleano | Indica si la observación pertenece al histórico admitido | Verdadero solo para fechas locales desde `2026-07-01`; las filas falsas no se almacenan |

## Campos congelados por la Fase 2

Las salidas mensuales contienen, en este orden: `hotspot_id`, `fecha_hora_col`, `fecha_hora_utc`, `fecha_local`, `latitud`, `longitud`, `fuente`, `satelite`, `sensor`, `temperatura_c`, `temperatura_alt_c`, `frp_mw`, `confianza`, `captura`, `scan_km`, `track_km`, `escenario_a`, `escenario_b`, `fuente_archivo` y `fecha_descarga_utc`.

`cumple_corte_historico` funciona como regla de admisión y no se escribe en las filas publicadas: toda fila almacenada debe cumplirla.

## Regla temporal transversal

La fecha de observación se evalúa en `America/Bogota`. El límite inferior es inclusivo: `2026-07-01 00:00:00`. La ingesta de la Fase 2 deberá aplicar este control antes de deduplicar, territorializar, resumir o publicar.

## Datos demostrativos

Las cifras incrustadas actualmente en `app/page.tsx` son datos de interfaz. No deben exportarse, citarse ni interpretarse como observaciones del IDEAM.
