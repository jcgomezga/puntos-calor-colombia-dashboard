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

La prueba del dataset publicado registró **347 detecciones** con ambas etiquetas ANLA simultáneamente. Por tanto, los filtros `En evaluación` y `Licenciado` no constituyen particiones mutuamente excluyentes y sus subtotales por situación no deben sumarse.

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

Las primeras ejecuciones del PR sirvieron para detectar únicamente incompatibilidades de redacción con contratos históricos de claridad pública; las nuevas pruebas funcionales de MB-06 ya pasaban. Se restauraron las expresiones públicas esperadas sin retirar la explicación más precisa por sensor ni el carácter multietiqueta de ANLA.

La ejecución funcional final **GitHub Actions run 34246407300**, sobre el head `ed105fba2610c720510707ad87deea90214baf4b`, terminó completamente en verde:

- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades**;
- lint: correcto;
- Vite/Vinext y suite web: **55/55 pruebas**, 0 fallos;
- reconciliación publicada: **23.551** detecciones operativas, **22** sin territorio, **25** sin cobertura y **347** con ambas situaciones ANLA;
- exportación Next.js/GitHub Pages: correcta con `/` y `/metodologia` estáticas;
- gate responsive Chrome: correcto en 1440×900, 1024×768, 768×1024 y 390×844, incluidos los nuevos filtros;
- presupuesto JavaScript: mayor chunk **1.081.567 bytes gzip**, por debajo del límite bloqueante de 1.250.000 bytes; total JS **2.011.004 bytes gzip**;
- catálogo de fichas territoriales preservado: **22.952 fichas**, **439 fragmentos**, máximo **82.273 bytes**.

La advertencia de runtime de GitHub Actions sobre `checkout@v4` / `setup-node@v4` y Node 20/24 continúa siendo una deuda de mantenimiento no bloqueante y queda fuera de MB-06.

Este run constituye la evidencia funcional de cierre. El commit documental posterior debe volver a pasar la misma CI antes del merge para garantizar que el head final del PR permanece verde.
