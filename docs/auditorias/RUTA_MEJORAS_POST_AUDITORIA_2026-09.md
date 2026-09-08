# Ruta priorizada de mejoras posterior a la auditoría integral

**Fecha:** 8 de septiembre de 2026  
**Base:** `AUDITORIA_WEB_INTEGRAL_2026-09.md` (30 hallazgos).  
**Criterio rector:** corregir primero errores confirmados y riesgos transversales sin alterar prematuramente la interacción MapLibre. La cartografía interactiva queda para el bloque final con validación visual en navegador real con WebGL2.

## Estado de cierre ya alcanzado

### MB-01 — claridad pública y metodología — CERRADO
Atendió principalmente `DATA-003`, `UX-001`, `UX-002`, `UX-003` y `TECH-002`.

### MB-02 — calidad y contrato de fichas — CERRADO
Atendió `DATA-001` y `DATA-002` mediante normalización defensiva de fechas y supresión de estados ANM con forma de fecha.

### MB-03 — QA de despliegue y seguridad — CERRADO
Atendió `SEC-001` y el componente de `QA-001` relativo a despliegues sin suite completa. La ausencia de E2E reales permanece pendiente.

---

## MB-04 — rendimiento y estabilidad del frontend

**Prioridad:** alta.  
**Hallazgos:** `PERF-001`, `TECH-001`, y como mejora acoplada de bajo riesgo `UX-004`.

### Objetivos

1. Reducir el payload JavaScript inicial medido en la auditoría (1,90 MB gzip) sin alterar resultados, filtros, datos ni MapLibre.
2. Eliminar los warnings de Recharts `width(-1)/height(-1)` durante prerender/build.
3. Introducir un estado vacío explícito para ranking y serie cuando los filtros producen cero detecciones.
4. Crear un presupuesto reproducible de tamaño para evitar regresiones de bundle.

### Método

- Medir primero qué parte del payload corresponde a datos embebidos, Recharts, cartografía y código propio.
- Separar dependencias pesadas solo cuando la medición demuestre beneficio.
- No tocar geometrías, clustering, prioridad de clic ni estilos MapLibre.
- Exigir lint, 38/38 pruebas actuales o más, build Vite/Vinext, exportación Pages y `npm audit` en verde.

### Criterio de cierre

- warning Recharts ausente en build;
- estado vacío verificable por prueba;
- presupuesto de bundle documentado y automatizado;
- reducción medible del chunk/payload inicial o, si la mayor parte corresponde al dataset necesario, documentación cuantitativa del límite y estrategia de carga diferida posterior.

---

## MB-05 — accesibilidad y responsive no cartográfico

**Hallazgos:** `A11Y-002`, `A11Y-003`, `A11Y-004`, `RESP-001` y parte no cartográfica de `QA-001`.

### Alcance

- contraste AA de textos pequeños;
- `aria-pressed`/semántica equivalente para controles de estado;
- nombre y alternativa textual para gráficos;
- targets táctiles de controles propios;
- validación responsive real en anchos representativos;
- pruebas automatizadas de semántica básica.

`A11Y-001` se reserva para el bloque cartográfico porque exige resolver operación equivalente del mapa.

---

## MB-06 — interpretabilidad y reconciliación de datos

**Hallazgos:** `DATA-004`, `DATA-005`, `UX-005`.

### Alcance

- explicar y, cuando proceda, permitir aislar registros sin territorio/cobertura;
- contextualizar la confianza satelital sin mezclar escalas de sensores de forma indebida;
- explicar de forma visible que las situaciones ANLA son multietiqueta y pueden solaparse.

No se modifica la metodología de cruces ni el universo operativo.

---

## MB-07 — E2E y cierre de QA

**Hallazgo:** componente residual de `QA-001`.

### Alcance

Añadir E2E reales para rutas críticas: carga, filtros principales, cero resultados, cambio día/mes, metodología y flujo básico de mapa cuando el entorno de CI permita navegador compatible. Separar claramente pruebas DOM/unitarias de pruebas E2E.

---

## MB-08 — deuda técnica y mantenimiento

**Hallazgos:** `TECH-003` y deuda emergente documentada durante MB-04/MB-07.

### Alcance

- retirar o aislar geovisores legados solo después de demostrar que no son utilizados por imports, tests o documentación;
- no eliminar código histórico útil para reproducibilidad sin una decisión explícita;
- actualizar warnings de runtime de GitHub Actions cuando exista versión estable compatible.

---

## MB-09 — geovisor, cartografía y accesibilidad espacial — BLOQUE FINAL

**Hallazgos:** `MAP-001`, `MAP-002`, `MAP-003`, `MAP-004`, `CART-001`, `CART-002`, `CART-003`, `A11Y-001`, `PERF-002` y la parte cartográfica de `RESP-001`.

### Razón para dejarlo al final

Es el bloque con mayor riesgo de alterar la experiencia SIG y el que requiere validación visual real con WebGL2. Se resolverá cuando los bloques de datos, QA, rendimiento y accesibilidad general estén estabilizados.

### Objetivos

- hacer que la prioridad de clic respete el modo de consulta;
- resolver o presentar coincidencias múltiples de contexto;
- corregir el copy/capacidades del mapa básico;
- mejorar leyendas de clusters y ANLA;
- revisar saturación del mapa básico;
- ofrecer operación equivalente por teclado o alternativa accesible;
- probar móvil y latencia/fallo del servicio IDEAM;
- realizar revisión visual conjunta antes de integrar.

---

## Mejora posterior no bloqueante

`UX-006` (estado compartible/exportable) se considera una ampliación funcional, no un defecto de estabilidad. Se evaluará después de cerrar los hallazgos confirmados anteriores para evitar introducir complejidad de estado/URL durante la estabilización.

## Regla de integración

Cada MB se trabaja en rama propia y PR separado. Ningún bloque debe mezclar cambios de metodología, fuentes, geometrías o universo de detecciones salvo que su objetivo lo exija explícitamente y exista auditoría específica. Todo PR debe conservar trazabilidad de hallazgos atendidos y evidencia de CI antes de integrarse a `main`.
