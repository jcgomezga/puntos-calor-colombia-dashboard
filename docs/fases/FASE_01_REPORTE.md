# Reporte de cierre — Fase 1

**Fecha:** 31 de agosto de 2026  
**Versión:** 0.1.0  
**Estado:** cerrada localmente; publicación remota pendiente

## Objetivo

Demostrar la navegación y jerarquía visual antes de conectar fuentes oficiales.

## Funcionalidad entregada

- filtros de departamento y municipio dependiente;
- escenarios A/B y restablecimiento;
- indicadores, vista espacial, ranking y serie temporal;
- advertencia metodológica persistente;
- diseño adaptable.

## Controles ejecutados

| Prueba | Comando | Resultado |
|---|---|---|
| Calidad estática | `npm run lint` | Correcto, código 0 |
| Compilación Vinext | `npm run build` | Correcto, código 0 |
| Exportación GitHub Pages | `npm run build:pages` | Correcto, código 0 |
| Suite automatizada | `npm test` | 5 aprobadas, 0 fallidas |
| TypeScript y cliente | Integrado en compilación | Correcto |
| Etiquetado demostrativo | Revisión del contenido | Visible en encabezado, mapa y pie |

## Limitaciones deliberadas

- cifras sintéticas;
- silueta espacial esquemática;
- catálogo territorial parcial;
- sin descarga ni transformación IDEAM.

La interfaz señala estas limitaciones para impedir una interpretación sustantiva prematura.

## Próxima fase

Construir la ingesta diaria IDEAM con manifiesto, hash, normalización, deduplicación, escenarios A/B y pruebas con archivos reales.

## Publicación del checkpoint

- Repositorio: `jcgomezga/puntos-calor-colombia-dashboard`.
- Inventario remoto: 107 archivos versionados.
- Durante la primera transferencia se truncó `package-lock.json`; el control de `npm ci` detectó el problema.
- El archivo fue retransmitido completo y aislado en el commit remoto `bf3bb55`.
- La validación final de GitHub Pages queda sujeta al resultado del segundo workflow.
