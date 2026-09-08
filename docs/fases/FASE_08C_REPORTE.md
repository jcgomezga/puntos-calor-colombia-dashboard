# Fase 8C — Arquitectura operacional por episodios

Cierre técnico: 8 de septiembre de 2026.

## Propósito

Convertir el geovisor piloto en una interfaz operacional coherente con la metodología ya auditada: una sola configuración pública de episodios, detecciones individuales como evidencia constitutiva secundaria y capas territoriales consultables sin confundir coincidencia espacial con causalidad.

La implementación continúa aislada en `feature/geovisor-fase-8a` y en el PR borrador. No modifica `main` ni la versión pública vigente.

## Unidad operacional

La interfaz dejó de ofrecer los escenarios A/B como selector. La sensibilidad A/B se conserva en la documentación y en los productos de backend para auditoría histórica, mientras la operación pública usa la configuración adoptada en Fase 6B:

- universo operacional correspondiente al escenario B;
- distancia máxima de enlace: 1 km;
- separación temporal máxima de enlace: 24 horas;
- mínimo 3 detecciones para publicar un episodio.

Un **episodio de detecciones térmicas** es un componente algorítmico de observaciones conectadas bajo esas reglas. La conectividad puede ser transitiva: A puede enlazar con B y B con C aunque A y C no sean vecinas directas. Por ello el dashboard conserva la señal de encadenamiento y evita presentar la agrupación como verdad de campo.

**Un episodio no confirma por sí solo un incendio, no representa una cicatriz ni una superficie quemada y no demuestra una causa.** La validación de incendio requiere evidencia adicional, como imágenes satelitales de cambio, reportes oficiales o verificación de campo.

## Jerarquía del geovisor

La capa principal pasó a ser **Episodios de detecciones térmicas**. Las detecciones individuales permanecen disponibles como capa secundaria, apagada al iniciar. Desde la ficha de un episodio se puede activar la visualización de sus detecciones miembro para inspeccionar la evidencia que compone la agrupación.

Los filtros temporales y administrativos siguen limitando el universo visible. Los filtros RUNAP, cobertura IDEAM, ANM, ANLA y ANH se evalúan ahora sobre el conjunto de miembros de cada episodio: un episodio satisface un criterio cuando la regla correspondiente se cumple para alguno de sus miembros, en lugar de exigir que una misma detección reúna simultáneamente relaciones territoriales diferentes.

## Fichas territoriales completas

RUNAP, ANM, ANLA y ANH conservan sus geometrías en PMTiles, pero los atributos ampliados ya no se repiten en cada tesela. La arquitectura queda separada en dos piezas:

1. `public/data/context-layers.pmtiles`: geometría, simbología, identificadores compactos y `detail_key`;
2. `public/data/context-details.json`: catálogo único de atributos completos, cargado únicamente cuando el usuario abre por primera vez una ficha territorial.

El cliente conserva en memoria la promesa del catálogo durante la sesión para evitar descargas repetidas. Si el catálogo detallado no puede cargarse, el popup mantiene los atributos mínimos contenidos en la tesela y muestra una advertencia localizada en vez de bloquear el geovisor.

El catálogo publicado contiene **22.952 registros de detalle** y ocupa **10.808.309 bytes**. Puede contener registros fuente no dibujables, mientras el archivo cartográfico conserva exclusivamente el universo visual definido metodológicamente.

## Geometrías publicadas

| Capa | Registros fuente | Objetos dibujables |
|---|---:|---:|
| RUNAP | 1.909 | 1.909 |
| ANM | 10.658 | 10.656 |
| ANLA | 9.931 | 9.827 |
| ANH | 480 | 455 |
| **Total visible** |  | **22.847** |

El PMTiles final ocupa **60.668.987 bytes** y su SHA-256 registrado es `31749256d8f3bd5417c2d738365f83846ccc6d46387fd542f39331805abcb011`. La reducción frente a la versión enriquecida monolítica se consiguió evitando repetir cadenas extensas en múltiples teselas.

Los 2 registros ANM y 104 ANLA no representados carecen de geometría dibujable en el producto descargado. Las 25 áreas ANH no asignadas permanecen fuera del alcance visual porque la regla analítica vigente considera contractuales únicamente las áreas `CLASIFICAC=ASIGNADA`.

## Contenido de consulta

Las fichas territoriales exponen los atributos disponibles y pertinentes en los productos descargados:

- RUNAP: identificador, nombre, categoría, condición y administración;
- ANM: expediente, titular o solicitante, minerales, etapa, estado, modalidad, tipo de explotación, municipios, departamento, área y fechas registradas;
- ANLA: expediente, proyecto, operador, sector, situación jurídica, tipo de geometría, estado, acto administrativo, fecha y artículo, contrato, infraestructura, área o longitud y campos descriptivos disponibles;
- ANH: identificadores contractuales, contrato, área o bloque, operador, estado, clasificación, tipo y subtipo contractual, fecha de firma, cuenca, superficie, área, yacimiento, proceso y referencia GECOH/minuta cuando la fuente la ofrece.

Cada ficha conserva una advertencia interpretativa: intersección o proximidad son relaciones espaciales y **no implican causalidad, responsabilidad ni origen del fuego**.

## Cobertura IDEAM

La Cobertura de la Tierra IDEAM 2024 permanece como capa territorial independiente y consultable. La ficha muestra la jerarquía CORINE publicada hasta los niveles disponibles, área del polígono, municipio, departamento, autoridad ambiental y periodo cuando esos atributos están presentes. La fuente se identifica explícitamente como IDEAM, Mapa Nacional de Coberturas de la Tierra 2024, escala 1:100.000.

## Validación automatizada

La reconstrucción territorial `Construir teselas de contexto territorial` terminó correctamente en el run `34182414618`. El flujo verificó que:

- el PMTiles coincide en tamaño con su manifiesto y permanece por debajo del límite preventivo de 100 MB;
- se conservan exactamente 22.847 geometrías visibles;
- existen las cuatro capas RUNAP, ANM, ANLA y ANH;
- `context-details.json` existe, puede parsearse y coincide con el conteo y tamaño declarados en el manifiesto.

El geovisor completo se validó después de retirar los workflows y scripts temporales de migración. El run `34182691057` terminó correctamente con:

- `npm ci` aprobado;
- lint sin errores, con una advertencia no funcional por un import `Radio` no utilizado;
- build Vite/Vinext aprobado;
- **27/27 pruebas web aprobadas**, incluidas la separación A/B, configuración operacional, filtros por episodio, fichas territoriales diferidas, cobertura IDEAM y worker MapLibre;
- exportación estática Next/GitHub Pages y TypeScript aprobados;
- worker MapLibre y módulo compartido verificados en `public/` y `out/`.

Las advertencias de tamaño de chunk de Vite y de dimensiones de gráficos durante prerender ya existían como avisos no bloqueantes y no provocaron errores de compilación ni de pruebas.

## Estado y control pendiente

La arquitectura solicitada queda implementada y validada estructuralmente. El PR continúa **abierto, en borrador y sin integrar**.

Falta una inspección visual final en un navegador real con WebGL2 para comprobar conjuntamente: episodios como capa principal; detecciones apagadas y activación por episodio; polígonos RUNAP/ANM/ANLA/ANH; carga efectiva de sus fichas completas; cobertura IDEAM; filtros, opacidad, zoom y popups; y funcionamiento del mapa básico de respaldo. Solo después de esa inspección procede evaluar la integración a `main`.
