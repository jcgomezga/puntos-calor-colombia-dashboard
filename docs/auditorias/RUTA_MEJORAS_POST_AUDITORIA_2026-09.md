# Ruta priorizada de mejoras posterior a la auditoría integral

**Fecha:** 8 de septiembre de 2026  
**Base:** `AUDITORIA_WEB_INTEGRAL_2026-09.md` (30 hallazgos).  
**Criterio rector:** corregir primero errores confirmados y riesgos transversales sin alterar prematuramente la interacción MapLibre. La cartografía interactiva se reservó para el bloque final con validación visual en navegador real con WebGL2.

## Estado final de la ruta

### MB-01 — claridad pública y metodología — CERRADO
Atendió principalmente `DATA-003`, `UX-001`, `UX-002`, `UX-003` y `TECH-002`.

### MB-02 — calidad y contrato de fichas — CERRADO
Atendió `DATA-001` y `DATA-002` mediante normalización defensiva de fechas y supresión de estados ANM con forma de fecha.

### MB-03 — QA de despliegue y seguridad — CERRADO
Atendió `SEC-001` y el componente de `QA-001` relativo a despliegues sin suite completa. Estableció auditoría productiva bloqueante y pruebas antes del despliegue.

### MB-04 — rendimiento y estabilidad del frontend — CERRADO
Atendió `PERF-001`, `TECH-001` y `UX-004`: aisló Recharts del prerender, incorporó estados vacíos explícitos, redujo el mayor chunk inicial y dejó un presupuesto JavaScript automatizado para impedir regresiones.

### MB-05 — accesibilidad y responsive no cartográfico — CERRADO
Atendió `A11Y-002`, `A11Y-003` y las partes no cartográficas de `A11Y-004` y `RESP-001`: contraste AA, semántica de controles y gráficos, targets táctiles y validación responsive real.

### MB-06 — interpretabilidad y reconciliación de datos — CERRADO
Atendió `DATA-004`, `DATA-005` y `UX-005`: registros sin territorio/cobertura aislables, explicación de confianza por sensor y situación ANLA multietiqueta. No modificó la metodología de cruces ni el universo operativo.

### MB-07 — E2E y cierre de QA — CERRADO
Cerró el componente residual de `QA-001`. El producto exportado se prueba en Chrome real para carga, filtros, rango temporal, registros sin asignación, estado vacío, agrupación temporal y metodología. El mismo gate bloquea el despliegue de GitHub Pages.

### MB-08 — deuda técnica y mantenimiento — CERRADO
Atendió `TECH-003` y deuda emergente de Actions: la implementación obsoleta del geovisor quedó archivada y fuera de TypeScript/ESLint, la ruta pública canónica permanece `geovisor-entry.tsx` → `public-detection-geovisor-map.tsx`, y el geovisor operacional de episodios se conserva deliberadamente para análisis detallado futuro. Los workflows mantenidos usan versiones de Actions compatibles con Node 24 y la suite de contrato impide regresiones de esta separación.

Documento técnico: `IMPLEMENTACION_MB08_2026-09.md`.

### MB-09 — geovisor, cartografía y accesibilidad espacial — CERRADO
Atendió `MAP-001`, `MAP-002`, `MAP-003`, `MAP-004`, `CART-001`, `CART-002`, `CART-003`, `A11Y-001`, `PERF-002` y las partes cartográficas de `A11Y-004` y `RESP-001`.

El bloque final incorporó:

- prioridad de consulta dependiente del modo seleccionado;
- selección de entidades contextuales coincidentes;
- copy fiel del Mapa básico;
- leyendas de clusters y ANLA;
- reducción de saturación mediante agregación visual del Mapa básico;
- consulta espacial equivalente por teclado;
- panel móvil colapsable y targets cartográficos mayores;
- estados `loading/ready/error` para la dependencia remota IDEAM;
- E2E permanente del geovisor con Chrome/WebGL2/SwiftShader;
- revisión visual automatizada y aprobación visual del usuario antes del merge.

PR #15 fue fusionado por squash en `9c8f4389647411862d994427b0d694d7a2c31102`. GitHub Pages run `34260487411` terminó correctamente. El cierre documental posterior quedó registrado mediante PR #16.

Documentos técnicos: `IMPLEMENTACION_MB09_2026-09.md` y `REVIEW_MB09_2026-09.md`.

---

## Residual funcional no bloqueante

`UX-006` — serialización del estado de filtros en URL y/o exportación — **no forma parte del cierre de estabilidad**. Se mantiene como ampliación funcional futura y debe implementarse, si se decide, con un contrato propio de serialización, compatibilidad y pruebas E2E.

## Residuales técnicos aceptados

- `PERF-001`: la monoliticidad fue mitigada, el mayor chunk se redujo aproximadamente 40,9 % y existe un presupuesto bloqueante de 1.250.000 bytes gzip; el volumen JS agregado permanece alrededor de 2 MB gzip.
- `PERF-002`: la dependencia IDEAM sigue siendo externa; la aplicación ahora distingue carga, disponibilidad y fallo para que la latencia no se confunda con ausencia de cobertura.
- `DATA-002`: la inconsistencia del campo de estado ANM permanece en la fuente, pero el producto dejó de publicar valores con forma de fecha como estados administrativos.

## Declaración de cierre

La ruta MB-01 → MB-09 está **completamente integrada y desplegada**. La matriz final de los 30 hallazgos, los residuales aceptados y el criterio de estabilidad quedan consolidados en:

`docs/auditorias/CIERRE_AUDITORIA_INTEGRAL_2026-09.md`.

Para el alcance de la auditoría, el producto queda clasificado como **versión pública estable dentro del alcance auditado**, con monitoreo operativo y una mejora funcional no bloqueante diferida (`UX-006`).

## Regla de integración futura

Cualquier cambio posterior de fuentes, geometrías, metodología, universo de detecciones, contrato de datos o arquitectura cartográfica debe abrir su propia revisión de regresión. No debe reinterpretarse retrospectivamente este cierre ni mezclarse una ampliación funcional con la corrección de hallazgos ya cerrados.
