import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const geovisorSource = await readFile(`${root}/components/public-detection-geovisor-map.tsx`, "utf8");
const geovisorEntrySource = await readFile(`${root}/components/geovisor-entry.tsx`, "utf8");
const copyWorkerSource = await readFile(`${root}/scripts/copy-maplibre-worker.mjs`, "utf8");
const runViteSource = await readFile(`${root}/scripts/run-vite.mjs`, "utf8");
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
const tsconfig = JSON.parse(await readFile(`${root}/tsconfig.json`, "utf8"));

test("keeps the geovisor implementation and the legacy fallback together", () => {
  assert.match(pageSource, /useState<MapMode>\("geovisor"\)/);
  assert.match(pageSource, /<GeovisorMap/);
  assert.match(pageSource, /<DashboardMap/);
  assert.equal(packageJson.dependencies["maplibre-gl"], "^6.7.0");
  assert.equal(packageJson.dependencies.pmtiles, "^4.5.0");
  assert.match(geovisorSource, /getContext\("webgl2"\)/);
  assert.match(geovisorSource, /Usa «Mapa básico»/);
  assert.match(pageSource, /labelColombiaDateTime/);
  assert.doesNotMatch(pageSource, /new Date\(dashboard\.metadata\.generatedAtUtc\)\.toLocaleString/);
});

test("publishes a stable MapLibre worker and context detail shards for Vite preview and GitHub Pages", () => {
  assert.deepEqual(tsconfig.compilerOptions.paths["@/components/geovisor-map"], ["./components/geovisor-entry.tsx"]);
  assert.match(geovisorEntrySource, /setWorkerUrl\("\.\/maplibre\/maplibre-gl-worker\.mjs"\)/);
  assert.match(copyWorkerSource, /maplibre-gl-worker\.mjs/);
  assert.match(copyWorkerSource, /maplibre-gl-shared\.mjs/);
  for (const hook of ["predev", "prebuild", "prebuild:pages"]) {
    assert.match(packageJson.scripts[hook], /prepare:maplibre/);
    assert.match(packageJson.scripts[hook], /prepare:context-details/);
  }
});

test("starts the Vite preview portably on Windows and Unix-like shells", () => {
  assert.equal(packageJson.scripts.dev, "node scripts/run-vite.mjs");
  assert.match(runViteSource, /WRANGLER_LOG_PATH/);
  assert.match(runViteSource, /spawnSync/);
  assert.match(runViteSource, /vite\.js/);
});

test("labels departments nationally and municipalities as the user zooms in", () => {
  assert.match(pageSource, /departmentNames = useMemo\(\(\) => Object\.fromEntries/);
  assert.match(pageSource, /municipalityNames = useMemo\(\(\) => Object\.fromEntries/);
  assert.match(pageSource, /departmentNames=\{departmentNames\}/);
  assert.match(pageSource, /municipalityNames=\{municipalityNames\}/);
  assert.match(geovisorSource, /territoryLabels/);
  assert.match(geovisorSource, /dane-department-label-points/);
  assert.match(geovisorSource, /dane-municipality-label-points/);
  assert.match(geovisorSource, /DEPARTMENT_LABEL_LAYER_ID/);
  assert.match(geovisorSource, /NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM/);
  assert.match(geovisorSource, /MUNICIPALITY_LABEL_LAYER_ID/);
  assert.match(geovisorSource, /NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM/);
  assert.match(geovisorSource, /setLayerZoomRange\(DEPARTMENT_LABEL_LAYER_ID/);
  assert.match(geovisorSource, /setLayerZoomRange\(MUNICIPALITY_LABEL_LAYER_ID/);
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
  assert.match(geovisorSource, /loadContextDetail\(detailKey\)/);
  assert.match(geovisorSource, /visibleContextLayerIds/);
});

test("uses the official IDEAM 2024 vector tile endpoint and its complete symbol catalog", () => {
  assert.match(geovisorSource, /visualizador\.ideam\.gov\.co\/gisserver\/rest\/services\/Hosted\/MNCT_2024V01_VT\/VectorTileServer\/tile\/\{z\}\/\{y\}\/\{x\}\.pbf/);
  assert.match(geovisorSource, /Mapa Nacional de las Coberturas de la Tierra 2024/);
  const catalogBlock = geovisorSource.match(/const LAND_COVER_CLASSES = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  assert.equal(catalogBlock.match(/\["/g)?.length, 54);
});

test("uses a scale-aware hierarchy for department and municipality labels", () => {
  assert.match(geovisorSource, /NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM = 7\.6/);
  assert.match(geovisorSource, /NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM = 8/);
  assert.match(geovisorSource, /SELECTED_MUNICIPALITY_LABEL_MIN_ZOOM = 6\.35/);
  assert.match(geovisorSource, /setLayerZoomRange\(DEPARTMENT_LABEL_LAYER_ID/);
  assert.match(geovisorSource, /setLayerZoomRange\(MUNICIPALITY_LABEL_LAYER_ID/);
  assert.match(geovisorSource, /"text-padding": 5/);
});

test("preserves synchronized DANE selection and clustered heat detections", () => {
  assert.match(geovisorSource, /cluster: true/);
  assert.match(geovisorSource, /callbacksRef\.current\.onDepartment/);
  assert.match(geovisorSource, /callbacksRef\.current\.onMunicipality/);
  assert.match(geovisorSource, /selectedDepartment/);
  assert.match(geovisorSource, /selectedMunicipality/);
  assert.match(geovisorSource, /fitBounds/);
});

test("uses one public operational sensor universe and keeps A-B outside the interface", () => {
  assert.match(pageSource, /if \(point\[7\] !== 1\) return false/);
  assert.doesNotMatch(pageSource, /scenarioMode|Escenario A|Escenario B/);
});

test("makes individual IDEAM detections the public map unit and hides episode machinery", () => {
  assert.match(geovisorSource, /cluster: true/);
  assert.match(geovisorSource, /point_count/);
  assert.match(geovisorSource, /detections-point/);
  assert.doesNotMatch(pageSource, /episodeMode|episodios operacionales/i);
});

test("keeps episode analysis in the backend for future detailed analysis", () => {
  assert.match(packageJson.scripts["build:pages"], /next build/);
});

test("evaluates public territorial filters directly on each detection", () => {
  assert.match(pageSource, /protectedRelation === "inside"/);
  assert.match(pageSource, /landCoverLevel !== "all"/);
  assert.match(pageSource, /miningRelation === "inside"/);
  assert.match(pageSource, /anlaRelation === "inside"/);
  assert.match(pageSource, /anhRelation === "inside"/);
});

test("publishes complete context cards and automatically enters context click mode", () => {
  assert.match(geovisorSource, /loadContextDetail/);
  assert.match(geovisorSource, /setQueryMode\("context"\)/);
});

test("adds RUNAP, ANM, ANLA and ANH relations to each individual detection card", () => {
  assert.match(geovisorSource, /RUNAP/);
  assert.match(geovisorSource, /ANM/);
  assert.match(geovisorSource, /ANLA/);
  assert.match(geovisorSource, /ANH/);
});

test("keeps IDEAM land cover as a richer territorial query using published fields", () => {
  assert.match(geovisorSource, /LAND_COVER_CLASSES/);
  assert.match(geovisorSource, /queryRenderedFeatures/);
});
