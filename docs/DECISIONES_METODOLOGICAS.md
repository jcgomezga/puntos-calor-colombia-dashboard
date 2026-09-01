# Decisiones metodológicas

| ID | Decisión | Motivo | Estado |
|---|---|---|---|
| DM-001 | Crear repositorio nacional independiente | Evitar mezclar datos y versiones con Tolima | Aprobada |
| DM-002 | Publicar sin ArcGIS Online | Restricción tecnológica del usuario | Aprobada |
| DM-003 | Usar GitHub Pages | Alojamiento abierto y automatizable | Implementada |
| DM-004 | Priorizar CSV diario IDEAM | Contiene más atributos que el JSON compacto | Aprobada |
| DM-005 | Usar MGN 2025 del DANE | Referencia oficial territorial | Implementada |
| DM-006 | Mantener escenarios A y B | No trasladar sin prueba la decisión de Tolima | Aprobada |
| DM-007 | Rotular el prototipo como demostrativo hasta conectar datos oficiales | Evitar confundir cifras ficticias con resultados | Cumplida; rótulo retirado en Fase 3 |
| DM-008 | No inferir incendios ni causalidad | La anomalía térmica no es confirmación causal | Aprobada |
| DM-009 | Conservar histórico acumulativo desde 2026-07-01 | Limitar el proyecto al periodo solicitado y mantener un corte reproducible | Aprobada |
| DM-010 | Revisar nuevamente los últimos tres días | Incorporar detecciones tardías o correcciones sin rehacer todo el histórico | Aprobada |
| DM-011 | Particionar la salida normalizada por mes | Mantener archivos auditables y evitar un único CSV creciente | Aprobada |
| DM-012 | Construir un `hotspot_id` estable | Deduplicar y actualizar sin depender de filas u OBJECTID | Aprobada |
| DM-013 | Validar el intermedio TLS obtenido desde AIA | La fuente omite su certificado intermedio para clientes no navegador | Implementada; nunca desactiva TLS |
| DM-014 | Actualizar cada tres horas | Equilibrar oportunidad y carga sobre la fuente | Implementada |
| DM-015 | No asignar por cercanía puntos fuera de las geometrías DANE | Evitar una precisión territorial falsa | Implementada |
| DM-016 | Verificar contra la geometría oficial completa los vacíos del caché simplificado | Resolver artefactos de simplificación sin descargar toda la capa nuevamente | Implementada |
| DM-017 | Excluir de totales territoriales los puntos sin intersección y mostrarlos en el cierre | Mantener el total nacional auditable | Implementada |
| DM-018 | Mostrar por defecto todo el histórico disponible desde julio de 2026 | Hacer visible el carácter acumulativo y permitir reducción mediante filtros | Implementada |

## Aplicación de DM-009

- El corte es inclusivo: `2026-07-01 00:00:00` en `America/Bogota`.
- No se descargan deliberadamente ni se almacenan archivos diarios anteriores.
- Si una fuente contiene filas anteriores mezcladas con registros válidos, se descartan antes de escribir cualquier salida; la bitácora puede guardar únicamente el conteo rechazado.
- Los resúmenes, gráficos, indicadores, exportaciones y filtros usan el mismo límite.
- El histórico posterior al corte es acumulativo; no se elimina al superar una ventana de 30 o 90 días.
- La regla está centralizada en `config/data-policy.json` para que la compartan la interfaz, las pruebas y la futura ingesta.

## Decisiones pendientes

- Estrategia de compresión o almacenamiento cuando aumente el tamaño del histórico acumulativo.
