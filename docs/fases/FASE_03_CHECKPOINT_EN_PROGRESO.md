# Checkpoint de pausa — Fase 3

**Fecha:** 1 de septiembre de 2026  
**Versión de trabajo:** 0.3.0-dev  
**Estado:** pausada por solicitud del usuario  
**Rama de recuperación:** `phase3-checkpoint`

## Punto de partida seguro

- La rama pública `main` permanece en `19dffd8f7e7216c106aa2204bc6869cb25c2839d`.
- Las fases 0, 1 y 2 continúan cerradas.
- El histórico oficial IDEAM conserva 30.890 detecciones únicas entre el 1 de julio y el 31 de agosto de 2026.
- La interfaz pública continúa identificada como demostrativa; ningún resultado territorial parcial fue publicado.

## Avance preservado de la Fase 3

### Auditoría del servicio DANE

Se validó el Marco Geoestadístico Nacional 2025 publicado por el DANE:

| Capa | Identificador | Control verificado |
|---|---:|---|
| Municipios | 317 | 1.122 entidades; códigos y nombres de municipio y departamento |
| Departamentos | 319 | códigos, nombres y áreas departamentales |

Campos municipales seleccionados: `DPTO_CCDGO`, `MPIO_CDPMP`, `DPTO_CNMBRE`, `MPIO_CNMBRE`, `MPIO_NAREA` y `MPIO_NANO`.

La consulta completa en una sola petición produjo un error del servidor. Se adoptó una descarga por lotes con división recursiva ante fallos, salida EPSG:4326 y tolerancia geométrica de aproximadamente 5 m para la unión. La geometría simplificada de aproximadamente 300 m se reservará para visualización, no para asignación territorial.

### Implementación local

- `scripts/territorialize_hotspots.py`: descarga por lotes, índice espacial, prueba punto-en-polígono, asignación administrativa, cierres y productos compactos para el dashboard.
- `tests_py/test_territorialize_hotspots.py`: casos de interior, frontera compartida, punto no asignado y hueco de polígono.
- `.github/workflows/update-data.yml`: preparación para ejecutar la territorialización después de la ingesta.
- `data/boundaries/mgn2025_municipios_join.geojson.gz`: caché local íntegro de 1.122 municipios para reanudar sin repetir la descarga mientras este entorno siga disponible.

Integridad del caché:

```text
SHA-256: 523371a32debfe9cc4fcb767e0e7fa4828bcea032f1bf561fbbec179ec142e68
Tamaño aproximado: 11 MB
Entidades: 1.122
```

## Decisiones metodológicas preservadas

1. No asignar por cercanía el municipio de un punto que quede fuera de todas las geometrías.
2. Marcar para revisión los puntos situados sobre una frontera o incluidos en más de una geometría.
3. Excluir temporalmente de los totales territoriales los registros ambiguos o no asignados y reportarlos por separado.
4. Exigir que los totales nacionales cierren contra asignados, fronterizos y no asignados antes de conectar la interfaz.
5. Mantener los escenarios A y B separados en todos los resúmenes.

## Verificación completada

| Control | Resultado |
|---|---|
| Compilación del script territorial | Correcta |
| Pruebas de ingesta y TLS | 6 aprobadas |
| Pruebas de geometría territorial | 4 aprobadas |
| Total de pruebas Python | 10 aprobadas, 0 fallidas |
| Caché DANE | gzip y JSON válidos; 1.122 entidades |

## Actividad detenida

La ejecución real de territorialización fue interrumpida deliberadamente al recibir la solicitud de pausa. El caché municipal ya había terminado de escribirse, pero no se generaron ni publicaron estadísticas departamentales, municipales o archivos de interfaz.

## Orden exacto de reanudación

1. Recuperar la rama `phase3-checkpoint` y leer este documento.
2. Confirmar que `main` sigue siendo el último estado público estable antes de integrar cambios.
3. Comprobar si existe `data/boundaries/mgn2025_municipios_join.geojson.gz`. Si el entorno local fue descartado, el script lo reconstruirá desde el servicio oficial del DANE.
4. Ejecutar `python scripts/territorialize_hotspots.py --workers 4 --batch-size 25`.
5. Verificar cierres nacionales, departamentales y municipales, además de los registros fronterizos o no asignados.
6. Auditar los archivos compactos generados antes de modificar la interfaz.
7. Conectar datos reales, reemplazar la etiqueta demostrativa y ejecutar pruebas de interfaz, lint y build.
8. Publicar en `main` solo después de cerrar la Fase 3 y actualizar la matriz acumulativa.

## Pendientes

- Completar la asignación espacial de las 30.890 detecciones.
- Generar resúmenes por departamento y municipio.
- Medir y documentar casos fronterizos y no asignados.
- Integrar datos reales en filtros, indicadores, mapa y gráficos.
- Ejecutar validación visual y funcional.
- Crear el reporte final de la Fase 3 y publicar el resultado estable.
