# Implementación MB-03 — gates de QA y seguridad de dependencias

**Fecha:** 8 de septiembre de 2026  
**Bloque:** MB-03 — QA y seguridad.  
**Hallazgos atendidos:** `SEC-001` y componente de despliegue de `QA-001`.  
**Alcance:** endurecimiento de CI/CD y actualización controlada de dependencias. No modifica UI, datos, geometrías, filtros, relaciones espaciales, MapLibre ni cartografía.

## 1. Diagnóstico de partida

La auditoría integral identificó dos riesgos relacionados con este bloque:

- `SEC-001`: `npm audit --omit=dev` reportaba cinco paquetes productivos con avisos de severidad alta.
- `QA-001`: el workflow de publicación de GitHub Pages podía ejecutar lint y construir/publicar sin pasar previamente la suite completa de pruebas.

El diagnóstico posterior identificó exactamente cinco paquetes productivos afectados: `fast-uri`, `nanoid`, `next`, `postcss` y `sharp`. El caso estructural era Next.js 16.2.6, cuya corrección segura requería una versión posterior dentro de la misma línea mayor.

No se utilizó `npm audit fix --force`.

## 2. Decisiones adoptadas

1. Actualizar Next.js de 16.2.6 a 16.3.4.
2. Alinear `eslint-config-next` a 16.3.4 para evitar divergencia entre framework y configuración ESLint.
3. Regenerar `package-lock.json` mediante instalación controlada y aplicar únicamente correcciones compatibles de `npm audit`.
4. Convertir `npm audit --omit=dev --audit-level=high` en un gate bloqueante de la CI de pull requests.
5. Hacer que GitHub Pages ejecute la suite completa antes de construir y publicar.
6. Ejecutar las pruebas con `env -u GITHUB_ACTIONS npm test` para evitar el falso 404 del test de HTML renderizado cuando el entorno de Actions activa el `basePath` de Pages.
7. Retirar el workflow temporal utilizado exclusivamente para regenerar dependencias una vez cumplida su función.

## 3. Implementación

### `package.json` y `package-lock.json`

- `next`: 16.2.6 → 16.3.4.
- `eslint-config-next`: alineado a 16.3.4.
- dependencias transitivas vulnerables actualizadas a versiones corregidas compatibles.

### `.github/workflows/geovisor-ci.yml`

La auditoría productiva pasa de diagnóstico no bloqueante a gate obligatorio:

```bash
npm audit --omit=dev --audit-level=high
```

Si npm detecta una vulnerabilidad que alcance el umbral configurado, el job falla y el PR deja de tener CI verde.

La CI conserva además:

- `npm ci`;
- lint;
- build Vite/Vinext;
- suite web completa;
- exportación Next.js para GitHub Pages;
- comprobación de activos MapLibre;
- comprobación de manifiestos y shards territoriales.

### `.github/workflows/pages.yml`

Antes de `npm run build:pages`, el workflow de publicación ejecuta:

```bash
env -u GITHUB_ACTIONS npm test
```

Un push a `main` ya no puede publicar correctamente si falla la suite completa.

### Workflow temporal de dependencias

`.github/workflows/mb03-refresh-dependencies.yml` fue eliminado después de completar la regeneración controlada de `package.json` y `package-lock.json`.

## 4. Validación final del código de MB-03

La CI del PR #8 sobre el commit `de34a518a11b4c84882667c1f3766c02fbf1fbe7` terminó correctamente en el run `34232532784`.

Resultados comprobados:

- `npm ci`: correcto;
- `npm audit --omit=dev --audit-level=high`: **found 0 vulnerabilities**;
- lint: correcto;
- Vite/Vinext: compilación correcta;
- pruebas Node: **38/38 aprobadas, 0 fallos**;
- exportación GitHub Pages: correcta con **Next.js 16.3.4**;
- activos MapLibre: presentes;
- catálogo territorial: **22.952 fichas**, **439 fragmentos**, máximo **82.273 bytes**;
- control de calidad heredado de MB-02: **13.959 campos de fecha normalizados** y **478 estados ANM con forma de fecha suprimidos**.

## 5. Riesgos y advertencias que no pertenecen a MB-03

El warning conocido de Recharts durante prerender (`width(-1)` / `height(-1)`) continúa apareciendo. No provoca fallo de build ni de pruebas y se mantiene separado para el bloque de rendimiento/estabilidad correspondiente.

La auditoría original agrupó en `QA-001` tanto la ausencia de pruebas en el despliegue directo como la ausencia de E2E reales. MB-03 corrige la primera parte. La cobertura E2E real sigue siendo un pendiente de QA y no se presenta aquí como resuelta.

También aparecen avisos del runtime de GitHub Actions relacionados con acciones que todavía declaran Node 20 y son ejecutadas por el runner con Node 24. No afectan el resultado de MB-03 y deben tratarse como mantenimiento posterior del workflow, sin mezclarlo con la corrección de dependencias de la aplicación.

## 6. Criterio de cierre

MB-03 puede cerrarse cuando:

1. la CI final del PR permanezca verde con el audit ya bloqueante;
2. `package.json` y `package-lock.json` conserven Next.js y `eslint-config-next` 16.3.4;
3. el workflow temporal haya sido retirado;
4. el PR #8 se integre a `main`;
5. el workflow de GitHub Pages termine correctamente después del merge.

Hasta el merge no se modifica la aplicación pública. No se ha tocado el geovisor ni la cartografía en este bloque.
