# Datos generados

Este directorio es administrado por `scripts/update_ideam_data.py`.

- `raw/YYYY/MM/`: copia de los CSV diarios oficiales del IDEAM desde el 1 de julio de 2026.
- `processed/`: observaciones normalizadas y deduplicadas, particionadas por mes.
- `metadata/manifest.json`: procedencia, hash, tamaño y controles por archivo.
- `metadata/summary.json`: resumen acumulativo del histórico válido.
- `metadata/latest_run.json`: resultado de la última ejecución.
- `metadata/run_log.csv`: bitácora acumulativa de ejecuciones.

No se admite contenido anterior a `2026-07-01`. Los archivos de este directorio son salidas reproducibles y no deben editarse manualmente.
