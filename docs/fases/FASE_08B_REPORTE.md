# Fase 8B — Polígonos territoriales de contexto

Inicio técnico: 7 de septiembre de 2026.

## Propósito

Incorporar al geovisor las geometrías oficiales ya descargadas para los cruces analíticos, sin sustituir ni alterar los datos, filtros, indicadores, episodios o resultados existentes. La entrega continúa aislada en la rama `feature/geovisor-fase-8a` y en el PR borrador.

## Alcance implementado

- áreas protegidas del Registro Único Nacional de Áreas Protegidas (RUNAP);
- títulos mineros vigentes de la Agencia Nacional de Minería (ANM);
- proyectos en evaluación y licenciados de la Autoridad Nacional de Licencias Ambientales (ANLA), incluidos polígonos, líneas y puntos según la geometría publicada;
- áreas contractuales asignadas de la Agencia Nacional de Hidrocarburos (ANH);
- controles independientes de visibilidad, simbología diferenciada y consulta de atributos mediante ventana emergente;
- selección explícita del objeto consultado: territorio DANE, cobertura IDEAM o capa de contexto;
- continuidad del mapa básico anterior como mecanismo de respaldo.

## Empaquetado vectorial

Las geometrías se convierten a un único archivo `public/data/context-layers.pmtiles` con cuatro capas internas. ANLA y ANH se reproyectan de EPSG:9377 a EPSG:4326 antes del teselado. El navegador solicita por rango únicamente el encabezado y las teselas necesarias para la extensión y el nivel de zoom visibles.

| Capa | Registros fuente | Objetos dibujables | Tratamiento visual |
|---|---:|---:|---|
| RUNAP | 1.909 | 1.909 | polígonos verdes |
| ANM | 10.658 | 10.656 | polígonos violetas |
| ANLA | 9.931 | 9.827 | polígonos, líneas y puntos azules/turquesa |
| ANH | 480 | 455 | polígonos ámbar; solo áreas asignadas |
| **Total visible** |  | **22.847** |  |

Los dos registros ANM y 104 registros ANLA que no llegan al archivo visual carecen de geometría dibujable en la fuente descargada. En ANH se excluyen 25 áreas disponibles o reservadas porque el alcance analítico vigente usa únicamente áreas asignadas. Los archivos fuente comprimidos y los resultados analíticos no se eliminan ni se modifican.

El archivo generado en esta revisión ocupa aproximadamente 74,7 MiB, por debajo del límite de archivo individual de GitHub. La carga no equivale a descargar el archivo completo: PMTiles usa solicitudes HTTP por rango.

## Automatización y trazabilidad

- `scripts/build_context_tiles.py` normaliza geometrías, reduce atributos a los necesarios para consulta y genera metadatos con conteos, tamaño y SHA-256.
- `requirements-tiles.txt` fija las versiones de Shapely y pyproj.
- `.github/workflows/build-context-tiles.yml` compila Tippecanoe desde el repositorio oficial en el commit fijado `4f2621186acfec33b63ddf636f665623c0fef2dd`.
- El flujo se limita a la rama piloto; su propio commit de salida no vuelve a dispararlo.

### Worker de MapLibre

MapLibre GL JS 6 usa un worker ES module independiente. En la previsualización Vite/Vinext, dejar que el empaquetador infiriera su URL produjo una ruta renombrada y una petición 404 al worker, con el efecto práctico de dejar el geovisor sin capas vectoriales.

La corrección se dejó explícita y reproducible:

- `scripts/copy-maplibre-worker.mjs` copia antes de desarrollo y compilación los archivos `maplibre-gl-worker.mjs` y `maplibre-gl-shared.mjs` desde la versión instalada de MapLibre a `public/maplibre/`;
- `components/geovisor-entry.tsx` fija la URL del worker en `./maplibre/maplibre-gl-worker.mjs`, una ruta relativa al sitio que funciona tanto en la previsualización Vite/Vinext como bajo el subdirectorio de GitHub Pages;
- `package.json` ejecuta la preparación en `predev`, `prebuild` y `prebuild:pages`;
- los archivos generados no se versionan y se regeneran siempre desde la dependencia instalada.

Esta estrategia sigue la recomendación de MapLibre para entornos Next/Turbopack de publicar juntos el worker y su módulo compartido cuando se usa una URL estable de mismo origen.

## Fuentes y herramientas

- [RUNAP — servicio oficial de Parques Nacionales Naturales](https://mapas.parquesnacionales.gov.co/arcgis/rest/services/pnn/runap/FeatureServer/0)
- [Títulos mineros vigentes — servicio oficial ANM](https://gisanm.anm.gov.co/server/rest/services/Hosted/Titulos_mineros/FeatureServer/0)
- [Proyectos ANLA — servicio oficial](https://portalsig.anla.gov.co/publico/rest/services/PROYECTOS_ANLA/ProyectosANLA/FeatureServer)
- [Mapa de Tierras — servicio oficial ANH](https://geovisor.anh.gov.co/server/rest/services/GEOVISOR_v32/ANH_HISTORICOS1_EGDB/MapServer)
- [Integración de PMTiles con MapLibre GL JS](https://docs.protomaps.com/pmtiles/maplibre)
- [MapLibre GL JS — instalación ESM y configuración del worker](https://maplibre.org/maplibre-gl-js/docs/)
- [Tippecanoe](https://github.com/felt/tippecanoe)

## Límites de interpretación

Estas capas ofrecen contexto espacial y consulta visual. No son una certificación jurídica, catastral o de vigencia en tiempo real; la fecha y procedencia de cada descarga quedan en `public/data/context-layers.json`. La coincidencia visual entre una detección y un polígono tampoco demuestra causalidad.

## Validación

- lint de la interfaz aprobado;
- compilación Vite/Vinext aprobada;
- 16 pruebas web aprobadas;
- exportación estática Next/GitHub Pages y TypeScript aprobadas;
- verificación de que `maplibre-gl-worker.mjs` y `maplibre-gl-shared.mjs` quedan tanto en `public/maplibre/` como en la salida `out/maplibre/`;
- 57 pruebas Python aprobadas, incluidas conversión de anillos ArcGIS con huecos y serialización GeoJSON;
- PMTiles v3 abierto y leído con la biblioteca cliente, con cuatro capas internas y niveles de zoom 3–14;
- tamaño, conteos y hash verificados contra el manifiesto generado;
- revisión supervisada del panel, los controles de contexto y el mapa básico de respaldo;
- formato determinista de la fecha de actualización, sin diferencias de hidratación entre servidor y navegador;
- mensaje localizado y acceso al respaldo cuando el navegador no dispone de WebGL2;
- GitHub Actions `Validar geovisor` aprobado contra el PR y la versión actual de `main`.

El navegador aislado usado para esta revisión no ofrece WebGL2, por lo que no permitió rasterizar directamente las capas MapLibre. La estructura del PMTiles, sus cuatro capas, atributos, conteos, worker y carga en ambas rutas de compilación sí quedaron verificados. La inspección visual final de los polígonos requiere un navegador con WebGL2 habilitado.

## Estado

Implementación lista para revisión en el PR borrador. No modifica `main` ni la versión pública de GitHub Pages. El paso siguiente es comprobar visualmente la rama desplegada o en una previsualización aislada antes de solicitar integración.
