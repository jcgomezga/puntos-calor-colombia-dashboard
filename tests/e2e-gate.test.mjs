import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
const prWorkflow = await readFile(`${root}/.github/workflows/geovisor-ci.yml`, "utf8");
const pagesWorkflow = await readFile(`${root}/.github/workflows/pages.yml`, "utf8");
const e2eSource = await readFile(`${root}/scripts/check-dashboard-e2e.mjs`, "utf8");

test("exposes a real-browser E2E command", () => {
  assert.equal(packageJson.scripts["test:e2e"], "node scripts/check-dashboard-e2e.mjs");
  assert.match(e2eSource, /remote-debugging-port/);
  assert.match(e2eSource, /Runtime\.evaluate/);
  assert.match(e2eSource, /Page\.navigate/);
});

test("runs E2E after Pages build in pull-request CI", () => {
  const buildIndex = prWorkflow.indexOf("npm run build:pages");
  const e2eIndex = prWorkflow.indexOf("npm run test:e2e");
  assert.ok(buildIndex >= 0, "El CI de PR debe construir la exportación Pages.");
  assert.ok(e2eIndex > buildIndex, "El E2E debe ejecutarse sobre la exportación Pages ya construida.");
});

test("blocks Pages deployment on the same E2E gate", () => {
  const buildIndex = pagesWorkflow.indexOf("npm run build:pages");
  const e2eIndex = pagesWorkflow.indexOf("npm run test:e2e");
  const uploadIndex = pagesWorkflow.indexOf("actions/upload-pages-artifact@v3");
  assert.ok(buildIndex >= 0 && e2eIndex > buildIndex, "Pages debe ejecutar E2E después del build.");
  assert.ok(uploadIndex > e2eIndex, "Pages no debe subir el artefacto antes de superar E2E.");
});

test("covers core public flows without changing MapLibre internals", () => {
  for (const contract of [
    "Carga inicial",
    "Filtro Departamento=Tolima",
    "Filtro Municipio=Ibagué",
    "Rango de fecha",
    "Sin territorio asignado",
    "Sin cobertura asignada",
    "Situación ANLA=En evaluación",
    "Combinación con cero resultados",
    "Detecciones por mes",
    "Cómo leer el dashboard",
  ]) {
    assert.match(e2eSource, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(e2eSource, /queryRenderedFeatures|clusterMaxZoom|map\.addLayer|maplibregl/);
});
