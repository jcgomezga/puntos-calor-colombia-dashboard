# Implementación MB-08 — deuda técnica y mantenimiento

**Fecha:** 8 de septiembre de 2026  
**Bloque:** MB-08 — deuda técnica y mantenimiento.  
**Hallazgo atendido:** `TECH-003`.  
**Deuda emergente atendida:** runtime de Actions de primera parte desactualizado respecto de Node 24.  
**Rama:** `chore/mb08-maintenance-debt`.  
**PR:** #14.

## 1. Alcance y límite

MB-08 elimina ambigüedad de mantenimiento entre implementaciones del geovisor y actualiza infraestructura de CI/despliegue. No cambia el universo de detecciones, los datos publicados, la metodología, geometrías, PMTiles, capas, simbología, clustering, consulta espacial, prioridad de clic, popups ni controles MapLibre.

La corrección y validación visual de la experiencia cartográfica permanece reservada para **MB-09**, bloque final de la ruta posterior a la auditoría.

## 2. Diagnóstico de `TECH-003`

La auditoría registró un componente de geovisor legado duplicado con riesgo de que futuras modificaciones se aplicaran al archivo equivocado.

La resolución real del frontend ya era inequívoca en `tsconfig.json`:

- el alias `@/components/geovisor-map` apunta a `components/geovisor-entry.tsx`;
- `components/geovisor-entry.tsx` carga `components/public-detection-geovisor-map.tsx`;
- por tanto, esta última es la implementación pública canónica del geovisor.

El antiguo `components/geovisor-map.tsx` no participaba en esa ruta activa. En cambio, `components/operational-geovisor-map.tsx` sí conserva deliberadamente la lógica de episodios espacio-temporales para un futuro módulo de análisis detallado, por lo que **no** se trata como código descartable.

## 3. Cambios implementados

### 3.1 Aislamiento conservador del geovisor legado

El archivo obsoleto fue movido sin modificar su contenido a:

`archive/legacy-geovisor/geovisor-map.tsx`

Git conserva el movimiento como renombrado del mismo contenido, de modo que no se pierde la trazabilidad histórica. Se añadió `archive/legacy-geovisor/README.md` para dejar explícitos su propósito histórico, la ruta canónica actual y la diferencia frente al geovisor operacional de episodios.

El directorio `archive/` se excluyó del proyecto TypeScript activo y de ESLint. Así, el código histórico permanece disponible para reproducibilidad, pero no entra en compilación, lint ni mantenimiento cotidiano.

### 3.2 Actualización de Actions de primera parte

Durante MB-03/MB-07 GitHub Actions advertía que versiones antiguas de acciones de primera parte todavía declaraban runtimes previos mientras el runner migraba a Node 24. Al existir ya versiones estables compatibles, MB-08 actualiza los workflows mantenidos:

- `actions/checkout@v7`;
- `actions/setup-node@v7`;
- `actions/setup-python@v7`;
- `actions/upload-artifact@v7`;
- `actions/upload-pages-artifact@v5`;
- `actions/deploy-pages@v5`.

Los cambios se limitan a versiones de las acciones. No se alteraron las órdenes de procesamiento de datos, los disparadores funcionales ni el contrato de publicación del dashboard.

## 4. Pruebas de no regresión

Se añadió `tests/maintenance-debt.test.mjs`, que exige de forma automatizada:

1. que `components/geovisor-map.tsx` ya no exista como implementación activa;
2. que el archivo histórico exista bajo `archive/legacy-geovisor/`;
3. que el alias público siga resolviendo a `geovisor-entry.tsx` y este cargue `public-detection-geovisor-map.tsx`;
4. que `operational-geovisor-map.tsx` conserve la lógica de episodios;
5. que `archive/` permanezca excluido de TypeScript y ESLint;
6. que los workflows mantenidos no regresen a majors antiguos de las Actions actualizadas.

Al actualizar `upload-pages-artifact` se detectó además que `tests/e2e-gate.test.mjs` estaba acoplado literalmente a `@v3`. El primer CI de MB-08 falló únicamente por esa expectativa obsoleta, no por una regresión del producto. El test fue corregido para verificar el **orden del gate E2E respecto de cualquier versión válida** de `actions/upload-pages-artifact`, preservando la garantía funcional sin fijar el major.

## 5. Validación funcional previa al cierre

Sobre el head funcional `f988ceada52f70e86c2c5260bd75bdfba49ced23`, el workflow `Validar geovisor` run **34250586753**, job **102143955519**, terminó correctamente.

Resultados verificados:

- `npm ci`: correcto;
- auditoría productiva bloqueante: **0 vulnerabilidades**;
- lint: correcto;
- build Vite/Vinext: correcto;
- suite Node: **61/61 pruebas aprobadas, 0 fallos**;
- exportación GitHub Pages con Next.js 16.3.4: correcta;
- E2E real en Chrome: correcto;
- responsive en 1440, 1024, 768 y 390 px: correcto;
- presupuesto JavaScript: correcto; chunk mayor **1.081.567 bytes gzip** frente a un máximo de **1.250.000**;
- activos MapLibre y catálogo territorial fragmentado: correctos;
- catálogo territorial: **22.952 fichas**, 439 fragmentos escritos y fragmento máximo de 82.273 bytes.

El E2E sobre el corte usado en la validación reconcilió, entre otros, 23.551 detecciones operativas, Tolima 2.075, Ibagué 115, 22 registros sin territorio, 25 sin cobertura y 353 en situación ANLA «En evaluación».

## 6. Deuda residual explícita

El build Vite mantiene el aviso genérico de chunks superiores a 500 kB. No es una regresión de MB-08: el tamaño se controla mediante el presupuesto automatizado introducido en MB-04 y el mayor chunk de Pages permanece bajo el umbral bloqueante definido.

Las interacciones internas MapLibre/WebGL, la prioridad de clic, coincidencias múltiples, accesibilidad espacial, leyendas y validación cartográfica móvil **no se certifican ni modifican en MB-08**. Forman parte de MB-09.

## 7. Criterio de cierre

`TECH-003` puede considerarse cerrado cuando este PR se integre: existe una sola implementación pública canónica en el árbol activo; el legado queda archivado y fuera de compilación/lint; el geovisor operacional de episodios permanece deliberadamente conservado; y las pruebas impiden revertir accidentalmente esa separación.
