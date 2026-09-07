import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const geovisorSource = await readFile(`${root}/components/geovisor-map.tsx`, "utf8");
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8"));

test("keeps the geovisor implementation and the legacy fallback together", () => {
  assert.match(pageSource, /useState<MapMode>\("geovisor"\)/);
  assert.match(pageSource, /<GeovisorMap/);
  assert.match(pageSource, /<DashboardMap/);
  assert.equal(packageJson.dependencies["maplibre-gl"], "^6.7.0");
  assert.equal(packageJson.dependencies.pmtiles, "^4.5.0");
});

test("publishes the four territorial context sources as optional PMTiles layers", () => {
  assert.match(geovisorSource, /context-layers\.pmtiles/);
  assert.match(geovisorSource, /maplibregl\.addProtocol\("pmtiles"/);
  for (const layer of ["runap", "anm", "anla", "anh"]) {
    assert.match(geovisorSource, new RegExp(`"source-layer": "${layer}"`));
    assert.match(geovisorSource, new RegExp(`${layer}: false`));
    assert.match(geovisorSource, new RegExp(`toggleLayer\\("${layer}"\\)`));
  }
  assert.match(geovisorSource, /queryModeRef\.current === "context"/);
  assert.match(geovisorSource, /contextPopup\(feature\)/);
});

test("uses the official IDEAM 2024 vector tile endpoint and its complete symbol catalog", () => {
  assert.match(
    geovisorSource,
    /visualizador\.ideam\.gov\.co\/gisserver\/rest\/services\/Hosted\/MNCT_2024V01_VT\/VectorTileServer\/tile\/\{z\}\/\{y\}\/\{x\}\.pbf/,
  );
  assert.match(geovisorSource, /Mapa Nacional de las Coberturas de la Tierra 2024/);
  const catalogBlock = geovisorSource.match(/const LAND_COVER_CLASSES = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  assert.equal(catalogBlock.match(/^\s+\["/gm)?.length, 54);
});

test("preserves synchronized DANE selection and clustered heat detections", () => {
  assert.match(geovisorSource, /cluster:\s*true/);
  assert.match(geovisorSource, /callbacksRef\.current\.onDepartment/);
  assert.match(geovisorSource, /callbacksRef\.current\.onMunicipality/);
  assert.match(geovisorSource, /dane-departments/);
  assert.match(geovisorSource, /dane-municipalities/);
});
