# Fase 4D — Plan de implementación de proyectos ANLA

## Estado del checkpoint preparatorio

- Fecha: 2 de septiembre de 2026.
- Versión prevista: 0.4.3.
- Estado: fuente y metodología preparadas; implementación y publicación pendientes.
- Restricción vigente: conservar únicamente hotspots desde `2026-07-01`.

## Inventario oficial auditado

Servicio: `https://portalsig.anla.gov.co/publico/rest/services/PROYECTOS_ANLA/ProyectosANLA/FeatureServer`.

| Capa | Situación | Geometría | Registros auditados |
|---:|---|---|---:|
| 1 | En evaluación | Línea | 465 |
| 2 | En evaluación | Polígono | 136 |
| 4 | Licenciado | Punto | 895 |
| 5 | Licenciado | Línea | 3.397 |
| 6 | Licenciado | Polígono | 5.195 |
|  | **Total** |  | **10.088** |

El servicio admite 2.000 registros por respuesta. La implementación deberá consultar identificadores y descargar por lotes, sin asumir que una única respuesta contiene la capa completa.

## Regla espacial aprobada para implementar

1. Todas las distancias se calcularán en metros después de proyectar las geometrías a MAGNA-SIRGAS Origen Nacional (`EPSG:9377`).
2. Para polígonos se usarán cuatro clases excluyentes: `dentro`, `hasta_1_km`, `entre_1_y_5_km` y `mas_de_5_km`.
3. Para puntos y líneas se usarán: `hasta_1_km`, `entre_1_y_5_km` y `mas_de_5_km`. No se llamará `dentro` a una coincidencia con geometrías sin área.
4. El límite inferior está incluido: distancia cero a un punto o una línea pertenece a `hasta_1_km`.
5. Para cada hotspot se conservarán todas las relaciones hasta 5 km, pero los indicadores contarán hotspots únicos.
6. La clasificación resumida utilizará la relación mínima en este orden: `dentro` → `hasta_1_km` → `entre_1_y_5_km` → `mas_de_5_km`.
7. Los proyectos en evaluación y licenciados se mantendrán separados; no se presentarán como un único estado jurídico.

## Campos mínimos que se conservarán

- Identificador de capa y `objectid`/`globalid`.
- Expediente.
- Proyecto.
- Operador.
- Sector.
- Estado de trámite: evaluación o licenciado.
- Tipo de geometría: punto, línea o polígono.
- Acto administrativo, fecha y artículo cuando estén disponibles.
- Contrato, descripción, nomenclatura y observación cuando estén disponibles.
- Área o longitud cuando corresponda.
- Distancia mínima en metros y clase espacial.

## Salidas previstas

- Caché geométrico ANLA comprimido, con metadatos de procedencia y fecha de descarga.
- Tabla persistente de relaciones hotspot–proyecto hasta 5 km.
- Campos resumidos en los CSV mensuales por `hotspot_id`.
- Metadatos de cierre en `dashboard.json`.
- Filtro por situación jurídica, tipo de geometría y relación espacial.
- Indicadores separados para evaluación y licenciamiento.

## Pruebas obligatorias antes de publicar

1. Punto dentro, en el borde y fuera de un polígono.
2. Distancias exactas de 1 km y 5 km.
3. Distancia a punto y a línea sin utilizar el término `dentro`.
4. Conservación de múltiples proyectos relacionados con un mismo hotspot.
5. Conteo único del hotspot en indicadores.
6. Separación estricta entre evaluación y licenciado.
7. Cierre: todos los hotspots deben tener una clase resumida.
8. Persistencia del corte histórico desde julio de 2026.

## Trabajo reservado para la siguiente ventana

1. Implementar descarga paginada y caché de las 10.088 geometrías.
2. Implementar reproyección, índice espacial y cálculo de distancias.
3. Ejecutar el backfill nacional de 31.325 o más hotspots.
4. Integrar filtros, indicadores, mapa y metadatos.
5. Ejecutar pruebas, workflow remoto y verificación de GitHub Pages.

## Advertencia interpretativa

La intersección o proximidad entre una detección térmica y un proyecto ANLA no confirma un incendio, una afectación ambiental, el funcionamiento de infraestructura ni responsabilidad del operador. La relación es exclusivamente espacial y debe leerse junto con el tipo geométrico y la situación jurídica del proyecto.
