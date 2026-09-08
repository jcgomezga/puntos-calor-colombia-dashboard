# Implementación MB-05 — accesibilidad y responsive no cartográfico

Fecha: 2026-09-08  
Rama: `fix/accessibility-responsive-non-map`  
PR: #11  
Base: `main` @ `5305a2876e18a941f7d52ebbfee2a261a9deed14`

## Alcance

MB-05 atiende los hallazgos `A11Y-002`, `A11Y-003` y las partes **no cartográficas** de `A11Y-004` y `RESP-001`. El bloque no modifica geometrías, clustering, prioridad de clic, fuentes/capas, simbología, comportamiento MapLibre ni la lógica espacial del dashboard.

La accesibilidad y operación espacial equivalentes del geovisor —incluidos los controles internos MapLibre de 29 px, el panel de capas y la validación cartográfica móvil— permanecen reservadas para MB-09.

## Cambios implementados

### Contraste de texto pequeño

Los detalles de métricas, el estado de carga de gráficos y el pie de página dejaron de usar `#7a857e`, color identificado en la auditoría con contraste insuficiente para texto normal. Esos elementos usan ahora el token `--muted` (`#637068`).

El test automatizado calcula luminancia relativa y exige WCAG AA >= 4,5:1. Con los colores actuales, `#637068` alcanza aproximadamente **5,19:1 sobre blanco** y **4,72:1 sobre `--canvas` (`#f2f5f1`)**.

### Semántica de estados

Los botones de `Geovisor / Mapa básico` y `Días / Meses` publican ahora el estado seleccionado mediante `aria-pressed`, además de conservar la señal visual existente.

### Alternativas textuales de gráficos

La representación SVG generada por Recharts queda marcada como decorativa para tecnologías de asistencia. Cada gráfico publica un `figcaption` accesible con nombre y resumen de los valores visibles. El estado sin datos conserva un mensaje explícito y recibe un nombre accesible contextual.

### Targets y foco no cartográficos

Los controles propios del dashboard incluidos en MB-05 alcanzan un mínimo de 44 px de alto:

- fechas;
- selectores territoriales y temáticos;
- `Restablecer`;
- `Geovisor / Mapa básico`;
- `Días / Meses`.

Estos controles y los enlaces metodológicos relevantes incorporan un contorno `:focus-visible` explícito de 3 px.

### Responsive verificable

Se incorporó `scripts/check-responsive-layout.mjs` a la CI. El script abre la exportación real de GitHub Pages en Chrome headless mediante DevTools Protocol, sin mocks de layout, y verifica:

- ausencia de desbordamiento horizontal;
- que los contenedores principales permanezcan dentro del viewport;
- targets >= 44×44 px para los controles no cartográficos definidos por el bloque;
- apilamiento de filtros y gráficos en móvil.

La prueba se ejecuta en 1440×900, 1024×768, 768×1024 y 390×844.

## Validación observada

Ejecución de PR: **GitHub Actions run 34242058389** (`Validar geovisor`, run 140).

Resultado: **verde completo**.

- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades.
- lint: correcto.
- Vite/Vinext + suite web: **47/47 pruebas**.
- exportación Next.js/GitHub Pages: correcta.
- gate responsive en Chrome: correcto en los cuatro viewports.
- presupuesto JavaScript: correcto; mayor chunk **1.081.409 bytes gzip**, bajo el límite de 1.250.000 bytes.
- fichas territoriales: **22.952 registros**, 439 fragmentos, máximo 82.273 bytes; contrato preservado.

### Mediciones del gate responsive

| Perfil | Viewport | Ancho documento | Filtros | Gráficos laterales | Targets inspeccionados |
|---|---:|---:|---:|---:|---|
| Desktop | 1440×900 | 1425 px | 3 columnas | 1 columna | >= 44 px de alto |
| Laptop | 1024×768 | 1009 px | 3 columnas | 1 columna | >= 44 px de alto |
| Tablet | 768×1024 | 753 px | 3 columnas | 2 columnas | >= 44 px de alto |
| Móvil | 390×844 | 390 px | 1 columna | 1 columna | >= 44×44 px |

En ninguno de los cuatro perfiles el documento superó el ancho interior disponible ni un contenedor principal salió del viewport.

## Controles de no regresión

`tests/accessibility-responsive.test.mjs` protege:

1. `aria-pressed` en los dos grupos de botones;
2. alternativa textual de los gráficos y ocultamiento de la representación Recharts a tecnologías de asistencia;
3. contraste mínimo AA del token utilizado en texto pequeño corregido;
4. targets mínimos de 44 px para controles no cartográficos;
5. presencia del gate Chrome y de los cuatro anchos representativos;
6. separación de alcance: los 29 px actuales de los controles MapLibre permanecen explícitamente sin modificar hasta MB-09.

## Residuales deliberados

MB-05 **no cierra** la accesibilidad cartográfica. Siguen pendientes para MB-09, entre otros:

- targets de los controles MapLibre y controles de capas;
- equivalentes no visuales de consulta/selección espacial;
- navegación por teclado dentro del geovisor;
- validación responsive específica del mapa, popups y paneles cartográficos;
- cualquier ajuste de simbología o prioridad de interacción.

Tampoco convierte este gate de layout en una suite E2E funcional completa; esa cobertura corresponde a MB-07.
