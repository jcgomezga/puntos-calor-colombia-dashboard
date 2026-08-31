# Puntos de calor Colombia · Dashboard

Dashboard nacional, abierto y reproducible para explorar detecciones térmicas publicadas por el IDEAM, diferenciadas por departamento y municipio.

> Estado actual: **prototipo de interfaz con datos demostrativos**. Las cifras visibles todavía no son resultados oficiales. La conexión automatizada con IDEAM y la asignación territorial DANE corresponden a las fases 2 y 3.

## Alcance

- Consulta territorial nacional por departamento y municipio.
- Escenario A: todos los sensores disponibles.
- Escenario B: análisis de sensibilidad sin Suomi-NPP.
- Estadísticas temporales, territoriales y por sensor.
- Actualización programada mediante GitHub Actions una vez validado el flujo.
- Publicación prevista mediante GitHub Pages, sin ArcGIS Online.

Una detección térmica no confirma por sí sola un incendio, su causa ni una actividad específica.

## Ejecución local

```bash
npm ci
npm run dev
```

Validaciones:

```bash
npm run lint
npm run build
npm run build:pages
npm test
```

## Trazabilidad

- [Gobernanza y alcance](docs/00_GOBERNANZA_Y_ALCANCE.md)
- [Matriz acumulativa](docs/MATRIZ_TRAZABILIDAD.csv)
- [Fuentes](docs/FUENTES.md)
- [Diccionario de datos](docs/DICCIONARIO_DATOS.md)
- [Decisiones metodológicas](docs/DECISIONES_METODOLOGICAS.md)
- [Reportes por fase](docs/fases)

## Separación respecto del proyecto Tolima

Este repositorio no importa ni modifica `jcgomezga/incendios-tolima-2026`. El estudio de Tolima se usa únicamente como antecedente metodológico; el flujo nacional tendrá sus propios controles, datos y versiones.
