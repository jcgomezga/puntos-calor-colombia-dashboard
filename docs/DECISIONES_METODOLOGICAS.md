# Decisiones metodológicas

| ID | Decisión | Motivo | Estado |
|---|---|---|---|
| DM-001 | Crear repositorio nacional independiente | Evitar mezclar datos y versiones con Tolima | Aprobada |
| DM-002 | Publicar sin ArcGIS Online | Restricción tecnológica del usuario | Aprobada |
| DM-003 | Usar GitHub Pages | Alojamiento abierto y automatizable | Aprobada, pendiente de publicación |
| DM-004 | Priorizar CSV diario IDEAM | Contiene más atributos que el JSON compacto | Aprobada |
| DM-005 | Usar MGN 2025 del DANE | Referencia oficial territorial | Aprobada, pendiente de integración |
| DM-006 | Mantener escenarios A y B | No trasladar sin prueba la decisión de Tolima | Aprobada |
| DM-007 | Rotular el prototipo como demostrativo | Evitar confundir cifras ficticias con resultados | Aprobada |
| DM-008 | No inferir incendios ni causalidad | La anomalía térmica no es confirmación causal | Aprobada |
| DM-009 | Conservar histórico acumulativo desde 2026-07-01 | Limitar el proyecto al periodo solicitado y mantener un corte reproducible | Aprobada |

## Aplicación de DM-009

- El corte es inclusivo: `2026-07-01 00:00:00` en `America/Bogota`.
- No se descargan deliberadamente ni se almacenan archivos diarios anteriores.
- Si una fuente contiene filas anteriores mezcladas con registros válidos, se descartan antes de escribir cualquier salida; la bitácora puede guardar únicamente el conteo rechazado.
- Los resúmenes, gráficos, indicadores, exportaciones y filtros usan el mismo límite.
- El histórico posterior al corte es acumulativo; no se elimina al superar una ventana de 30 o 90 días.
- La regla está centralizada en `config/data-policy.json` para que la compartan la interfaz, las pruebas y la futura ingesta.

## Decisiones pendientes

- Ventana temporal predeterminada.
- Regla definitiva de deduplicación.
- Tratamiento de puntos fronterizos o sin asignación DANE.
- Estrategia de compresión o almacenamiento cuando aumente el tamaño del histórico acumulativo.
- Frecuencia de actualización según disponibilidad real del IDEAM.
