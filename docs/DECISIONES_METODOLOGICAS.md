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
| DM-019 | Clasificar dentro/fuera de RUNAP sin buffers | Separar una relación espacial verificable de cualquier inferencia de afectación | Implementada en Fase 4A |
| DM-020 | Contar hotspots únicos y conservar todas las coincidencias RUNAP | Evitar inflar indicadores cuando existen polígonos superpuestos | Implementada en Fase 4A |
| DM-021 | Usar la cobertura IDEAM 2024 a escala 1:100.000 | Es el producto nacional oficial más reciente disponible para el cruce | Implementada en Fase 4B |
| DM-022 | Asignar cobertura por intersección puntual y no por cercanía | Evitar atribuir una clase inexistente cuando el punto queda fuera de los polígonos | Implementada en Fase 4B |
| DM-023 | Persistir la cobertura por `hotspot_id` y consultar solo identificadores nuevos | Hacer sostenibles las actualizaciones cada tres horas sin reprocesar el histórico completo | Implementada en Fase 4B |
| DM-024 | Filtrar la interfaz por nivel 1 y conservar la leyenda detallada en los datos | Mantener un selector legible sin perder trazabilidad CORINE | Implementada en Fase 4B |
| DM-025 | Separar ANM, ANLA y ANH en fases independientes | Sus geometrías, estados jurídicos y significados no son equivalentes | Aprobada |
| DM-026 | Relacionar ANM únicamente por intersección directa con títulos vigentes | Evitar confundir proximidad con pertenencia al polígono del título | Implementada en Fase 4C |
| DM-027 | Contar hotspots únicos y conservar todas las coincidencias ANM | Evitar inflar indicadores cuando existen títulos superpuestos | Implementada en Fase 4C |
| DM-028 | Renovar el caché ANM como máximo cada 24 horas | Mantener vigencia sin descargar 10.000 polígonos en cada ejecución de tres horas | Implementada en Fase 4C |

## Aplicación de DM-009

- El corte es inclusivo: `2026-07-01 00:00:00` en `America/Bogota`.
- No se descargan deliberadamente ni se almacenan archivos diarios anteriores.
- Si una fuente contiene filas anteriores mezcladas con registros válidos, se descartan antes de escribir cualquier salida; la bitácora puede guardar únicamente el conteo rechazado.
- Los resúmenes, gráficos, indicadores, exportaciones y filtros usan el mismo límite.
- El histórico posterior al corte es acumulativo; no se elimina al superar una ventana de 30 o 90 días.
- La regla está centralizada en `config/data-policy.json` para que la compartan la interfaz, las pruebas y la futura ingesta.

## Decisiones pendientes

- Estrategia de compresión o almacenamiento cuando aumente el tamaño del histórico acumulativo.
- Regla de distancia y tratamiento por geometría para proyectos ANLA de la Fase 4D.
- Selección de categorías contractuales del Mapa de Tierras ANH para la Fase 4E.
