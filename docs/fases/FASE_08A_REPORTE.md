# Fase 8A — Geovisor piloto con polígonos de cobertura

Inicio técnico: 7 de septiembre de 2026.

## Propósito

Convertir el mapa fijo del dashboard en un geovisor navegable sin modificar la cadena de datos, los filtros, los indicadores, los episodios ni los checkpoints cerrados. La implementación se mantiene inicialmente en una rama aislada y conserva el mapa anterior como respaldo.

## Alcance implementado

- motor cartográfico WebGL con MapLibre GL JS 6.7;
- navegación con arrastre, zoom, escala y controles de orientación;
- detecciones IDEAM agrupadas dinámicamente por nivel de zoom;
- límites departamentales y municipales DANE 2025 sincronizados con los filtros existentes;
- polígonos del Mapa Nacional de Coberturas de la Tierra IDEAM 2024 mediante teselas vectoriales oficiales;
- 54 símbolos oficiales de cobertura, con color y consulta de clase;
- control de visibilidad y opacidad por capa;
- selector explícito de consulta por territorio o cobertura;
- ventana de atributos para detecciones y coberturas;
- conmutador para volver al mapa SVG/canvas anterior.

## Fuente cartográfica remota

La capa inicial usa directamente el servicio oficial:

`https://visualizador.ideam.gov.co/gisserver/rest/services/Hosted/MNCT_2024V01_VT/VectorTileServer`

El navegador solicita PBF por tesela y nivel de zoom. Los polígonos no se incorporan al paquete estático del dashboard ni alteran el resultado de los cruces espaciales ya calculados.

## Decisiones de compatibilidad

1. El geovisor consume exactamente `visiblePoints`; por tanto, todos los filtros y la selección de episodios continúan gobernando el conjunto visible.
2. Los GeoJSON DANE existentes se reutilizan sin regeneración ni cambio de esquema.
3. La capa remota se dibuja debajo de límites y detecciones para conservar la lectura operativa.
4. Si falla la capa IDEAM remota, los límites y puntos locales siguen disponibles y la interfaz informa la degradación.
5. ANM, ANLA, ANH y RUNAP continúan en esta fase como atributos y filtros ya procesados. La publicación de sus geometrías se reserva para una fase posterior de empaquetado vectorial, para no cargar archivos masivos en el navegador.

## Validación local

- TypeScript sin errores.
- Exportación estática de Next.js aprobada.
- Pruebas automatizadas de configuración agregadas para verificar el endpoint oficial, las 54 clases, la selección territorial, el agrupamiento de detecciones y la conservación del mapa de respaldo.

## Estado

Piloto implementado en `feature/geovisor-fase-8a`. No reemplaza todavía la versión pública de GitHub Pages. El siguiente control es una revisión visual y funcional antes de solicitar integración a `main`.
