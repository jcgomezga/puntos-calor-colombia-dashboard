# Gobernanza, alcance y continuidad

## Propósito

Construir un dashboard nacional de detecciones térmicas que funcione sin ArcGIS Online, pueda publicarse en GitHub Pages y actualice sus estadísticas cuando existan nuevos archivos oficiales del IDEAM.

## Principios obligatorios

1. **Separación de proyectos.** El repositorio nacional es independiente del análisis del Tolima.
2. **Dato antes que visualización.** Ninguna cifra se publica como oficial sin controles de ingestión, duplicados, geometría y cierre territorial.
3. **Dos escenarios.** Se conservan A (todos los sensores) y B (sin Suomi-NPP) hasta terminar la validación nacional.
4. **No causalidad.** Coincidencia espacial o detección térmica no equivale a incendio confirmado, causa ni actividad efectiva.
5. **Reproducibilidad.** Código, parámetros, fecha de corte, fuente y pruebas deben quedar versionados.
6. **Continuidad.** Cada fase termina con reporte y actualización de la matriz acumulativa.

## Fases

| Fase | Entregable | Criterio de cierre | Estado |
|---|---|---|---|
| 0 | Gobernanza, estructura y trazabilidad | Documentos base, matriz y estructura verificables | Cerrada |
| 1 | Prototipo interactivo | Filtros A/B y territoriales, tarjetas y gráficos; compilación limpia | Cerrada |
| 2 | Ingesta IDEAM | Descarga diaria, normalización, deduplicación y bitácora | Pendiente |
| 3 | Territorialización DANE | Unión espacial y cierres por departamento/municipio | Pendiente |
| 4 | Publicación | GitHub Pages, actualización programada y manual operativo | Pendiente |

## Regla de cierre de fase

Una fase solo se marca como cerrada cuando sus salidas existen, las validaciones se ejecutan, el reporte identifica decisiones y riesgos, y la matriz acumulativa se actualiza.

## Recuperación ante interrupciones

Para retomar el proyecto se debe leer, en este orden:

1. `README.md`;
2. `docs/MATRIZ_TRAZABILIDAD.csv`;
3. el último archivo de `docs/fases/`;
4. `docs/DECISIONES_METODOLOGICAS.md`;
5. los controles y pendientes indicados por la última fase.
