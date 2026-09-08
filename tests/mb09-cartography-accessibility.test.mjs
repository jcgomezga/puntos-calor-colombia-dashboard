import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const geovisor = readFileSync("components/public-detection-geovisor-map.tsx", "utf8");
const basic = readFileSync("components/dashboard-map.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("MB-09 mantiene consulta cartográfica explícita y alternativa de teclado", () => {
  assert.ok(geovisor.includes("Consultar centro del mapa"));
  assert.ok(geovisor.includes("queryAtPoint"));
  assert.ok(geovisor.includes('role="status" aria-live="polite"'));
  assert.equal(geovisor.includes('map.on("click", "hotspot-clusters"'), false);
  assert.ok(basic.includes("tabIndex={0}"));
  assert.ok(basic.includes('event.key === "Enter" || event.key === " "'));
});

test("MB-09 documenta clusters, situación ANLA y carga remota IDEAM", () => {
  assert.ok(geovisor.includes("Leyenda de detecciones"));
  assert.ok(geovisor.includes("no intensidad ni severidad de un incendio"));
  assert.ok(geovisor.includes("Leyenda ANLA"));
  assert.ok(geovisor.includes('"circle-color": ["match", ["get", "situacion"]'));
  assert.ok(geovisor.includes("coverageStatusRef"));
  assert.ok(geovisor.includes("Cobertura IDEAM: cargando teselas remotas"));
});

test("MB-09 reduce saturación del mapa básico sin alterar conteos", () => {
  assert.ok(basic.includes("NATIONAL_AGGREGATION_THRESHOLD = 2500"));
  assert.ok(basic.includes('data-visual-aggregation={usesNationalAggregation ? "grid" : "points"}'));
  assert.ok(page.includes("se agregan solo para evitar saturación; los conteos analíticos no cambian"));
  assert.ok(page.includes("Las fichas de detección, cobertura y contexto requieren el Geovisor"));
});

test("MB-09 colapsa controles móviles y aumenta targets cartográficos", () => {
  assert.ok(geovisor.includes("panelOpen"));
  assert.ok(geovisor.includes("aria-expanded={panelOpen}"));
  assert.ok(css.includes(".geovisor-map .maplibregl-ctrl-group button { width: 44px; height: 44px; }"));
  assert.ok(css.includes(".layer-control.collapsed .layer-control-heading { display: none; }"));
});
