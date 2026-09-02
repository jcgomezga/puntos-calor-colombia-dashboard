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

## IDEAM — cobertura de la tierra 2024

- Entidad: Instituto de Hidrología, Meteorología y Estudios Ambientales (IDEAM).
- Servicio: `https://visualizador.ideam.gov.co/gisserver/rest/services/Estado_Cobertura_Tierra/MapServer/10`.
- Producto: cobertura de la tierra 1:100.000, periodo 2024, límite administrativo.
- Metodología de clasificación: CORINE Land Cover adaptada para Colombia.
- Campos conservados: código, leyenda, niveles 1 a 6, confiabilidad, insumo y apoyo.
- Uso en el dashboard: asignar el contexto de cobertura 2024 a cada detección mediante intersección puntual.
- La cobertura de 2024 no representa superficie quemada en 2026 ni prueba que la detección corresponda a un incendio.

## ANM — títulos mineros vigentes

- Entidad: Agencia Nacional de Minería (ANM).
- Servicio: `https://gisanm.anm.gov.co/server/rest/services/Hosted/Titulos_mineros/FeatureServer/0`.
- Producto: capa poligonal `titulos_vigentes`.
- Identificador del servicio: `b334d8dfbbd2401e932bb07acf6e49a5`.
- Campos conservados: expediente, solicitante, estado, modalidad, etapa, minerales, tipo de explotación y área.
- Uso en el dashboard: clasificar cada hotspot como dentro o fuera de uno o más títulos vigentes.
- La intersección espacial no confirma actividad minera en el momento de la detección ni demuestra causalidad.

## ANLA — proyectos en evaluación y licenciados

- Entidad: Autoridad Nacional de Licencias Ambientales (ANLA).
- Servicio: `https://portalsig.anla.gov.co/publico/rest/services/PROYECTOS_ANLA/ProyectosANLA/FeatureServer`.
- Capas usadas: proyectos en evaluación y licenciados con geometrías puntuales, lineales y poligonales.
- Uso: relación directa para polígonos y proximidad métrica hasta 5 km para todas las geometrías.

## ANH — Mapa de Tierras

- Entidad: Agencia Nacional de Hidrocarburos (ANH).
- Servicio histórico: `https://geovisor.anh.gov.co/server/rest/services/GEOVISOR_v32/ANH_HISTORICOS1_EGDB/MapServer`.
- Capa seleccionada al cierre de Fase 4E: `Tierras 2026-08-06`, identificador 18.
- Regla de actualización: descubrir automáticamente todas las capas `Tierras AAAA-MM-DD` y seleccionar la fecha más reciente; el identificador numérico no determina la vigencia.
- Inventario auditado: 480 áreas, de las cuales 455 están clasificadas como `ASIGNADA`, 22 como `RESERVADA` y 3 como `DISPONIBLE`.
- Uso analítico: únicamente las 455 áreas `ASIGNADA` alimentan las relaciones contractuales; las 25 restantes se conservan en el cierre de fuente, pero no se presentan como contratos.
- Campos conservados: identificador, número de contrato, nombre de área, operador, estado, tipo contractual, cuenca y proceso.
- La coincidencia o proximidad espacial no confirma actividad de hidrocarburos en el momento de la detección ni demuestra causalidad.

## Regla de procedencia

Cada actualización deberá registrar URL de origen, fecha UTC de descarga, nombre, tamaño, hash SHA-256, filas leídas, filas válidas, duplicados, rechazos y fecha máxima observada.
