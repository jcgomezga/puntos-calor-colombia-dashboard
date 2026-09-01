# Contrato de ingesta IDEAM — Fase 2

## Fuente

Cada fecha se consulta mediante:

```text
https://puntosdecalor.ideam.gov.co/archivos-csv/Puntos_de_calor_Colombia_YYYY-MM-DD.csv
```

Los archivos usan punto y coma como delimitador, coma decimal y fecha-hora local de Colombia.

## Corte histórico

El límite inferior es inclusivo: `2026-07-01 00:00`, `America/Bogota`. La regla se aplica en tres niveles:

1. el listado de fechas solicitadas nunca comienza antes del corte;
2. un archivo bruto anterior provoca un error de integridad;
3. cualquier fila anterior mezclada en un archivo admitido se rechaza antes de las salidas normalizadas.

## Modos

- `backfill`: consulta todas las fechas desde el corte hasta el día de ejecución.
- `refresh`: vuelve a consultar el día actual y los dos anteriores para incorporar observaciones tardías o correcciones.
- `offline`: reconstruye las salidas únicamente con archivos brutos ya almacenados.

El backfill utiliza hasta cuatro descargas concurrentes con reintentos limitados. La concurrencia reduce el tiempo de recuperación inicial sin cambiar el orden determinista de las salidas.

## Identificador y duplicados

`hotspot_id` es un hash estable de fecha-hora local, coordenadas, fuente y dimensiones del píxel. No utiliza el número de fila ni un `OBJECTID`. Si el IDEAM corrige atributos variables de la misma observación —por ejemplo FRP o confianza— prevalece la versión más reciente sin crear un duplicado.

## Salidas y controles

- CSV diarios originales organizados por año y mes.
- CSV mensuales normalizados.
- manifiesto con URL, fecha, tamaño y SHA-256;
- conteos leídos, válidos, rechazados y deduplicados;
- escenarios A y B;
- resumen y bitácora de ejecución.

Un archivo ausente se registra sin detener todo el proceso. La ejecución falla si, al finalizar, no existe ningún archivo bruto procesable.
