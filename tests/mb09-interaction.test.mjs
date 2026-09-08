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

test("routes every spatial query through the explicit selected mode", () => {
  assert.match(source, /const queryAtPoint = async/);
  assert.match(source, /const mode = queryModeRef\.current;/);
  assert.match(source, /if \(mode === "hotspot"\)/);
  assert.match(source, /if \(mode === "coverage"/);
  assert.match(source, /if \(mode === "context"\)/);
  assert.equal(source.includes('map.on("click", "hotspot-clusters"'), false, "No deben quedar handlers de clic por capa que eludan el modo elegido.");
  assert.equal(source.includes('map.on("click", "hotspot-unclustered"'), false, "No deben quedar handlers de clic por capa que eludan el modo elegido.");
  assert.match(source, /map\.on\("click", \(event\) => \{ void queryAtPoint\(event\.point, event\.lngLat\); \}\)/);
});

test("collects and deduplicates every rendered context entity instead of silently taking index zero", () => {
  assert.match(source, /function uniqueContextFeatures\(features: MapGeoJSONFeature\[\]\)/);
  assert.match(source, /contextFeatureIdentity/);
  assert.match(source, /uniqueContextFeatures\(map\.queryRenderedFeatures\(point, \{ layers: contextLayers \}\)\)/);
  assert.doesNotMatch(source, /queryRenderedFeatures\(point, \{ layers: contextLayers \}\)\[0\]/);
  assert.match(source, /contextSelectionPopup\(features, lngLat\)/);
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
