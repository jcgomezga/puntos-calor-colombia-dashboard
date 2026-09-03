# Fase 6B — Episodios operativos, identidad y linaje

Fecha de cierre técnico local: 2 de septiembre de 2026.

## Resultado

Se implementó la configuración aprobada: escenario B, distancia máxima de 1.000 m, ventana de 24 horas y mínimo tres detecciones. Los pares permanecen separados, las agrupaciones transitivamente extensas se marcan y ningún episodio se divide por límites administrativos.

| Resultado del backfill | Valor |
|---|---:|
| Hotspots evaluados, escenario B | 21.930 |
| Episodios preliminares | 1.881 |
| Hotspots en episodios | 10.975 |
| Pares candidatos | 2.027 |
| Hotspots en pares | 4.054 |
| Detecciones aisladas | 6.901 |
| Episodios encadenados | 16 |
| Hotspots encadenados | 1.013 |
| Grupos candidatos que cruzan municipios | 179 |
| Episodios robustos que cruzan municipios | 132 |

La suma `10.975 + 4.054 + 6.901` cierra en 21.930. Las 9.423 detecciones exclusivas del escenario A no se evalúan como episodios en esta versión.

## Identidad persistente

Un episodio nuevo obtiene un identificador determinista derivado de su miembro más antiguo y de la versión metodológica. En ejecuciones posteriores:

1. se calcula la superposición entre episodios anteriores y actuales;
2. la mayor superposición conserva el identificador previo;
3. fusiones, divisiones, creaciones y retiros se guardan en el archivo de linaje;
4. un cambio de versión metodológica exige reinicio explícito del estado.

La primera ejecución creó 1.881 identidades. Una segunda ejecución sin cambios produjo cero eventos de linaje, confirmando estabilidad.

## Integración

- El workflow ejecuta la agrupación después de los enriquecimientos territoriales, RUNAP, ANM, ANLA y ANH.
- El dashboard incorpora el filtro `Agrupación térmica` con episodio, par, aislada y encadenada.
- El indicador cuenta episodios únicos visibles bajo los filtros territoriales y temporales.
- La advertencia aclara que una agrupación no equivale a un incendio confirmado.

## Archivos

- `scripts/build_operational_episodes.py`
- `tests_py/test_build_operational_episodes.py`
- `data/episodes/episodes.csv`
- `data/episodes/hotspot_episode_membership.csv`
- `data/episodes/episode_state.json.gz`
- `data/episodes/episode_lineage.csv`
- `data/metadata/episodes_latest_run.json`
- `app/page.tsx`
- `tests/dashboard-data.test.mjs`

## Validación local

- 10/10 pruebas focalizadas Python aprobadas.
- 11/11 pruebas web aprobadas.
- `lint` aprobado.
- exportación estática aprobada.
- cierre cuantitativo y repetibilidad aprobados.

La publicación remota y sus identificadores de workflow se registrarán en el checkpoint una vez GitHub ejecute el flujo completo.
