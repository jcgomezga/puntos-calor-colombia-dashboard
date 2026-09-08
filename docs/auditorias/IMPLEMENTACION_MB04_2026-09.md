# Implementación MB-04 — rendimiento y estabilidad del frontend

**Fecha:** 8 de septiembre de 2026  
**Bloque:** MB-04 — rendimiento y estabilidad del frontend.  
**Hallazgos atendidos:** `PERF-001`, `TECH-001`, `UX-004`.  
**Alcance:** fragmentación del JavaScript del frontend, aislamiento del render de gráficos y estado vacío explícito. No modifica datos, filtros, geometrías, relaciones espaciales, prioridad de clic, clustering, simbología ni lógica MapLibre.

## 1. Diagnóstico y línea base

La auditoría integral había registrado `PERF-001` por un chunk principal cercano a 1,90 MB gzip y `TECH-001` por los warnings de Recharts `width(-1)/height(-1)` durante prerender. También se registró `UX-004`: cuando una combinación de filtros producía cero detecciones, las tarjetas llegaban correctamente a cero pero los gráficos no ofrecían un estado vacío explícito.

Antes de optimizar se incorporó `scripts/check-pages-bundle-budget.mjs` para medir de forma reproducible todos los chunks JavaScript exportados por GitHub Pages. La primera medición de CI del bloque (`run 34237311135`) produjo:

- 10 chunks JavaScript;
- 7.463.923 bytes brutos totales;
- 2.008.990 bytes gzip totales;
- chunk mayor: 6.879.997 bytes brutos / **1.828.443 bytes gzip**.

El diagnóstico del repositorio mostró que el módulo principal importaba estáticamente Recharts y, además, tres catálogos pesados necesarios para la experiencia interactiva: `dashboard.json`, `departments.json` y `municipalities.json`. Por tanto, el problema era principalmente de empaquetado monolítico, no de pérdida de datos ni de una anomalía del pipeline.

## 2. Cambios implementados

### 2.1 Gráficos Recharts aislados del prerender

Se creó `components/dashboard-charts.tsx` y los gráficos de ranking y evolución temporal pasan a cargarse mediante `next/dynamic` con `ssr: false`.

Esto mantiene la funcionalidad visible pero evita que Recharts intente medir contenedores inexistentes durante el prerender de servidor. Después del cambio desaparecieron de los builds Vite/Vinext y Next.js los warnings `width(-1)/height(-1)` que originaban `TECH-001`.

### 2.2 Estado vacío explícito

Los dos gráficos muestran ahora el mensaje:

> No hay detecciones para los filtros seleccionados.

El ranking lo muestra cuando su conjunto está vacío y la serie temporal cuando no tiene datos o todos los periodos tienen valor cero. Esto cierra `UX-004` sin modificar el cálculo de filtros ni los conteos.

### 2.3 Cartografía pesada fuera del módulo principal

Se creó `components/dashboard-map-workspace.tsx`. Este módulo contiene las importaciones de `departments.json`, `municipalities.json`, `DashboardMap` y `GeovisorMap`; `app/page.tsx` lo carga dinámicamente en el cliente.

La reorganización conserva exactamente los mismos props y callbacks de los dos mapas. No se alteró ningún componente interno de MapLibre ni las geometrías. El objetivo es separar la cartografía pesada del módulo principal para que el navegador no deba parsear un único bloque monolítico antes de poder iniciar la interfaz.

### 2.4 Presupuesto de bundle bloqueante

La CI de pull requests ejecuta `scripts/check-pages-bundle-budget.mjs` después de la exportación Pages. Tras estabilizar el resultado de MB-04, el presupuesto máximo del mayor chunk se fija en **1.250.000 bytes gzip**. Una regresión que vuelva a crear un chunk mayor hará fallar la CI.

## 3. Resultado cuantitativo

La validación completa posterior al code splitting (`run 34238943453`) produjo:

- 13 chunks JavaScript;
- 7.470.014 bytes brutos totales;
- 2.010.186 bytes gzip totales;
- chunk mayor: 3.541.100 bytes brutos / **1.081.409 bytes gzip**;
- segundo chunk: 2.937.256 bytes brutos / **632.919 bytes gzip**.

Frente a la línea base, el mayor chunk pasa de 1.828.443 a 1.081.409 bytes gzip: una reducción de **747.034 bytes, aproximadamente 40,9 %**.

Debe interpretarse correctamente: el volumen gzip agregado de todos los chunks permanece prácticamente estable (2.008.990 → 2.010.186 bytes). MB-04 no elimina los datos que el dashboard necesita; los distribuye en unidades de carga y parseo más pequeñas y evita el gran bloque monolítico identificado por `PERF-001`. Por ello no se presenta este resultado como una reducción equivalente del ancho de banda total.

## 4. Validación funcional

El `run 34238943453` confirmó:

- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades**;
- lint correcto;
- build Vite/Vinext correcto;
- **41/41 pruebas aprobadas**;
- exportación estática Next.js 16.3.4 correcta;
- presupuesto de bundle correcto;
- worker MapLibre y catálogo de shards publicables correctos;
- 22.952 fichas territoriales y 439 shards preservados.

Las pruebas de regresión verifican además que:

- Recharts no vuelva a importarse en el módulo principal;
- el estado vacío permanezca disponible;
- `departments.json` y `municipalities.json` no vuelvan a entrar directamente en `app/page.tsx`;
- el workspace diferido conserve conjuntamente `GeovisorMap` y `DashboardMap`;
- la medición de bundle siga formando parte de CI.

## 5. Elementos expresamente no modificados

- universo y conteo de detecciones;
- filtros y reglas de selección;
- geometrías DANE/RUNAP/ANM/ANLA/ANH;
- PMTiles;
- relaciones espaciales;
- clusters y puntos MapLibre;
- prioridades y modos de clic;
- estilos y simbología cartográfica;
- servicio vectorial IDEAM;
- metodología o fuentes.

La revisión de interacción y estética cartográfica continúa reservada para el bloque final de MapLibre con validación visual del usuario.

## 6. Advertencias que permanecen fuera de alcance

El build Vite/Vinext todavía emite una advertencia genérica porque existen chunks superiores a 500 kB. No es el warning Recharts de `TECH-001`; el presupuesto específico de este proyecto queda ahora controlado por CI en 1,25 MB gzip para el chunk mayor. Una reducción adicional del volumen total requeriría cambiar la estrategia de entrega de `dashboard.json` u otras decisiones de arquitectura y debe evaluarse por beneficio/riesgo, no confundirse con el cierre del defecto monolítico auditado.

GitHub Actions también continúa avisando sobre la deprecación del runtime Node 20 declarado por `actions/checkout@v4` y `actions/setup-node@v4`, aunque el runner los ejecuta actualmente con Node 24. Ese mantenimiento queda separado para deuda técnica.

## 7. Criterio de cierre

`PERF-001` queda atendido por la reducción cuantificada del mayor chunk y el gate anti-regresión; `TECH-001` queda corregido al desaparecer el warning Recharts; `UX-004` queda corregido con estados vacíos explícitos. MB-04 puede integrarse cuando una última ejecución de CI sobre el head final, incluida esta documentación y el presupuesto definitivo de 1,25 MB, termine completamente en verde.