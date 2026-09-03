# Fase 7 — Exploración detallada y seguimiento longitudinal

Inicio técnico: 2 de septiembre de 2026, hora de Colombia.

## Propósito

La fase convierte el resultado agregado de episodios en una superficie de exploración y mejora su auditoría entre actualizaciones, sin cambiar la configuración aprobada `episodes-b-1000m-24h-min3-v1` ni almacenar copias completas repetitivas.

## Cambios implementados

### Seguimiento longitudinal

El linaje distingue siete cambios:

| Tipo | Significado |
|---|---|
| `created` | Identidad nueva sin miembros de episodios previos |
| `expanded` | El episodio conserva todos sus miembros y agrega detecciones |
| `contracted` | Conserva identidad pero pierde miembros |
| `revised` | Cambia miembros sin variar el tamaño total |
| `merged` | Absorbe miembros de otra identidad previa |
| `split` | Parte de una identidad previa forma otro episodio |
| `retired` | La identidad deja de existir en el conjunto actual |

Los episodios sin cambios no agregan filas al linaje. Esto mantiene la trazabilidad sin producir aproximadamente 1.900 registros redundantes cada tres horas.

### Explorador de episodios

La interfaz incorpora:

- ranking de los diez episodios con más miembros visibles;
- actualización del ranking con todos los filtros existentes;
- detalle de duración, extensión, FRP y territorios;
- identificación explícita de episodios encadenados;
- selección para aislar en el mapa los miembros visibles de un episodio;
- resumen de cambios de la última actualización.

La selección del episodio no modifica los indicadores generales: estos permanecen como contexto del universo filtrado. Solo cambia el conjunto dibujado en el mapa.

## Control de volumen

`episodeChanges` publica únicamente los eventos de la última ejecución. `episode_lineage.csv` acumula los cambios reales. No se crean snapshots completos por ejecución.

## Validación

- 12/12 pruebas focalizadas de sensibilidad, identidad y linaje aprobadas.
- 11/11 pruebas web aprobadas.
- `lint` aprobado.
- exportación estática aprobada.
- 55/55 pruebas Python aprobadas en el workflow integral.
- validación de cierres generados aprobada antes del commit automático.

## Primera ejecución longitudinal

El primer refresco conservó 1.901 episodios, 22.165 hotspots B y las demás cifras de la Fase 6B. Produjo cero eventos de linaje porque no existieron cambios de datos entre los dos cortes. Este resultado valida que los episodios sin modificaciones no crean filas redundantes.

## Publicación verificada

- Implementación: `b5064f0f332036a7aca92e5f29e43afd21ae4088`.
- Workflow integral: `33715992975`, correcto.
- Datos regenerados: `5c7a7f2ee7d00d3d07f286623d0033e6f0546f8e`.
- GitHub Pages: `33716313240`, correcto.

Estado final: Fase 7 cerrada.
