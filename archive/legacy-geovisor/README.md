# Geovisor legado archivado

Este directorio conserva la implementación histórica que antes vivía en `components/geovisor-map.tsx`.

No forma parte del frontend público activo, no debe importarse desde `app/` ni `components/` y está excluido de TypeScript y ESLint. Se conserva únicamente como referencia histórica y para reproducibilidad de decisiones previas del geovisor.

La implementación pública canónica se resuelve mediante el alias `@/components/geovisor-map` hacia `components/geovisor-entry.tsx`, que carga `components/public-detection-geovisor-map.tsx`.

`components/operational-geovisor-map.tsx` no es este legado: se mantiene intencionalmente porque conserva la lógica de episodios espacio-temporales para un futuro módulo de análisis detallado.
