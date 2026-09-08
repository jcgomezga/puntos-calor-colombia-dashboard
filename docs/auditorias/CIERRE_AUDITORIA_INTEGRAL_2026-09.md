# Cierre integral de auditoría — Dashboard nacional de detecciones térmicas

**Fecha de cierre:** 8 de septiembre de 2026  
**Auditoría de origen:** `AUDITORIA_WEB_INTEGRAL_2026-09.md`, rama `audit/web-integral-2026-09`, commit auditado `6e1f8319e2c40aed6532f1c7a0a60a69644648f1`.  
**Línea de cierre funcional:** PR #15 / commit `9c8f4389647411862d994427b0d694d7a2c31102`.  
**Cierre documental previo:** PR #16 / commit `99562ca7eeadbcec5a88c36fa89e2499d7d4113f`.  
**Último despliegue verificado antes de este documento:** GitHub Pages run `34261221094`, `build=success`, `deploy=success`.

## 1. Propósito

Este documento **no repite la auditoría**. Contrasta los 30 hallazgos registrados el 8 de septiembre de 2026 con los bloques de mejora MB-01 a MB-09 ya integrados y deja un estado final persistente para el proyecto.

La auditoría de origen registró 30 hallazgos: **12 S2, 15 S3 y 3 S4**, sin S0 ni S1. Su conclusión fue que la aplicación era una beta pública funcional, pero no debía declararse estable hasta cerrar los S2, validar MapLibre en un entorno WebGL2/móvil y fortalecer las puertas de calidad.

## 2. Resultado ejecutivo

De los 30 hallazgos originales:

- **27 quedan corregidos** en el comportamiento público o en el contrato técnico correspondiente;
- **2 quedan mitigados y cerrados con residual explícito** (`PERF-001`, `PERF-002`);
- **1 queda diferido como mejora funcional no bloqueante** (`UX-006`).

No permanece ningún **S2 bloqueante** sin tratamiento. Los dos residuales técnicos no representan defectos silenciosos: el bundle tiene presupuesto anti-regresión y la dependencia IDEAM comunica carga/fallo; ambos quedan observables y controlados dentro de lo que depende del proyecto.

Por alcance de esta auditoría, el dashboard puede pasar de **“beta pública funcional”** a **“versión pública estable dentro del alcance auditado”**. Esta declaración no equivale a un SLA, certificación de seguridad, certificación formal WCAG ni garantía sobre disponibilidad de servicios externos.

## 3. Matriz final de los 30 hallazgos

| ID | Sev. | Estado final | Bloque | Cierre / residual |
|---|---:|---|---|---|
| `MAP-001` | S2 | **CORREGIDO** | MB-09 | La consulta espacial se enruta por el modo explícito; una detección ya no intercepta Cobertura/Contexto/Territorio. |
| `MAP-002` | S2 | **CORREGIDO** | MB-09 | El Mapa básico tiene copy propio y ya no promete fichas que solo existen en Geovisor. |
| `DATA-001` | S2 | **CORREGIDO** | MB-02 | Fechas ANLA/ANH inequívocas se normalizan a `YYYY-MM-DD` en publicación y carga diferida. |
| `DATA-002` | S2 | **CORREGIDO CON RESIDUAL DE FUENTE** | MB-02 | Un `estado` ANM con forma de fecha se omite de forma fail-closed; estados textuales válidos se conservan. La inconsistencia del servicio fuente no se reinterpreta ni se inventa. |
| `DATA-003` | S2 | **CORREGIDO** | MB-01 | La metodología pública explica el universo operativo sin exponer el análisis instrumental A/B. |
| `UX-001` | S2 | **CORREGIDO** | MB-01 | Cobertura muestra código + denominación legible de la familia IDEAM. |
| `UX-002` | S2 | **CORREGIDO** | MB-01 | Metadatos y SEO se alinean con detecciones térmicas individuales. |
| `UX-003` | S2 | **CORREGIDO** | MB-01 | Existe y se enlaza la ruta pública `/metodologia/`. |
| `PERF-001` | S2 | **MITIGADO Y CERRADO** | MB-04 | El mayor chunk pasó de 1.828.443 a ~1,08 MB gzip (≈40,9 % menos) y CI bloquea si supera 1.250.000 bytes gzip. El volumen JS total permanece alrededor de 2,01 MB gzip y el warning genérico >500 kB sigue como deuda no bloqueante. |
| `QA-001` | S2 | **CORREGIDO** | MB-03 + MB-07 + MB-09 | Tests bloquean despliegues y existen E2E reales del dashboard y del geovisor WebGL2. |
| `A11Y-001` | S2 | **CORREGIDO** | MB-09 | Territorios del mapa básico son operables por teclado; Geovisor ofrece `Consultar centro del mapa` y feedback accesible. |
| `SEC-001` | S2 | **CORREGIDO** | MB-03 | `npm audit --omit=dev --audit-level=high` es gate bloqueante y la validación final reporta 0 vulnerabilidades productivas. |
| `MAP-003` | S3 | **CORREGIDO** | MB-09 | Contexto recopila y deduplica todas las entidades renderizadas coincidentes en vez de tomar `[0]`. |
| `MAP-004` | S3 | **CORREGIDO** | MB-09 | Cuando hay varias coincidencias se ofrece selector de entidades y trazabilidad de la ficha consultada. |
| `DATA-004` | S3 | **CORREGIDO** | MB-06 | `Sin territorio asignado` y `Sin cobertura asignada` son opciones aislables y verificadas por E2E. |
| `DATA-005` | S3 | **CORREGIDO** | MB-06 | El popup decodifica el catálogo de confianza y la metodología distingue VIIRS de MODIS sin equiparar sus escalas. |
| `UX-004` | S3 | **CORREGIDO** | MB-04 | Ranking y serie muestran estado vacío explícito para combinaciones sin detecciones. |
| `UX-005` | S3 | **CORREGIDO** | MB-06 | La UI/metodología aclara que situación ANLA es multietiqueta y que los subtotales pueden solaparse. |
| `CART-001` | S3 | **CORREGIDO** | MB-09 | La leyenda explica que clusters y tamaño representan conteo de detecciones, no intensidad/severidad. |
| `CART-002` | S3 | **CORREGIDO** | MB-09 | El mapa básico usa agregación visual nacional para reducir saturación sin alterar el conjunto filtrado ni los conteos. |
| `CART-003` | S3 | **CORREGIDO** | MB-09 | La leyenda/simbología ANLA diferencia `En evaluación` y `Licenciado`. |
| `PERF-002` | S3 | **MITIGADO Y CERRADO** | MB-09 | La hipótesis se reprodujo con varias muestras del servicio IDEAM; la UI distingue `loading`, `ready` y `error`. La latencia/disponibilidad del servicio oficial continúa fuera del control del repositorio. |
| `TECH-001` | S3 | **CORREGIDO** | MB-04 | Recharts se aísla del prerender y desaparecen los warnings `width(-1)/height(-1)`. |
| `A11Y-002` | S3 | **CORREGIDO** | MB-05 | Texto pequeño corregido alcanza AA en los fondos auditados y tiene prueba automática de contraste. |
| `A11Y-003` | S3 | **CORREGIDO** | MB-05 | Controles de estado exponen `aria-pressed`; gráficos publican alternativa textual útil. |
| `A11Y-004` | S3 | **CORREGIDO** | MB-05 + MB-09 | Controles no cartográficos alcanzan 44 px; controles cartográficos aumentan área y alcanzan 44×44 px en móvil. |
| `RESP-001` | S3 | **CORREGIDO** | MB-05 + MB-09 | CI valida 1440/1024/768/390 px; el panel móvil inicia colapsado, usa scroll interno y preserva escala/atribución. |
| `TECH-002` | S4 | **CORREGIDO** | MB-01 | Favicon y metadata respetan el `basePath` de GitHub Pages. |
| `UX-006` | S4 | **DIFERIDO — NO BLOQUEANTE** | Posterior | Serializar filtros en URL y/o exportar el estado es una ampliación funcional. No afecta integridad, estabilidad ni reproducibilidad interna de los datos publicados. |
| `TECH-003` | S4 | **CORREGIDO** | MB-08 | El geovisor obsoleto se archiva fuera del código activo; la ruta pública canónica queda protegida por pruebas. |

## 4. Evidencia final de calidad

La validación final posterior a MB-09 confirma un cambio sustancial frente a la auditoría inicial:

- **71/71 pruebas Node aprobadas** en el cierre técnico/documental;
- **0 vulnerabilidades productivas** en el gate `npm audit`;
- build Vite/Vinext y exportación Next.js/GitHub Pages correctos;
- E2E general en Chrome para carga, filtros, fechas, registros sin asignar, ANLA, estados vacíos, temporalidad y metodología;
- E2E cartográfico con **WebGL2 real vía Chrome/SwiftShader**;
- MapLibre crea canvas y mantiene consulta por teclado;
- validación responsive real en **1440×900, 1024×768, 768×1024 y 390×844**;
- panel cartográfico móvil inicial colapsado con ocupación aproximada de **2,36 %** del mapa;
- panel abierto sin superponer escala ni atribución (`overlap = 0` en los gates finales);
- mayor chunk final observado: aproximadamente **1.083.655 bytes gzip**, bajo el presupuesto de **1.250.000**;
- **22.952 fichas territoriales**, 439 shards y máximo de 82.273 bytes por shard;
- GitHub Pages ejecuta pruebas y E2E antes de publicar.

El universo operativo es dinámico por las actualizaciones de datos. Por ello, las cifras de detecciones del cierre no deben compararse mecánicamente con las 23.542 filas del corte original como si una diferencia implicara regresión; la auditoría inicial y el cierre corresponden a cortes de datos distintos.

## 5. Residuales aceptados y seguimiento

### 5.1 `PERF-001` — volumen total de JavaScript

La monoliticidad que originó el hallazgo fue corregida y existe presupuesto bloqueante. Aun así, el volumen agregado sigue alrededor de 2 MB gzip y Vite puede emitir su advertencia genérica de chunks >500 kB. Una reducción adicional exigiría cambiar la estrategia de entrega de datos y debe justificarse por medición de beneficio real, no por perseguir un número aislado.

### 5.2 `PERF-002` — servicio externo IDEAM

El proyecto no controla latencia ni disponibilidad del VectorTileServer oficial. El riesgo queda aceptado porque ahora es observable y distinguible de una ausencia real de cobertura. Debe vigilarse operativamente si cambia la URL, CORS, esquema o disponibilidad del servicio.

### 5.3 `DATA-002` — contenido fuente ANM

El producto dejó de publicar una fecha como si fuera un estado administrativo. La anomalía de origen permanece en el servicio fuente; cualquier migración de capa o reinterpretación del esquema requerirá una auditoría específica de fuente y no debe hacerse silenciosamente.

### 5.4 `UX-006` — estado compartible/exportable

Permanece como mejora futura. Si se implementa, conviene tratarla como una nueva funcionalidad con contrato de serialización, compatibilidad hacia atrás y pruebas E2E, no como una corrección urgente de esta auditoría.

## 6. Qué no certifica este cierre

Este cierre verifica el alcance técnico y funcional de la auditoría realizada. No constituye:

- un SLA de disponibilidad;
- una certificación de ciberseguridad externa o pentest;
- una certificación formal WCAG con lectores de pantalla y dispositivos asistivos completos;
- una validación científica de que una detección térmica sea un incendio confirmado;
- una prueba de causalidad entre detecciones y minería, hidrocarburos, áreas protegidas, licenciamiento u otras capas contextuales;
- garantía de estabilidad futura de servicios de terceros.

Estas limitaciones son coherentes con la metodología pública del dashboard y no reabren los hallazgos ya cerrados.

## 7. Declaración de cierre

Con MB-01 a MB-09 integrados, revisión visual física aprobada y despliegue de GitHub Pages verificado, **la ruta de corrección derivada de la auditoría integral queda cerrada**.

Estado del producto para efectos de esta auditoría:

> **VERSIÓN PÚBLICA ESTABLE DENTRO DEL ALCANCE AUDITADO, CON MONITOREO OPERATIVO Y UNA MEJORA FUNCIONAL NO BLOQUEANTE DIFERIDA (`UX-006`).**

Cualquier cambio futuro de fuentes, geometrías, metodología, universo operativo, contrato de datos o arquitectura cartográfica debe abrir su propia revisión de regresión en lugar de reinterpretar retrospectivamente este cierre.
