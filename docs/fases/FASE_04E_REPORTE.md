# Fase 4E — Relaciones con áreas contractuales ANH

## Estado

Fase cerrada y publicada.

## Objetivo

Incorporar al dashboard nacional la relación espacial entre las detecciones IDEAM acumuladas desde el 1 de julio de 2026 y las áreas contractuales asignadas publicadas en el Mapa de Tierras de la ANH, sin confundir inventario cartográfico, proximidad, actividad ni causalidad.

## Fuente y selección

- Servicio oficial: `ANH_HISTORICOS1_EGDB/MapServer`.
- Descubrimiento: nombres con patrón `Tierras AAAA-MM-DD`.
- Capa vigente detectada: `Tierras 2026-08-06`, ID 18.
- Inventario: 480 entidades.
- Áreas asignadas incluidas: 455.
- Áreas reservadas excluidas del indicador: 22.
- Áreas disponibles excluidas del indicador: 3.
- Geometrías asignadas utilizables: 455; faltantes: 0.

El proceso descubre la fecha más reciente en cada ejecución. No supone que el mayor identificador de capa sea necesariamente el más reciente.

## Método espacial

1. Descarga las áreas en EPSG:9377 con una simplificación máxima registrada de 2 m.
2. Conserva únicamente `CLASIFICAC=ASIGNADA` para el análisis contractual.
3. Construye un índice espacial STRtree con Shapely.
4. Proyecta cada hotspot a EPSG:9377.
5. Conserva todas las relaciones hasta 5 km.
6. Resume cada hotspot mediante su relación mínima excluyente.
7. Escribe una tabla detallada por relación y agrega un código compacto al dashboard.

Clases del dashboard:

| Código | Clase | Regla |
|---:|---|---|
| 3 | Dentro | Distancia 0 respecto del polígono asignado |
| 2 | Hasta 1 km | Distancia mayor que 0 y hasta 1.000 m |
| 1 | Entre 1 y 5 km | Distancia mayor que 1.000 m y hasta 5.000 m |
| 0 | Más de 5 km | Sin relación conservada hasta 5.000 m |

## Resultados remotos definitivos

| Resultado | Conteo |
|---|---:|
| Hotspots procesados | 31.353 |
| Dentro de área asignada | 7.048 |
| Hasta 1 km | 977 |
| Entre 1 y 5 km | 3.297 |
| Más de 5 km | 20.031 |
| Hotspots únicos relacionados hasta 5 km | 11.322 |
| Relaciones individuales conservadas | 19.302 |
| Hotspots con múltiples relaciones | 5.191 |
| Áreas asignadas relacionadas | 348 |

Las cuatro clases excluyentes suman 31.353. Las 19.302 relaciones no deben compararse como si fueran hotspots únicos: una detección puede estar dentro o próxima a varias áreas.

## Productos

- `scripts/enrich_anh_contracts.py`: descarga, caché, cruce y enriquecimiento.
- `tests_py/test_enrich_anh_contracts.py`: pruebas de selección, exclusión, distancias, caché y reintentos.
- `data/anh/hotspot_contract_relations.csv`: relaciones individuales auditables.
- `data/boundaries/anh_tierras_join.json.gz`: caché geométrico comprimido.
- `data/boundaries/anh_tierras_metadata.json`: cierre de fuente.
- `data/metadata/anh_latest_run.json`: última ejecución.
- `public/data/dashboard.json`: clase ANH compacta y metadatos de cierre.
- `app/page.tsx`: filtro, indicador y cierre visibles.

## Validaciones locales

- 39/39 pruebas Python aprobadas.
- 9/9 pruebas web aprobadas.
- ESLint aprobado.
- Compilación Vinext aprobada.
- Compilación estática Next.js para GitHub Pages aprobada.
- Cierre de códigos ANH: 20.031 + 3.297 + 977 + 7.048 = 31.353.
- Workflow remoto de datos: `33626531985`, correcto.
- Commit remoto de datos: `192c1606b745258ec3b1330f9326b7596f2ef9d6`.
- Despliegue final de Pages: `33627042510`, correcto.

## Interpretación obligatoria

La relación indica intersección o proximidad cartográfica con un área asignada. No demuestra que el área estuviera operando en la fecha de la detección, que la anomalía sea un incendio, que exista afectación ambiental ni que haya causalidad atribuible a un operador o contrato.

## Cierre remoto

- Implementación: `697033f333ea90dd21ce265b8119b4793e541544`.
- Datos reproducidos por GitHub Actions: `192c1606b745258ec3b1330f9326b7596f2ef9d6`.
- La ejecución remota incorporó 28 detecciones posteriores a la prueba local; por eso sus cifras sustituyen la fotografía local inicial.
- Interfaz pública desplegada correctamente con el filtro y el indicador ANH.
