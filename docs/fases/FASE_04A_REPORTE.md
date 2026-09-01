# Fase 4A — Relación con áreas protegidas RUNAP

## Estado del checkpoint

- Fecha: 1 de septiembre de 2026.
- Versión objetivo: 0.4.0.
- Estado: motor e interfaz implementados y validados localmente; ejecución nacional remota pendiente de cierre.
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
| Publicación de cifras RUNAP | Bloqueada hasta cierre remoto |

## Riesgo y tratamiento

El servicio RUNAP no respondió dentro del tiempo disponible desde el entorno de trabajo. No se generaron cifras locales parciales. El código queda preparado para ejecutarse en GitHub Actions. El cierre solo podrá marcarse completo cuando `dentro + fuera` coincida con el total de hotspots, todos los puntos contengan el indicador binario y el workflow finalice correctamente.

## Próximo paso exacto

Publicar el motor, observar la ejecución automática y completar este informe con el número de áreas RUNAP, hotspots dentro/fuera, solapamientos, commit de datos y ejecución verificada. La cobertura del suelo queda como Fase 4B independiente.
