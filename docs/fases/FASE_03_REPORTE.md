# Reporte de cierre — Fase 3

**Fecha:** 1 de septiembre de 2026  
**Versión:** 0.3.0  
**Estado:** cerrada y publicada

## Objetivo

Asignar el histórico nacional de detecciones del IDEAM a departamentos y municipios del Marco Geoestadístico Nacional 2025 del DANE, comprobar los cierres territoriales y sustituir todos los datos demostrativos del dashboard por datos oficiales procesados.

## Fuentes territoriales verificadas

| Capa DANE | ID | Entidades | Uso |
|---|---:|---:|---|
| Municipio | 317 | 1.122 | Unión espacial y catálogo municipal |
| Departamento | 319 | 33 | Visualización y catálogo departamental |

La unión usa EPSG:4326 y un caché municipal con tolerancia de `0.00005` grados. Los polígonos mostrados en pantalla tienen una simplificación mayor (`0.003` grados) que nunca se utiliza para asignar puntos.

## Resultado territorial publicado

La actualización remota cerrada a las 10:11 a. m. de Colombia contiene:

| Control | Resultado |
|---|---:|
| Periodo | 1 jul–1 sep 2026 |
| Detecciones nacionales | 30.910 |
| Escenario A | 30.910 |
| Escenario B sin Suomi-NPP | 21.618 |
| Asignadas a municipio | 30.883 |
| Sin intersección municipal DANE | 27 |
| En límite o solapamiento pendiente | 0 |
| Departamentos en catálogo | 33 |
| Municipios en catálogo | 1.122 |

El cierre verificado es:

```text
30.883 asignadas + 27 sin intersección = 30.910 observaciones
```

Los 27 registros sin intersección permanecen visibles en el total nacional, pero no se suman a un departamento o municipio. No se asignaron al polígono más cercano.

## Control de geometría simplificada

La primera ejecución local produjo 28 registros sin asignación. La consulta individual contra la geometría completa del servicio DANE mostró que uno correspondía a Támesis (Antioquia) y había quedado fuera por aproximadamente un metro debido a la simplificación del caché. El motor ahora verifica automáticamente contra el servicio oficial completo cualquier vacío inicial:

- una intersección exacta recupera el municipio;
- ninguna intersección conserva `sin_asignacion`;
- más de una intersección queda para revisión;
- un fallo del servicio detiene la ejecución en vez de inventar una asignación.

## Productos generados

- `data/boundaries/mgn2025_municipios_join.geojson.gz`;
- `data/boundaries/mgn2025_metadata.json`;
- `data/territorial/hotspots_YYYY-MM.csv`;
- `data/metadata/territorial_latest_run.json`;
- `public/data/dashboard.json`;
- `public/data/departments.json`;
- `public/data/municipalities.json`;
- `scripts/territorialize_hotspots.py`;
- `components/dashboard-map.tsx`.

## Dashboard conectado

La interfaz publicada permite:

- seleccionar fecha inicial y final desde el 1 de julio de 2026;
- alternar los escenarios A y B;
- filtrar por los 33 departamentos;
- habilitar y filtrar los 1.122 municipios según el departamento;
- seleccionar territorios directamente sobre el mapa;
- recalcular indicadores de detecciones, departamentos, municipios y fuentes;
- recalcular el ranking territorial y la serie diaria;
- dibujar hasta el histórico completo en un lienzo optimizado sin convertir cada punto en un elemento del DOM;
- mostrar la hora real de generación y el cierre territorial.

La prueba pública del filtro Tolima devolvió 2.010 detecciones del escenario B, 45 municipios con detecciones y un ranking encabezado por Ortega y San Luis. Estas cifras son dinámicas y cambiarán con las actualizaciones del IDEAM.

## Verificaciones

| Control | Resultado |
|---|---|
| Pruebas Python | 13 aprobadas |
| Pruebas web | 9 aprobadas |
| ESLint | Correcto |
| Build Vinext | Correcto |
| Build estático GitHub Pages | Correcto |
| Cierre nacional | 30.910/30.910 |
| Cierre departamental | 30.883/30.883 asignadas |
| Cierre municipal | 30.883/30.883 asignadas |
| Prueba pública nacional | 21.618 visibles en escenario B |
| Prueba pública Tolima | Filtros mapa indicadores y rankings recalculados |

## Incidentes resueltos

| Incidente | Resolución |
|---|---|
| Consulta DANE completa devolvía error 500 | Descarga concurrente por lotes con subdivisión recursiva |
| Pausa entre caché y metadatos | Reconstrucción auditable de metadatos sin repetir la descarga |
| Un punto perdido por simplificación | Consulta exacta de respaldo contra la capa 317 |
| Script de build dependía del bit ejecutable | Invocación explícita mediante `bash` |
| Animación inicial dificultaba una captura determinista | Series configuradas sin animación inicial |

## Automatización

El workflow de actualización ahora ejecuta, en este orden:

1. pruebas del contrato Python;
2. ingesta y deduplicación IDEAM;
3. territorialización DANE;
4. construcción de archivos compactos del dashboard;
5. commit únicamente cuando existen cambios;
6. nuevo despliegue automático de GitHub Pages.

La primera ejecución territorial remota fue `33524144257` y terminó correctamente. El caché DANE quedó versionado, por lo que las siguientes ejecuciones no deben descargar nuevamente toda la capa municipal.

El despliegue final de GitHub Pages fue `33542445532` y terminó correctamente. La revisión visual pública confirmó mapa, puntos, barras y serie temporal; la revisión interactiva confirmó el recálculo al seleccionar Tolima.

## Checkpoints remotos

- Motor territorial: `96cdbfa5410c3ffc8405e50efe2d0d2201dae1b1`.
- Datos IDEAM–DANE: `369013b0e651a77dcfb66211ad9d1c30584f0c11`.
- Interfaz oficial conectada: `8355e4d24886cb08cc9f1e30362fbaa38469b9c5`.
- Render determinista de gráficos: `789320496eec8e8e95a496b68b652baf5c8572fe`.

## Límite de la fase

Esta fase describe anomalías térmicas y su localización administrativa. No confirma incendios, área quemada ni causalidad. Coberturas del suelo, áreas protegidas, episodios espacio-temporales y cruces ANM–ANLA–ANH corresponden a fases posteriores.

## Próxima fase sugerida

Fase 4: análisis territorial complementario, empezando por coberturas del suelo y áreas protegidas, con carga progresiva por escala para no saturar el dashboard nacional.
