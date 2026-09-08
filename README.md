# Episodios de detecciones térmicas Colombia · Dashboard

Dashboard nacional, abierto y reproducible para explorar **episodios algorítmicos de detecciones térmicas** publicadas por el IDEAM y su contexto territorial por departamento y municipio.

> Estado actual: **dashboard oficial procesado y automatizado**. El histórico se conserva desde el 1 de julio de 2026 y actualiza sus cruces con DANE, RUNAP, cobertura IDEAM, ANM, ANLA y ANH.

## Alcance

- Consulta territorial nacional por departamento y municipio.
- Una única configuración operacional pública de episodios: **escenario B, 1 km, 24 horas y mínimo 3 detecciones**.
- La sensibilidad histórica entre todos los sensores (A) y la exclusión de Suomi-NPP (B) se conserva de forma reproducible en metodología y backend, pero no se presenta como selector público.
- **Episodios de detecciones térmicas** como unidad principal de exploración.
- Detecciones individuales como capa secundaria, apagada por defecto y accesible para inspeccionar los miembros de un episodio.
- Estadísticas territoriales de episodios y series temporales auxiliares de detecciones individuales.
- Histórico acumulativo únicamente desde el 1 de julio de 2026.
- Actualización programada cada tres horas mediante GitHub Actions.
- Publicación mediante GitHub Pages, sin ArcGIS Online.

## Qué significa “episodio”

Un episodio es una **agrupación algorítmica de detecciones térmicas**. En la configuración operacional actual, dos detecciones pueden quedar conectadas cuando cumplen simultáneamente una distancia máxima de **1 km** y una separación temporal máxima de **24 horas**; los componentes conexos con **3 o más detecciones** se publican como episodios.

La conectividad es transitiva: si una detección A se conecta con B y B con C, las tres pueden pertenecer al mismo episodio aunque A y C no sean vecinas directas. Por eso el sistema conserva además una bandera de encadenamiento para agrupaciones que requieren lectura cautelosa.

**Un episodio no equivale a un incendio confirmado, no delimita una superficie quemada y no demuestra una causa.** Es una unidad analítica para organizar señales satelitales que luego pueden contrastarse con imágenes, reportes de campo u otras fuentes.

La selección de 1 km + 24 h + ≥3 fue precedida por una matriz de sensibilidad de 500 m, 1 km y 2 km combinada con 12 h, 24 h y 48 h. La comparación A/B posterior mostró que excluir Suomi-NPP modifica de manera importante el volumen de detecciones y episodios, pero mantiene relativamente estables las principales proporciones territoriales y rankings internos. Véanse [Fase 6A](docs/fases/FASE_06A_REPORTE.md), [Fase 6B](docs/fases/FASE_06B_REPORTE.md) y [Fase 6C](docs/fases/FASE_06C_REPORTE.md).

## Geovisor piloto

La rama `feature/geovisor-fase-8a` incorpora un motor MapLibre navegable con episodios como capa principal, límites DANE, coberturas IDEAM 2024 y geometrías consultables de RUNAP, ANM, ANLA y ANH. Las cuatro capas de contexto se publican como PMTiles y permanecen apagadas al iniciar para cuidar la legibilidad y el rendimiento. Las detecciones individuales también inician apagadas y pueden activarse desde el control de capas o desde la ficha de cada episodio. El mapa anterior sigue disponible como respaldo.

Las relaciones con RUNAP, ANM, ANLA o ANH son **relaciones espaciales o de proximidad**, según la regla de cada fuente. No constituyen evidencia de causalidad, responsabilidad ni origen del fuego.

## Política temporal

El corte histórico es inclusivo: `2026-07-01 00:00:00`, hora de Colombia (`America/Bogota`). El flujo de ingesta no conservará archivos ni detecciones anteriores y todas las estadísticas y filtros respetarán el mismo límite. Desde ese día, los registros válidos se conservarán de forma acumulativa.

## Ejecución local

```bash
npm ci
npm run dev
```

Validaciones:

```bash
npm run lint
npm run build
npm run build:pages
npm test
python -m unittest discover -s tests_py -p "test_*.py" -v
```

Reconstrucción opcional de las teselas territoriales, con Tippecanoe disponible en `PATH`:

```bash
python -m pip install --requirement requirements-tiles.txt
npm run build:context-tiles
```

## Actualización de datos

La Fase 2 incorporó un flujo reproducible con tres modalidades:

```bash
python scripts/update_ideam_data.py --mode backfill
python scripts/update_ideam_data.py --mode refresh
python scripts/update_ideam_data.py --mode offline
```

GitHub Actions ejecuta `refresh` cada tres horas, reprocesa la cadena espacial y reconstruye los resúmenes históricos. El primer `backfill` recuperó los archivos disponibles desde el 1 de julio de 2026; las ejecuciones posteriores acumulan registros válidos sin desplazar ese corte. Véanse el [contrato de ingesta](docs/CONTRATO_INGESTA_IDEAM.md), el [checkpoint actual](docs/CHECKPOINT_ACTUAL.md) y los [reportes por fase](docs/fases).

## Trazabilidad

- [Gobernanza y alcance](docs/00_GOBERNANZA_Y_ALCANCE.md)
- [Matriz acumulativa](docs/MATRIZ_TRAZABILIDAD.csv)
- [Fuentes](docs/FUENTES.md)
- [Diccionario de datos](docs/DICCIONARIO_DATOS.md)
- [Decisiones metodológicas](docs/DECISIONES_METODOLOGICAS.md)
- [Reportes por fase](docs/fases)

## Separación respecto del proyecto Tolima

Este repositorio no importa ni modifica `jcgomezga/incendios-tolima-2026`. El estudio de Tolima se usa únicamente como antecedente metodológico; el flujo nacional conserva sus propios controles, datos y versiones.
