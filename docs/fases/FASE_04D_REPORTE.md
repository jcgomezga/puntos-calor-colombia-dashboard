# Fase 4D — Relación con proyectos ANLA

## Estado del checkpoint

- Fecha: 2 de septiembre de 2026.
- Versión: 0.4.3.
- Estado: cerrada y publicada.
- Histórico: se conserva exclusivamente desde `2026-07-01`.

## Alcance ejecutado

1. Se auditaron y descargaron las cinco capas oficiales de proyectos ANLA.
2. Se mantuvieron separados los proyectos en evaluación y los licenciados.
3. Se conservaron por separado puntos, líneas y polígonos.
4. Las geometrías se obtuvieron en MAGNA-SIRGAS Origen Nacional (`EPSG:9377`) con simplificación máxima de 2 metros.
5. Los hotspots se proyectaron con una implementación Transverse Mercator contrastada contra el servicio geométrico oficial.
6. Se implementó un índice espacial Shapely y cálculo de distancia métrica.
7. Cada hotspot recibió una clase excluyente: `dentro`, `hasta_1_km`, `entre_1_y_5_km` o `mas_de_5_km`.
8. Se conservaron todas las relaciones hasta 5 km en una tabla detallada y se contaron hotspots únicos en los indicadores.
9. La interfaz incorporó filtros independientes por relación espacial y situación jurídica.

## Inventario de la fuente

| Capa | Situación | Geometría | Entidades |
|---:|---|---|---:|
| 1 | Evaluación | Línea | 465 |
| 2 | Evaluación | Polígono | 136 |
| 4 | Licenciado | Punto | 895 |
| 5 | Licenciado | Línea | 3.397 |
| 6 | Licenciado | Polígono | 5.195 |
|  | **Total oficial** |  | **10.088** |

Control de calidad geométrica:

- Geometrías utilizables: 10.044.
- Registros sin geometría: 44 —20 líneas y 24 polígonos licenciados—.
- Los registros sin geometría permanecen en el inventario de fuente, pero no se localizan ni se asignan artificialmente.

## Resultado nacional del backfill

| Clase mínima por hotspot | Hotspots únicos |
|---|---:|
| Dentro de polígono ANLA | 6.797 |
| Hasta 1 km | 3.344 |
| Entre 1 y 5 km | 7.093 |
| Más de 5 km | 14.091 |
| **Total cerrado** | **31.325** |

En total, 17.234 hotspots presentan al menos una relación hasta 5 km.

### Situación jurídica

| Relación | Hotspots únicos |
|---|---:|
| Con proyecto en evaluación | 786 |
| Con proyecto licenciado | 17.224 |
| Solo evaluación | 10 |
| Solo licenciado | 16.448 |
| Evaluación y licenciado simultáneamente | 776 |

Los indicadores `evaluación` y `licenciado` no deben sumarse: 776 hotspots pertenecen a ambos conjuntos.

## Tabla detallada

- Relaciones hotspot–geometría hasta 5 km: 120.595.
- Hotspots únicos relacionados: 17.234.
- Entidades geométricas ANLA distintas relacionadas: 5.964.
- Hotspots relacionados con más de una geometría: 12.533.

La tabla conserva `hotspot_id`, capa, identificador de entidad, expediente, proyecto, operador, sector, situación jurídica, tipo de geometría, acto administrativo, distancia y clase espacial.

## Controles aprobados

| Control | Resultado |
|---|---:|
| Pruebas Python | 33/33 |
| Pruebas web | 9/9 |
| ESLint | Correcto |
| Build estático | Correcto |
| Build GitHub Pages | Correcto |
| Proyección EPSG:9377 | Error máximo de contraste inferior a 1 mm |
| Cierre espacial | 31.325/31.325 |
| Tiempo del cruce con caché | Aproximadamente 13 segundos |
| Workflow de datos | `33600005206`, correcto |
| Despliegue inicial de interfaz | `33599185921`, correcto |
| Despliegue final con datos | `33600885234`, correcto |

## Automatización

- La descarga usa lotes de 100 y subdivisión automática ante fallos.
- Cinco solicitudes concurrentes como máximo reducen presión sobre el servicio ANLA.
- El caché geométrico se renueva cada 24 horas.
- El índice espacial se reconstruye en memoria durante cada ejecución.
- La tabla detallada y los campos resumidos se regeneran para mantener un cierre completo cuando cambia la geometría oficial.
- Shapely queda fijado en `requirements-data.txt` para reproducibilidad.

## Interpretación

`Dentro` solo se aplica a polígonos. Una coincidencia de distancia cero con un punto o una línea pertenece a `hasta_1_km`, porque esas geometrías no representan una superficie de pertenencia.

La intersección o proximidad entre una detección térmica y un proyecto ANLA no confirma incendio, afectación ambiental, funcionamiento de infraestructura, incumplimiento ni responsabilidad del operador. Tampoco equivale a una atribución causal. El resultado es una relación espacial de contexto.

## Continuidad

- Implementación remota: `adc6c9581817386b449c3c556e88142c1855725d`.
- Estabilización de consultas remotas: `7262a73a110fd880d9d38fc594de09e1af83274d`.
- Datos remotos: `4696435a230e691f28c862294517ba5f8c000b97`.
- Despliegue final de interfaz y datos: `33600885234`.
- Primera corrida remota `33599185898`: falló sin publicar datos parciales por timeout transitorio de conexión al iniciar la capa 6.
- Corrida remota definitiva: `33600005206`, correcta tras aplicar reintentos escalonados.
- La siguiente subfase será 4E: Mapa de Tierras ANH del 6 de agosto de 2026.
- Antes de implementar 4E se deberán separar contratos, áreas y categorías cartográficas sin actividad contractual.
