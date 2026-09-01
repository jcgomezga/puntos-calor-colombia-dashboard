# Fase 4A — Relación con áreas protegidas RUNAP

## Estado del checkpoint

- Fecha: 1 de septiembre de 2026.
- Versión: 0.4.0.
- Estado: cerrada y publicada.
- Histórico: se conserva exclusivamente desde `2026-07-01`.

## Alcance ejecutado

1. Se auditó el FeatureServer oficial de RUNAP de Parques Nacionales Naturales de Colombia.
2. Se implementó descarga por identificadores y caché GeoJSON comprimido.
3. Se añadió un índice espacial y relación punto-en-polígono.
4. Cada CSV territorial conserva indicador, número de relaciones, identificadores, nombres y categorías RUNAP.
5. `dashboard.json` incorpora `insideProtectedArea` y cierre dentro/fuera/solapamiento.
6. La interfaz incorpora filtro RUNAP e indicador de detecciones visibles dentro de áreas protegidas.
7. El flujo automático ejecutará esta relación después de la territorialización DANE.

## Controles aprobados

| Control | Resultado |
|---|---:|
| Pruebas Python | 16/16 |
| ESLint | Correcto |
| Compilación estática GitHub Pages | Correcta |
| Corte histórico | Se mantiene desde 2026-07-01 |
| Ejecución nacional | 30.910/30.910 detecciones clasificadas |
| Workflow de datos | `33545663965`, correcto |
| Despliegue GitHub Pages | `33546192024`, correcto |

## Resultado nacional

| Resultado | Cantidad |
|---|---:|
| Áreas protegidas RUNAP consultadas | 1.909 |
| Hotspots dentro de RUNAP | 2.028 |
| Hotspots fuera de RUNAP | 28.882 |
| Hotspots con más de una coincidencia | 4 |
| Total cerrado | 30.910 |

La suma `dentro + fuera` coincide exactamente con el histórico. Los cuatro solapamientos son un subconjunto de los 2.028 hotspots dentro; no se suman nuevamente al indicador.

El servicio RUNAP agotó el tiempo de espera desde el entorno local, pero respondió correctamente en GitHub Actions. El incidente queda cerrado sin haber desactivado validaciones ni fabricado cifras parciales.

## Publicación y continuidad

- Commit remoto de datos RUNAP: `6e1519ae6ac1c7dc92ff904ff2351ce25b850ca8`.
- El filtro permite mostrar todas las detecciones, únicamente las que intersectan RUNAP o únicamente las que quedan fuera.
- La actualización automática recalcula RUNAP después de cada territorialización DANE.
- La cobertura del suelo queda como Fase 4B independiente.
