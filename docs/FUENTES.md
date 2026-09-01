# Fuentes oficiales

## IDEAM — detecciones térmicas

- Portal: https://puntosdecalor.ideam.gov.co/
- Índice de archivos CSV diarios: https://puntosdecalor.ideam.gov.co/archivos-csv/
- Patrón diario: `Puntos_de_calor_Colombia_YYYY-MM-DD.csv`.
- Código público del portal: https://github.com/SMByC/puntosdecalor.ideam.gov.co

Aspectos comprobados en el código público del portal:

- delimitador CSV: punto y coma (`;`);
- separador decimal: coma;
- hora mostrada para Colombia: UTC−5;
- fuentes satelitales: productos MODIS y VIIRS/FIRMS;
- el endpoint compacto `/active_fires.json/` no contiene todos los atributos analíticos, por lo que el proceso reproducible priorizará los CSV diarios.

## DANE — límites territoriales

- Servicio MGN 2025: https://geoportal.dane.gov.co/mparcgis/rest/services/MGN2025/Serv_CapasMGN_2025/FeatureServer
- Capa municipal: 317.
- Capa departamental: 319.

Antes de automatizar se verificará licencia, disponibilidad, esquema de campos, códigos DIVIPOLA y estabilidad de las rutas.

## RUNAP — áreas protegidas

- Entidad: Parques Nacionales Naturales de Colombia.
- Servicio: `https://mapas.parquesnacionales.gov.co/arcgis/rest/services/pnn/runap/FeatureServer/0`.
- Uso: relación puntual `dentro/fuera` con las áreas inscritas en RUNAP.
- Campos auditables: identificador, nombre, categoría, condición y autoridad ambiental.
- La intersección espacial no confirma incendio, afectación ni causalidad.

## Regla de procedencia

Cada actualización deberá registrar URL de origen, fecha UTC de descarga, nombre, tamaño, hash SHA-256, filas leídas, filas válidas, duplicados, rechazos y fecha máxima observada.
