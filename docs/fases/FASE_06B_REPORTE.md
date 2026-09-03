# Fase 6B — Episodios operativos, identidad y linaje

Fecha de cierre técnico y remoto: 2 de septiembre de 2026, hora de Colombia.

## Resultado

Se implementó la configuración aprobada: escenario B, distancia máxima de 1.000 m, ventana de 24 horas y mínimo tres detecciones. Los pares permanecen separados, las agrupaciones transitivamente extensas se marcan y ningún episodio se divide por límites administrativos.

| Resultado del backfill | Valor |
|---|---:|
| Hotspots evaluados, escenario B | 22.165 |
| Episodios preliminares | 1.901 |
| Hotspots en episodios | 11.052 |
| Pares candidatos | 2.050 |
| Hotspots en pares | 4.100 |
| Detecciones aisladas | 7.013 |
| Episodios encadenados | 16 |
| Hotspots encadenados | 1.013 |
| Grupos candidatos que cruzan municipios | 179 |
| Episodios robustos que cruzan municipios | 132 |

La suma `11.052 + 4.100 + 7.013` cierra en 22.165. Las 9.480 detecciones exclusivas del escenario A no se evalúan como episodios en esta versión.

## Identidad persistente

Un episodio nuevo obtiene un identificador determinista derivado de su miembro más antiguo y de la versión metodológica. En ejecuciones posteriores:

1. se calcula la superposición entre episodios anteriores y actuales;
2. la mayor superposición conserva el identificador previo;
3. fusiones, divisiones, creaciones y retiros se guardan en el archivo de linaje;
4. un cambio de versión metodológica exige reinicio explícito del estado.

La primera ejecución remota creó 1.901 identidades. Antes de publicar, el backfill local fue ejecutado dos veces sobre el corte anterior: la segunda ejecución produjo cero eventos de linaje, confirmando estabilidad.

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

- 10/10 pruebas focalizadas Python y 53/53 pruebas Python del workflow aprobadas.
- 11/11 pruebas web aprobadas.
- `lint` aprobado.
- exportación estática aprobada.
- cierre cuantitativo y repetibilidad aprobados.

## Publicación verificada

- Implementación: `5622fdf42fc53a45e4994063fdb431b6a60788e3`.
- Workflow integral: `33714704684`, correcto.
- Datos operativos: `015ff98a0be38ac554cc47265cb271595ef284f4`.
- GitHub Pages con datos de episodios: `33715137124`, correcto.
