# Fase 4B — Cobertura de la tierra IDEAM 2024

## Estado del checkpoint

- Fecha: 1 de septiembre de 2026.
- Versión: 0.4.1.
- Estado: cerrada y publicada.
- Histórico: se conserva exclusivamente desde `2026-07-01`.

## Alcance ejecutado

1. Se auditó la capa nacional oficial de cobertura de la tierra IDEAM 2024 a escala 1:100.000.
2. Se implementó una asignación punto-en-polígono con consulta exacta de respaldo y sin forzar la cobertura más cercana.
3. Se creó `data/landcover/hotspot_landcover.csv`, persistente y clave por `hotspot_id`.
4. El primer backfill clasificó el histórico completo; las actualizaciones posteriores consultan únicamente identificadores nuevos.
5. Los CSV territoriales conservan código, leyenda, niveles CORINE 1 a 6, confiabilidad, insumo y apoyo.
6. `dashboard.json` incorpora `landCoverIndex`, catálogo de coberturas y cierre asignado/sin cobertura/solapamiento.
7. La interfaz incorpora filtro por nivel 1 e indicador de coberturas detalladas visibles.

## Controles aprobados

| Control | Resultado |
|---|---:|
| Pruebas Python | 20/20 |
| Pruebas web | 9/9 |
| ESLint | Correcto, sin advertencias |
| Compilación estática GitHub Pages | Correcta |
| Consulta puntual real al IDEAM | Correcta |
| Corte histórico | Se mantiene desde 2026-07-01 |
| Ejecución nacional | 31.322/31.322 detecciones clasificadas |
| Workflow de datos | `33566847202`, correcto |
| Despliegue GitHub Pages | Pendiente de registrar tras el cierre documental |

## Resultado nacional

| Resultado | Cantidad |
|---|---:|
| Hotspots con asignación simple | 31.289 |
| Hotspots con solapamiento | 3 |
| Hotspots sin cobertura poligonal | 30 |
| Hotspots con alguna cobertura | 31.292 |
| Clases detalladas presentes | 86 |
| Total cerrado | 31.322 |

La suma `asignación simple + solapamiento + sin cobertura` coincide exactamente con el histórico. Un solapamiento se cuenta una sola vez en el total de hotspots con cobertura.

## Rendimiento y actualización incremental

- El backfill inicial realizó 909 consultas por lotes y tardó 12 minutos y 11 segundos en la etapa de cobertura.
- La tabla persistente quedó publicada con los 31.322 `hotspot_id` procesados.
- Las siguientes ejecuciones no repiten este backfill: solo consultan detecciones cuyo identificador no esté en la tabla.
- La cobertura se vuelve a incorporar a los CSV territoriales y a `dashboard.json` en cada actualización.

## Interpretación

La clase asignada describe el contexto cartográfico IDEAM de 2024 en el punto de la detección. No representa el área quemada en 2026, no confirma un incendio y no prueba causalidad entre la cobertura y la anomalía térmica.

## Publicación y continuidad

- Commit de implementación: `812299d2b0c04505c3e3c6657f003b2ba3367aa1`.
- Commit remoto de datos: `856aa5b`.
- La vigencia, escala, metodología y URL oficial quedan expuestas en los metadatos del dashboard.
- La siguiente subfase debe definirse antes de incorporar otra capa temática nacional.
