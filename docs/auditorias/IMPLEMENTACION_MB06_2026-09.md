# Implementación MB-06 — interpretabilidad y reconciliación de datos

Fecha: 2026-09-08  
Rama: `fix/data-interpretability-reconciliation`  
PR: #12  
Base: `main` @ `eca1a0fc60e2cd94d3d5028a72a7270e72957564`

## Alcance

MB-06 atiende `DATA-004`, `DATA-005` y `UX-005` sin modificar el universo operativo, la metodología de cruces espaciales ni el comportamiento cartográfico reservado para MB-09.

## DATA-004 — reconciliación de registros sin asignación

La interfaz incorpora dos categorías explícitas:

- `Sin territorio asignado` en el selector de departamento;
- `Sin cobertura asignada` en el selector de cobertura IDEAM 2024.

Los conteos no están hardcodeados: se calculan directamente sobre los puntos del universo operativo (`point[7] === 1`). La prueba de reconciliación sobre el dataset publicado durante MB-06 registró:

- universo operativo: **23.551 detecciones**;
- sin territorio asignado: **22**;
- sin cobertura asignada: **25**.

Los registros no asignados siguen incluidos en el total general. MB-06 únicamente permite aislarlos y explica por qué las sumas de categorías territoriales o de cobertura pueden no coincidir con ese total.

Cuando se selecciona `Sin territorio asignado`, el componente de mapa recibe el código territorial nacional normal (`00` / `00000`) y únicamente los puntos previamente filtrados. De esta forma se preserva el contrato cartográfico y no se introduce un código artificial en la lógica espacial.

## DATA-005 — confianza por sensor

Durante la implementación se identificó un defecto de presentación adicional al hallazgo original. El esquema compacto de `dashboard.json` guarda en la posición 9 un **`confidenceIndex`**, mientras que el popup del geovisor lo presentaba directamente como si fuera el valor de confianza.

MB-06 corrige ese contrato: el popup resuelve `confidenceIndex` contra `dashboard.confidences` antes de mostrarlo.

La interpretación pública queda explícita por familia de sensor:

- **VIIRS:** categorías `Baja`, `Nominal` o `Alta`;
- **MODIS:** porcentaje `0–100 %`.

No se convierten categorías VIIRS a porcentajes y no se comparan numéricamente ambas escalas. La interfaz y la metodología advierten además que la confianza es un indicador del producto del sensor y **no debe interpretarse como probabilidad de que exista un incendio**.

Las pruebas recorren todos los puntos del universo operativo y verifican que cada `confidenceIndex` resuelva a una cadena no vacía y que los valores publicados respeten el formato correspondiente a VIIRS o MODIS.

## UX-005 — situaciones ANLA no excluyentes

La situación ANLA se representa en cada detección mediante un bitmask: evaluación y licenciado pueden coexistir. MB-06 no cambia esa lógica; la hace visible y comprensible.

La prueba del dataset publicado registró **347 detecciones** con ambas etiquetas ANLA simultáneamente. Por tanto, los filtros `En evaluación` y `Licenciado` no constituyen particiones mutuamente excluyentes y sus subtotales no deben sumarse.

La advertencia aparece tanto en el dashboard como en la página de metodología.

## Controles de no regresión

`tests/data-interpretability.test.mjs` verifica:

1. existencia real de registros operativos sin territorio y sin cobertura;
2. presencia de los dos filtros especiales y su lógica de aislamiento;
3. inclusión de `departmentCode` en las dependencias de `visiblePoints`, evitando un estado memoizado incorrecto al cambiar entre Colombia y `Sin territorio asignado`;
4. resolución completa del catálogo `dashboard.confidences`;
5. formatos de confianza específicos de VIIRS y MODIS;
6. decodificación del `confidenceIndex` en el popup;
7. existencia real de solapamiento ANLA y explicación pública de su carácter multietiqueta.

El gate responsive de MB-05 continúa cubriendo la estructura general de la interfaz y los controles no cartográficos añadidos.

## Límite cartográfico

MB-06 no modifica geometrías, clustering, fuentes/capas, simbología, prioridad de clic, relaciones espaciales, controles internos de MapLibre ni accesibilidad de consulta espacial. Esos puntos permanecen reservados para MB-09.

## Validación

La primera ejecución del PR (`34245242854`) confirmó correctamente los conteos anteriores y que las nuevas pruebas de MB-06 pasaban, pero detectó dos regresiones en pruebas históricas de claridad pública por una reformulación textual de la advertencia de confianza. No fue un fallo funcional. Se restauró el contrato verbal esperado —`no deben interpretarse como una probabilidad de que exista un incendio`— y se mantuvo la explicación más precisa por sensor.

La evidencia de la ejecución final verde se añadirá antes de integrar el PR.
