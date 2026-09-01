# Reporte de cierre — Fase 2

**Fecha:** 1 de septiembre de 2026  
**Versión:** 0.2.0  
**Estado:** cerrada y publicada

## Objetivo

Construir y verificar la ingesta nacional de archivos diarios del IDEAM desde el corte histórico aprobado, con normalización, deduplicación, dos escenarios de sensores, procedencia y actualización automática.

## Resultado del primer backfill

| Control | Resultado |
|---|---:|
| Periodo solicitado | 2026-07-01 a 2026-08-31 |
| Archivos solicitados | 62 |
| Archivos descargados | 62 |
| Archivos ausentes | 0 |
| Descargas fallidas | 0 |
| Filas leídas | 30.890 |
| Filas únicas | 30.890 |
| Filas anteriores al corte rechazadas | 0 |
| Filas con coordenadas inválidas rechazadas | 0 |
| Escenario A | 30.890 |
| Escenario B, sin Suomi-NPP | 21.606 |

La primera observación conservada corresponde a `2026-07-01T01:33-05:00` y la última a `2026-08-31T15:46-05:00`.

### Distribución mensual

| Mes | Detecciones |
|---|---:|
| Julio de 2026 | 11.582 |
| Agosto de 2026 | 19.308 |
| **Total** | **30.890** |

### Distribución por fuente

| Fuente | Detecciones |
|---|---:|
| MODIS-Aqua | 1.648 |
| MODIS-Terra | 474 |
| VIIRS-NOAA-20 | 10.038 |
| VIIRS-NOAA-21 | 9.446 |
| VIIRS-Suomi-NPP | 9.284 |

Estas cifras describen detecciones térmicas de la fuente, no incendios confirmados ni superficie quemada.

## Productos entregados

- `scripts/update_ideam_data.py`: descarga, normalización, control temporal, deduplicación y salidas auditables;
- `scripts/prepare_ideam_ca.py`: reconstrucción y validación estricta de la cadena TLS incompleta de la fuente;
- `.github/workflows/update-data.yml`: backfill inicial, actualización cada tres horas y publicación de cambios;
- `data/raw/YYYY/MM/`: 62 CSV diarios originales con hash SHA-256;
- `data/processed/hotspots_2026-07.csv` y `hotspots_2026-08.csv`;
- `data/metadata/manifest.json`, `summary.json`, `latest_run.json` y `run_log.csv`;
- contrato de ingesta, diccionario congelado y pruebas automatizadas.

## Contrato aplicado

1. El histórico comienza de manera inclusiva el 1 de julio de 2026, hora de Colombia.
2. No se solicitan ni conservan archivos anteriores.
3. Una fila anterior al corte se rechaza antes de cualquier salida.
4. `hotspot_id` combina fecha-hora local, coordenadas, fuente, `scan` y `track` mediante SHA-256 truncado.
5. Ante una corrección de la misma observación prevalece la versión más reciente.
6. El modo `refresh` vuelve a consultar el día actual y los dos anteriores.
7. El histórico válido es acumulativo y se particiona por mes.

## Verificaciones

| Prueba | Resultado |
|---|---|
| Suite Python | 6 aprobadas, 0 fallidas |
| Suite de interfaz | 6 aprobadas, 0 fallidas |
| ESLint | Correcto |
| Compilación Vinext | Correcta |
| Exportación GitHub Pages | Correcta |
| Workflow remoto de ingesta | `33459561062`, correcto |
| Integridad del backfill | 62/62 archivos; 0 fallos |
| Corte histórico | Ninguna salida anterior a 2026-07-01 |
| TLS | Cadena, uso de servidor y nombre DNS validados con OpenSSL |

## Incidentes y resolución

| Incidente | Evidencia | Resolución | Estado |
|---|---|---|---|
| `package-lock.json` truncado en la transferencia inicial | `npm ci` remoto falló | Retransmisión aislada y verificación de tamaño | Cerrado en Fase 1 |
| Cadena TLS incompleta del IDEAM | Python y `curl` informaron emisor local ausente | Recuperar el intermedio indicado por `CA Issuers` y exigir cadena hasta una raíz confiable; nunca desactivar TLS | Cerrado |
| Archivos nuevos no detectados por `git diff` | El primer backfill procesó datos pero no creó commit | Sustituir por `git status --porcelain -- data` | Cerrado |

El servidor presentó solamente el certificado `*.ideam.gov.co`, emitido por `Sectigo Public Server Authentication CA OV R36`. El workflow obtuvo ese intermedio desde la URL AIA declarada en el certificado y OpenSSL devolvió `leaf.pem: OK`. No se utilizó `curl -k`, `verify=False` ni un certificado raíz privado.

## Checkpoints remotos

- Implementación inicial: `3bc09411fd2a608d0fbf5de184e58be0c386f6eb`.
- Descarga concurrente: `67f676e4254e672ee002fff2c7051c1e07d7eaee`.
- Transporte `curl`: `18037b0b509316a37c004213ebb2fd181ae8ae7a`.
- Reparación TLS verificada: `13f359b07475551dc37ed757219d313e10c06f64`.
- Detección de archivos nuevos: `f97a3828fa749eb3f272a52bc280741686d6dceb`.
- Primer histórico oficial: `730e232665d5fdb9ce9b0850725cdc58375aec5d`.

## Límite de la fase

Los registros todavía no tienen códigos DANE de departamento y municipio, y la interfaz continúa mostrando datos demostrativos. La Fase 3 realizará la unión espacial, verificará cierres territoriales y solo entonces conectará las cifras oficiales al dashboard.

## Próxima fase

Territorialización con el Marco Geoestadístico Nacional 2025 del DANE, control de puntos sin asignación o fronterizos, resúmenes por departamento y municipio e integración de los resultados en la interfaz.
