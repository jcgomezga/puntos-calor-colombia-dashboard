# Implementación MB-07 — gate E2E real antes de publicar

Fecha: 2026-09-08  
Rama: `fix/e2e-qa-gate`  
PR: #13  
Base: `main` @ `5824faa527a69cd20223d6623965459bd6344f6a`

## Alcance

MB-07 cierra el componente residual de `QA-001` identificado en la auditoría integral: **ausencia de pruebas end-to-end reales**. El otro componente del mismo hallazgo —pruebas ausentes del despliegue directo— ya había sido corregido en MB-03.

Este bloque no modifica datos, reglas analíticas ni comportamiento cartográfico. Añade una barrera de calidad que ejecuta el dashboard exportado para GitHub Pages dentro de un navegador Chrome real y bloquea tanto los PR como la publicación si los flujos públicos principales dejan de funcionar.

## Gate E2E

Se incorpora `scripts/check-dashboard-e2e.mjs` y el comando:

```text
npm run test:e2e
```

El script:

1. sirve localmente el directorio `out` producido por `next build`, respetando el `basePath` de GitHub Pages;
2. inicia Chrome headless y se comunica mediante Chrome DevTools Protocol;
3. carga la aplicación exportada, no una representación sintética del DOM;
4. opera controles React reales y espera sus efectos visibles;
5. calcula los resultados esperados directamente desde `public/data/dashboard.json`, evitando fijar conteos que cambiarán con las actualizaciones diarias;
6. registra errores JavaScript y promesas rechazadas no controladas durante la ejecución;
7. falla con código distinto de cero si cualquier contrato no se cumple.

## Flujos cubiertos

La ejecución verde de referencia sobre el corte del 8 de septiembre de 2026 validó:

- carga inicial: **23.551** detecciones operativas;
- filtro `Departamento = Tolima`: **2.075** detecciones;
- filtro `Municipio = Ibagué`: **115** detecciones;
- rango de fecha limitado a `2026-09-08`: **2** detecciones;
- `Sin territorio asignado`: **22** detecciones;
- `Sin cobertura asignada`: **25** detecciones;
- `Situación ANLA = En evaluación`: **353** detecciones;
- una combinación con cero resultados (`Bogotá, D.C.` + cobertura nivel 1 `4`) y presencia del mensaje explícito de estado vacío en ambos gráficos;
- cambio de agrupación temporal de `Días` a `Meses`;
- existencia y navegación válida hacia la ruta pública de `Metodología` bajo el `basePath` exportado.

Estos números son evidencia del corte utilizado por CI, no constantes del test. Las expectativas se recalculan en cada ejecución desde el dataset vigente.

## Integración en CI y despliegue

`.github/workflows/geovisor-ci.yml` ejecuta ahora el E2E después de `npm run build:pages` y antes de los gates responsive, presupuesto JavaScript y verificación de activos.

`.github/workflows/pages.yml` ejecuta el mismo `npm run test:e2e` después del build de Pages y **antes** de `actions/upload-pages-artifact`. Si el E2E falla, no se genera el artefacto publicable y el job de despliegue no puede ejecutarse.

`tests/e2e-gate.test.mjs` protege este contrato: verifica la existencia del comando, su posición en ambos workflows y la cobertura de los flujos públicos definidos.

## Incidencias detectadas durante la construcción del gate

El desarrollo del propio E2E produjo dos fallos útiles antes de alcanzar el estado verde:

1. La primera ejecución (`34247658425`) falló al modificar un `<input type="date">` mediante asignación directa a `control.value`. El DOM reflejaba el cambio, pero React podía ignorarlo por su seguimiento interno de inputs controlados. Se sustituyó por el setter nativo de `HTMLInputElement`/`HTMLSelectElement`, seguido de eventos `input` y `change`. Esto convirtió la prueba de fecha en una interacción reproducible.
2. La segunda ejecución (`34248172990`) superó ya el rango de fecha y todos los filtros, pero falló al localizar/navegar el enlace de Metodología con un selector que asumía una URL sin barra final. La exportación Pages publica la ruta como `/puntos-calor-colombia-dashboard/metodologia/`. El gate pasó a resolver el `href` real exportado y a navegar exactamente a ese destino.

Estos fallos no correspondían a regresiones funcionales del dashboard; expusieron supuestos frágiles del primer prototipo de prueba y fueron corregidos antes de integrar MB-07.

## Validación funcional verde

Head funcional validado: `22afec1dc2ae96d29fc3c9d17bdd2d192ab0a2e1`  
Workflow `Validar geovisor`: run `34248537893`  
Job: `102136698442`  
Resultado: **success**.

Controles superados:

- `npm ci`: success;
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades**;
- lint: success;
- build Vite/Vinext + pruebas Node: success;
- pruebas Node: **59/59**;
- exportación GitHub Pages con Next.js 16.3.4: success;
- E2E real en Chrome: success;
- responsive real-browser 1440/1024/768/390 px: success;
- presupuesto JavaScript de Pages: success;
- activos MapLibre y catálogo territorial fragmentado: success.

En esa ejecución el presupuesto registró 13 chunks JavaScript, 2.011.004 bytes gzip totales y un chunk máximo de 1.081.567 bytes gzip, por debajo del gate actual de 1.250.000 bytes para el chunk mayor.

Las fichas territoriales permanecieron en **22.952 registros**, **439 fragmentos** y un máximo de **82.273 bytes** por fragmento.

## Límite cartográfico

MB-07 no pretende certificar todavía las interacciones internas del geovisor bajo WebGL. Chrome se ejecuta con GPU deshabilitada y el script no consulta `queryRenderedFeatures`, clustering, capas ni controles MapLibre.

Por decisión del proyecto, las pruebas específicas de prioridad de clic, geometrías coincidentes, capas, simbología, accesibilidad de consulta espacial y revisión visual del geovisor permanecen reservadas para **MB-09**, bloque cartográfico final.

Con esta distinción, `QA-001` queda cerrado en su sentido general de pipeline: MB-03 obliga a ejecutar pruebas antes de publicar y MB-07 añade el E2E real del producto exportado. La validación cartográfica especializada continúa como deuda explícita separada, no como falsa extensión del cierre de QA-001.

## Evidencia final del PR

La ejecución del head exacto que incluye este documento se registrará en el PR antes del squash-merge. Solo se integrará MB-07 si ese head completo termina verde.
