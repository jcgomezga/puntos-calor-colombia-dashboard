import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const mapSource = await readFile(`${root}/components/operational-geovisor-map.tsx`, "utf8");
const entrySource = await readFile(`${root}/components/geovisor-entry.tsx`, "utf8");
const sensitivityReport = await readFile(`${root}/docs/fases/FASE_06C_REPORTE.md`, "utf8");

test("uses one public operational sensor universe and keeps A-B outside the interface", () => {
  assert.doesNotMatch(pageSource, /type Scenario/);
  assert.doesNotMatch(pageSource, /setScenario/);
  assert.doesNotMatch(pageSource, /Escenario de sensores/);
  assert.doesNotMatch(pageSource, />A · todos</);
  assert.doesNotMatch(pageSource, />B · sin SNPP</);
  assert.match(pageSource, /if \(point\[7\] !== 1\) return false/);
  assert.match(sensitivityReport, /Escenario A/);
  assert.match(sensitivityReport, /Escenario B/);
});

test("makes operational episodes the principal map layer and detections secondary", () => {
  assert.match(entrySource, /OperationalGeovisorMap/);
  assert.match(mapSource, /episodes: true/);
  assert.match(mapSource, /detections: false/);
  assert.match(mapSource, /Episodios de detecciones térmicas/);
  assert.match(mapSource, /Detecciones individuales/);
  assert.match(mapSource, /Mostrar detecciones de este episodio/);
  assert.match(mapSource, /setFocusedEpisodeIndex/);
  assert.match(mapSource, /point\[18\] === focusedEpisodeIndex/);
});

test("pins the adopted episode configuration and responsible interpretation", () => {
  assert.match(mapSource, /OPERATIONAL_SPATIAL_METERS = 1_000/);
  assert.match(mapSource, /OPERATIONAL_TEMPORAL_HOURS = 24/);
  assert.match(mapSource, /OPERATIONAL_MINIMUM_MEMBERS = 3/);
  assert.match(pageSource, /1 km · 24 h · ≥3/);
  assert.match(pageSource, /agrupación algorítmica/);
  assert.match(pageSource, /no confirma por sí sola un incendio/);
});

test("publishes complete context cards with non-causal interpretation", () => {
  for (const expected of [
    "Ficha RUNAP", "Condición", "Administración",
    "Ficha de título minero ANM", "Minerales", "Tipo de explotación", "Área",
    "Ficha de proyecto ANLA", "Operador", "Sector", "Situación", "Geometría",
    "Ficha de área contractual ANH", "Tipo de contrato", "Cuenca", "Superficie",
  ]) assert.match(mapSource, new RegExp(expected));
  assert.match(mapSource, /no implica causalidad/);
  assert.match(mapSource, /no implica origen del fuego/);
});

test("keeps IDEAM land cover as a richer territorial query", () => {
  assert.match(mapSource, /Cobertura de la Tierra 2024/);
  for (const field of ["nivel_4", "nivel_5", "nivel_6", "confiabili", "insumo", "nom_dpto", "nom_mpio", "area_ha"]) {
    assert.match(mapSource, new RegExp(field));
  }
  assert.match(mapSource, /IDEAM · 2024 · escala 1:100\.000/);
});
