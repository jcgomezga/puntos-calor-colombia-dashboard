# Fase 4C — Relación con títulos mineros vigentes ANM

## Estado del checkpoint

- Fecha: 2 de septiembre de 2026.
- Versión: 0.4.2.
- Estado: cerrada y publicada.
- Histórico: se conserva exclusivamente desde `2026-07-01`.

## Alcance ejecutado

1. Se auditó la capa poligonal oficial `titulos_vigentes` de la Agencia Nacional de Minería.
2. Se implementó una relación punto-en-polígono estricta, sin buffers ni asignaciones por cercanía.
3. Se creó un caché comprimido de la geometría ANM y sus metadatos, renovable cada 24 horas.
4. Cada detección conserva el número de coincidencias y los expedientes, solicitantes, etapas y minerales relacionados.
5. `dashboard.json` incorpora el indicador nacional, el cierre dentro/fuera, los solapamientos y el número de títulos intersectados.
6. La interfaz incorpora filtro por relación con título minero e indicador de detecciones dentro de títulos vigentes.
7. ANM, ANLA y ANH se separaron en subfases porque sus geometrías y significados jurídicos no son equivalentes.

## Controles aprobados

| Control | Resultado |
|---|---:|
| Pruebas Python | 24/24 |
| Pruebas web | 9/9 |
| ESLint | Correcto, sin advertencias |
| Compilación estática GitHub Pages | Correcta |
| Consulta real ANM | 10.658/10.658 títulos descargados |
| Corte histórico | Se mantiene desde 2026-07-01 |
| Ejecución nacional | 31.325/31.325 detecciones clasificadas |
| Workflow de datos | `33574392331`, correcto |
| Commit remoto de datos | `cc11c0e8c512f20c1823ede26b91193c3fbe237f` |
| Despliegue GitHub Pages | `33575106562`, correcto |

## Resultado nacional

| Resultado | Cantidad |
|---|---:|
| Hotspots dentro de uno o más títulos | 5.786 |
| Hotspots fuera de títulos | 25.539 |
| Hotspots con títulos superpuestos | 324 |
| Títulos distintos intersectados | 848 |
| Títulos vigentes consultados | 10.658 |
| Total cerrado | 31.325 |

Los 324 solapamientos son un subconjunto de los 5.786 hotspots clasificados como `dentro`; no se suman nuevamente al total. Un hotspot se cuenta una sola vez en los indicadores aunque conserve todas sus relaciones para auditoría.

## Automatización y rendimiento

- El workflow descarga los identificadores ANM y obtiene las geometrías por lotes de 200, con concurrencia limitada.
- El caché `data/boundaries/anm_titles_join.geojson.gz` evita descargar más de diez mil polígonos cada tres horas.
- `data/boundaries/anm_titles_metadata.json` registra fuente, fecha de descarga y cantidad de entidades.
- El caché se renueva cuando supera 24 horas; los hotspots se reclasifican en cada actualización para mantener un cierre completo.
- La etapa ANM del primer workflow nacional tardó aproximadamente 27 segundos.

## Interpretación

La relación indica únicamente que la coordenada de una anomalía térmica intersecta la geometría cartográfica de un título minero vigente. No confirma un incendio, actividad minera en ese momento, responsabilidad del titular ni causalidad entre el título y la detección.

## Publicación y continuidad

- Commit de implementación remoto: `9714568c6d6102c260a1409bc7009dad9a02ec3f`.
- Workflow de datos validado: `33574392331`.
- Commit remoto de datos: `cc11c0e8c512f20c1823ede26b91193c3fbe237f`.
- Despliegue validado de interfaz, datos y checkpoint: `33575106562`.
- La siguiente subfase es 4D: proyectos ANLA, separando puntos, líneas y polígonos y definiendo previamente reglas de distancia reproducibles.
- La Fase 4E incorporará después el Mapa de Tierras ANH con categorías contractuales explícitas.
