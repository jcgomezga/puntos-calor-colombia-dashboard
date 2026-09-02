# Fase 5 — Consolidación histórica y comparación temporal

## Estado

Fase cerrada y publicada.

## Objetivo

Consolidar el histórico acumulativo desde el 1 de julio de 2026 mediante resúmenes reproducibles por día y mes, diferenciando los escenarios de sensores A y B y evitando interpretar el mes vigente como un periodo completo.

## Alcance

1. Resumen diario nacional por escenario.
2. Resumen mensual nacional por escenario.
3. Conteos territoriales y de relaciones RUNAP, ANM, ANLA y ANH.
4. Cierre obligatorio contra el número de puntos de `dashboard.json`.
5. Selector interactivo `Días/Meses` en la evolución temporal.
6. Identificación visible del mes abierto.

La fase no crea episodios espacio-temporales. Esa tarea requiere aprobar previamente umbrales de distancia, tiempo, número mínimo de detecciones y reglas para fusiones retrospectivas.

## Contrato histórico

- Corte inclusivo: `2026-07-01`, hora de Colombia.
- Escenario A: todos los sensores admitidos.
- Escenario B: excluye Suomi-NPP.
- Mes abierto: mes que contiene la observación más reciente.
- Mes cerrado: cualquier mes anterior dentro del histórico.
- Unidad de conteo: `hotspot_id` único.
- Las relaciones múltiples no incrementan los indicadores históricos.

## Productos

- `scripts/build_historical_summaries.py`.
- `tests_py/test_build_historical_summaries.py`.
- `data/summaries/historical_daily.csv`.
- `data/summaries/historical_monthly.csv`.
- `public/data/history.json`.
- `data/metadata/history_latest_run.json`.
- Selector temporal diario/mensual en `app/page.tsx`.

## Resultado remoto definitivo

| Control | Resultado |
|---|---:|
| Hotspots escenario A | 31.353 |
| Hotspots escenario B | 21.930 |
| Fechas observadas | 64 |
| Filas diarias A+B | 128 |
| Meses observados | 3 |
| Filas mensuales A+B | 6 |
| Mes abierto | 2026-09 |
| Meses cerrados | 2026-07 y 2026-08 |

## Validaciones locales

- 43/43 pruebas Python aprobadas.
- 10/10 pruebas web aprobadas.
- ESLint aprobado.
- Compilación Vinext aprobada.
- Compilación estática Next.js para GitHub Pages aprobada.
- Cierre diario A = cierre mensual A = total del dashboard.
- Cierre diario B = cierre mensual B = total del escenario B.

## Cierre remoto

- Implementación: `2151923ad9e425c3b268e0f765a93673b4e289d2`.
- Workflow de datos: `33630346728`, correcto.
- Commit remoto de datos: `6986e07a98d558a6d1283bd542ef9b4d4eed68b9`.
- Despliegue final de GitHub Pages: `33630725203`, correcto.
- Las cifras remotas coincidieron con el cierre local; no ingresaron nuevas detecciones durante esta ejecución.

## Interpretación

Los conteos representan detecciones térmicas, no incendios confirmados ni superficie quemada. La comparación entre meses debe considerar que el mes marcado como abierto todavía no tiene la misma cobertura temporal que los meses cerrados.

## Próxima fase

La Fase 6 abordará episodios espacio-temporales. Antes de implementar deberá documentar y someter a aprobación los umbrales de distancia, ventana temporal, número mínimo de detecciones, tratamiento por sensor y reglas de fusión retrospectiva.
