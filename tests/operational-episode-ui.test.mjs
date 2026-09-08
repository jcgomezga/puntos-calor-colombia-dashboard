import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const publicMapSource = await readFile(`${root}/components/public-detection-geovisor-map.tsx`, "utf8");
const operationalMapSource = await readFile(`${root}/components/operational-geovisor-map.tsx`, "utf8");
const entrySource = await readFile(`${root}/components/geovisor-entry.tsx`, "utf8");
const sensitivityReport = await readFile(`${root}/docs/fases/FASE_06C_REPORTE.md`, "utf8");

test("uses one public operational sensor universe and keeps A-B outside the interface", () => {
  assert.doesNotMatch(pageSource, /type Scenario/);
  assert.doesNotMatch(pageSource, /setScenario/);
  assert.doesNotMatch(pageSource, /Escenario de sensores/);
  assert.doesNotMatch(pageSource, />A · todos/);
  assert.doesNotMatch(pageSource, />B · sin SNPP/);
  assert.match(pageSource, /if \(point\[7\] !== 1\) return false/);
  assert.match(sensitivityReport, /Escenario A/);
  assert.match(sensitivityReport, /Escenario B/);
});

test("makes individual IDEAM detections the public map unit and hides episode machinery", () => {
  assert.match(entrySource, /PublicDetectionGeovisorMap/);
  assert.match(publicMapSource, /hotspots: true/);
  assert.match(publicMapSource, /Detecciones térmicas IDEAM/);
  assert.match(pageSource, /Detecciones visibles/);
  assert.match(pageSource, /con más detecciones/);
  assert.doesNotMatch(pageSource, /episodio/i);
  assert.doesNotMatch(publicMapSource, /Episodios de detecciones térmicas/);
  assert.doesNotMatch(publicMapSource, /1 km · 24 h/);
});

test("keeps episode analysis in the backend for future detailed analysis", () => {
  assert.match(operationalMapSource, /Episodio de detecciones térmicas/);
  assert.match(operationalMapSource, /OPERATIONAL_SPATIAL_METERS = 1_000/);
  assert.match(operationalMapSource, /OPERATIONAL_TEMPORAL_HOURS = 24/);
  assert.match(operationalMapSource, /OPERATIONAL_MINIMUM_MEMBERS = 3/);
  assert.match(sensitivityReport, /episod/i);
});

test("evaluates public territorial filters directly on each detection", () => {
  assert.doesNotMatch(pageSource, /qualifyingEpisodeIndexes/);
  assert.match(pageSource, /protectedRelation === "inside" && point\[11\] !== 1/);
  assert.match(pageSource, /miningRelation === "inside" && point\[13\] !== 1/);
  assert.match(pageSource, /anlaRelation === "inside" && point\[14\] !== 3/);
  assert.match(pageSource, /anhRelation === "inside" && point\[16\] !== 3/);
});

test("publishes complete context cards and automatically enters context click mode", () => {
  for (const expected of [
    "Ficha RUNAP", "Condición", "Administración",
    "Ficha de título minero ANM", "Titular / solicitante", "Minerales", "Modalidad", "Tipo de explotación", "Fecha de inscripción",
    "Ficha de proyecto ANLA", "Operador", "Sector", "Situación", "Geometría", "Acto administrativo", "Tipo de infraestructura", "Descripción",
    "Ficha de área contractual ANH", "ID contractual", "Tipo de contrato", "Fecha de firma", "Cuenca", "ID GECOH", "Minuta oficial",
  ]) assert.match(publicMapSource, new RegExp(expected));
  assert.match(publicMapSource, /loadContextDetail\(detailKey\)/);
  assert.match(publicMapSource, /setQueryMode\("context"\)/);
  assert.match(publicMapSource, /visibleContextLayerIds/);
  assert.match(publicMapSource, /no implica causalidad/);
  assert.match(publicMapSource, /no implica origen del fuego/);
});

test("adds RUNAP, ANM, ANLA and ANH relations to each individual detection card", () => {
  for (const label of ["RUNAP", "Título ANM", "Proyecto ANLA", "Área ANH"]) assert.match(publicMapSource, new RegExp(label));
  assert.match(publicMapSource, /anlaRelation: point\[14\]/);
  assert.match(publicMapSource, /anhRelation: point\[16\]/);
});

test("keeps IDEAM land cover as a richer territorial query using published fields", () => {
  assert.match(publicMapSource, /Cobertura de la Tierra 2024/);
  for (const field of ["nivel_1", "nivel_2", "nivel_3", "nivel_4", "nivel_5", "nivel_6", "nom_dep", "nom_mun", "nom_aua", "periodo", "area_ha"]) assert.match(publicMapSource, new RegExp(field));
  assert.match(publicMapSource, /IDEAM · Mapa Nacional de Coberturas de la Tierra 2024 · escala 1:100\.000/);
});
