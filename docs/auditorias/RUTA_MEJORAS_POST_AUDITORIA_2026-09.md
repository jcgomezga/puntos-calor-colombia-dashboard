# Ruta priorizada de mejoras posterior a la auditoría integral

**Fecha:** 8 de septiembre de 2026  
**Base:** `AUDITORIA_WEB_INTEGRAL_2026-09.md` (30 hallazgos).  
**Criterio rector:** corregir primero errores confirmados y riesgos transversales sin alterar prematuramente la interacción MapLibre. La cartografía interactiva queda para el bloque final con validación visual en navegador real con WebGL2.

## Estado de cierre alcanzado

### MB-01 — claridad pública y metodología — CERRADO
Atendió principalmente `DATA-003`, `UX-001`, `UX-002`, `UX-003` y `TECH-002`.

### MB-02 — calidad y contrato de fichas — CERRADO
Atendió `DATA-001` y `DATA-002` mediante normalización defensiva de fechas y supresión de estados ANM con forma de fecha.

### MB-03 — QA de despliegue y seguridad — CERRADO
Atendió `SEC-001` y el componente de `QA-001` relativo a despliegues sin suite completa. Estableció auditoría productiva bloqueante y pruebas antes del despliegue.

### MB-04 — rendimiento y estabilidad del frontend — CERRADO
Atendió `PERF-001`, `TECH-001` y `UX-004`: aisló Recharts del prerender, incorporó estados vacíos explícitos, redujo el mayor chunk inicial y dejó un presupuesto JavaScript automatizado para impedir regresiones.

### MB-05 — accesibilidad y responsive no cartográfico — CERRADO
Atendió `A11Y-002`, `A11Y-003` y las partes no cartográficas de `A11Y-004` y `RESP-001`: contraste AA, semántica de controles y gráficos, targets táctiles y validación responsive real. `A11Y-001` y la accesibilidad espacial siguen reservadas para MB-09.

### MB-06 — interpretabilidad y reconciliación de datos — CERRADO
Atendió `DATA-004`, `DATA-005` y `UX-005`: registros sin territorio/cobertura aislables, explicación de confianza por sensor y situación ANLA multietiqueta. No modificó la metodología de cruces ni el universo operativo.

### MB-07 — E2E y cierre de QA — CERRADO
Cerró el componente residual de `QA-001`. El producto exportado se prueba ahora en Chrome real para carga, filtros, rango temporal, registros sin asignación, estado vacío, agrupación temporal y metodología. El mismo gate bloquea el despliegue de GitHub Pages. Las interacciones internas MapLibre continúan reservadas para MB-09.

### MB-08 — deuda técnica y mantenimiento — CERRADO AL INTEGRAR PR #14
Atiende `TECH-003` y deuda emergente de Actions: la implementación obsoleta del geovisor queda archivada y fuera de TypeScript/ESLint, la ruta pública canónica permanece `geovisor-entry.tsx` → `public-detection-geovisor-map.tsx`, y el geovisor operacional de episodios se conserva deliberadamente para análisis detallado futuro. Los workflows mantenidos pasan a versiones estables de Actions de primera parte compatibles con Node 24. La suite de contrato impide regresiones de esta separación.

Documento técnico: `IMPLEMENTACION_MB08_2026-09.md`.

---

## MB-09 — geovisor, cartografía y accesibilidad espacial — BLOQUE FINAL

**Hallazgos:** `MAP-001`, `MAP-002`, `MAP-003`, `MAP-004`, `CART-001`, `CART-002`, `CART-003`, `A11Y-001`, `PERF-002` y la parte cartográfica de `RESP-001`.

### Razón para dejarlo al final

Es el bloque con mayor riesgo de alterar la experiencia SIG y el que requiere validación visual real con WebGL2. Se aborda únicamente después de estabilizar datos, QA, rendimiento, accesibilidad general y mantenimiento.

### Objetivos

- hacer que la prioridad de clic respete el modo de consulta;
- resolver o presentar coincidencias múltiples de contexto;
- corregir el copy/capacidades del mapa básico;
- mejorar leyendas de clusters y ANLA;
- revisar saturación del mapa básico;
- ofrecer operación equivalente por teclado o alternativa accesible;
- probar móvil y latencia/fallo del servicio IDEAM;
- realizar revisión visual conjunta antes de integrar.

### Regla especial de MB-09

No se integrarán modificaciones cartográficas únicamente por inspección de código. Se requiere validación en navegador real con WebGL2 y revisión visual de la experiencia antes del merge.

---

## Mejora posterior no bloqueante

`UX-006` (estado compartible/exportable) se considera una ampliación funcional, no un defecto de estabilidad. Se evaluará después de MB-09 para evitar introducir complejidad adicional de estado/URL durante la estabilización.

## Regla de integración

Cada MB se trabaja en rama propia y PR separado. Ningún bloque debe mezclar cambios de metodología, fuentes, geometrías o universo de detecciones salvo que su objetivo lo exija explícitamente y exista auditoría específica. Todo PR debe conservar trazabilidad de hallazgos atendidos y evidencia de CI antes de integrarse a `main`.
