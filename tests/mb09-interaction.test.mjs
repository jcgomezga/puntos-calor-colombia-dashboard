import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = await readFile(`${root}/components/public-detection-geovisor-map.tsx`, "utf8");
const css = await readFile(`${root}/app/globals.css`, "utf8");

test("makes detection an explicit click-query mode", () => {
  assert.match(source, /type QueryMode = "hotspot" \| "territory" \| "coverage" \| "context"/);
  assert.match(source, /useRef<QueryMode>\("hotspot"\)/);
  assert.match(source, /useState<QueryMode>\("hotspot"\)/);
  assert.match(source, />Detección<\/button>/);
  assert.match(source, /aria-pressed=\{queryMode === "hotspot"\}/);
});

test("does not let hotspot handlers intercept another explicit query mode", () => {
  assert.match(source, /map\.on\("click", "hotspot-clusters", async \(event\) => \{ if \(queryModeRef\.current !== "hotspot"\) return;/);
  assert.match(source, /map\.on\("click", "hotspot-unclustered", \(event\) => \{ if \(queryModeRef\.current !== "hotspot"\) return;/);
  const generic = source.indexOf('map.on("click", (event) => {');
  const coverage = source.indexOf('queryModeRef.current === "coverage"', generic);
  const context = source.indexOf('queryModeRef.current === "context"', generic);
  assert.ok(generic >= 0 && coverage > generic && context > coverage);
  const beforeCoverage = source.slice(generic, coverage);
  assert.match(beforeCoverage, /queryModeRef\.current === "hotspot"/);
  assert.doesNotMatch(beforeCoverage, /^\s*if \(map\.queryRenderedFeatures/m, "No debe existir un retorno global por hotspot antes de evaluar el modo elegido.");
});

test("collects and deduplicates every rendered context entity instead of silently taking index zero", () => {
  assert.match(source, /function uniqueContextFeatures\(features: MapGeoJSONFeature\[\]\)/);
  assert.match(source, /contextFeatureIdentity/);
  assert.match(source, /uniqueContextFeatures\(map\.queryRenderedFeatures\(event\.point, \{ layers: contextLayers \}\)\)/);
  assert.doesNotMatch(source, /queryRenderedFeatures\(event\.point, \{ layers: contextLayers \}\)\[0\]/);
});

test("exposes coincident context entities through a native selector", () => {
  assert.match(source, /coincidencias contextuales/);
  assert.match(source, /document\.createElement\("select"\)/);
  assert.match(source, /Entidad contextual coincidente/);
  assert.match(source, /contextFeatureLabel/);
  assert.match(source, /select\.addEventListener\("change"/);
  assert.match(css, /\.context-match-selector select/);
});

test("returns to a valid available query mode when a queried layer is disabled", () => {
  assert.match(source, /queryMode === "context"[^\n]+setQueryMode\("hotspot"\)/);
  assert.match(source, /queryMode === "coverage"[^\n]+setQueryMode\("hotspot"\)/);
  assert.match(source, /queryMode === "territory"[^\n]+setQueryMode\("hotspot"\)/);
  assert.match(source, /queryMode === "hotspot" && !next\.hotspots/);
});
