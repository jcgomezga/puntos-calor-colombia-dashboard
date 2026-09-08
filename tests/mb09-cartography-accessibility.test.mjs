import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const geovisor = readFileSync("components/public-detection-geovisor-map.tsx", "utf8");
const basic = readFileSync("components/dashboard-map.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("MB-09 mantiene consulta cartográfica explícita y alternativa de teclado", () => {
  assert.match(geovisor, /Consultar centro del mapa/);
  assert.match(geovisor, /queryAtPoint/);
  assert.match(geovisor, /role="status" aria-live="polite"/);
  assert.doesNotMatch(geovisor, /map.on("click", "hotspot-clusters"/);
  assert.match(basic, /tabIndex={0}/);
  assert.match(basic, /event.key === "Enter" || event.key === " "/);
});

test("MB-09 documenta clusters, situación ANLA y carga remota IDEAM", () => {
  assert.match(geovisor, /Leyenda de detecciones/);
  assert.match(geovisor, /no intensidad ni severidad de un incendio/);
  assert.match(geovisor, /Leyenda ANLA/);
  assert.match(geovisor, /"circle-color": ["match", ["get", "situacion"]/);
  assert.match(geovisor, /coverageStatusRef/);
  assert.match(geovisor, /Cobertura IDEAM: cargando teselas remotas/);
});

test("MB-09 reduce saturación del mapa básico sin alterar conteos", () => {
  assert.match(basic, /NATIONAL_AGGREGATION_THRESHOLD = 2500/);
  assert.match(basic, /data-visual-aggregation={usesNationalAggregation ? "grid" : "points"}/);
  assert.match(page, /se agregan solo para evitar saturación; los conteos analíticos no cambian/);
  assert.match(page, /Las fichas de detección, cobertura y contexto requieren el Geovisor/);
});

test("MB-09 colapsa controles móviles y aumenta targets cartográficos", () => {
  assert.match(geovisor, /panelOpen/);
  assert.match(geovisor, /aria-expanded={panelOpen}/);
  assert.match(css, /.geovisor-map .maplibregl-ctrl-group button { width: 44px; height: 44px; }/);
  assert.match(css, /.layer-control.collapsed .layer-control-heading { display: none; }/);
});
