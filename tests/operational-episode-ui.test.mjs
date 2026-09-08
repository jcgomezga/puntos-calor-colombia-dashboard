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
  assert.doesNotMatch(pageSource, />A · todos/);
  assert.doesNotMatch(pageSource, />B · sin SNPP/);
  assert.doesNotMatch(pageSource, /sensibilidad histórica A\/B/);
  assert.match(pageSource, /if \(point\[7\] !== 1\) return false/);
  assert.match(pageSource, /sensibilidad por composición instrumental/);
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

test("evaluates territorial filters across episode members", () => {
  assert.match(pageSource, /const basePoints = useMemo/);
  assert.match(pageSource, /const qualifyingEpisodeIndexes = useMemo/);
  assert.match(pageSource, /const has = \(predicate: \(point: PointRow\) => boolean\) => episodeMembers\.some\(predicate\)/);
  assert.match(pageSource, /protectedRelation === "inside" && !has/);
  assert.match(pageSource, /protectedRelation === "outside" && !lacks/);
  assert.match(pageSource, /miningRelation === "inside" && !has/);
  assert.match(pageSource, /anlaRelation === "beyond5" && !lacks/);
  assert.match(pageSource, /anhRelation === "beyond5" && !lacks/);
  assert.match(pageSource, /qualifyingEpisodeIndexes\.has\(point\[18\] \?\? -1\)/);
  assert.doesNotMatch(pageSource, /protectedRelation === "inside" && point\[11\]/);
});

test("describes context filters from the episode perspective", () => {
  assert.match(pageSource, /Sin filtro por RUNAP/);
  assert.match(pageSource, /Con miembro dentro de RUNAP/);
  assert.match(pageSource, /Sin miembro dentro de RUNAP/);
  assert.match(pageSource, /Sin filtro por ANM/);
  assert.match(pageSource, /Con miembro dentro de título vigente/);
  assert.match(pageSource, /Sin filtro por ANLA/);
  assert.match(pageSource, /Con miembro hasta 1 km/);
  assert.match(pageSource, /Sin miembro dentro de 5 km/);
  assert.match(pageSource, /Sin filtro por ANH/);
});

test("publishes complete context cards with non-causal interpretation", () => {
  for (const expected of [
    "Ficha RUNAP", "Condición", "Administración",
    "Ficha de título minero ANM", "Titular / solicitante", "Minerales", "Modalidad", "Tipo de explotación", "Fecha de inscripción",
    "Ficha de proyecto ANLA", "Operador", "Sector", "Situación", "Geometría", "Acto administrativo", "Tipo de infraestructura", "Descripción",
    "Ficha de área contractual ANH", "ID contractual", "Tipo de contrato", "Fecha de firma", "Cuenca", "ID GECOH", "Minuta oficial",
  ]) assert.match(mapSource, new RegExp(expected));
  assert.match(mapSource, /no implica causalidad/);
  assert.match(mapSource, /no implica origen del fuego/);
});

test("keeps IDEAM land cover as a richer territorial query using published fields", () => {
  assert.match(mapSource, /Cobertura de la Tierra 2024/);
  for (const field of ["nivel_1", "nivel_2", "nivel_3", "nivel_4", "nivel_5", "nivel_6", "nom_dep", "nom_mun", "nom_aua", "periodo", "area_ha"]) {
    assert.match(mapSource, new RegExp(field));
  }
  assert.doesNotMatch(mapSource, /confiabili|insumo|nom_dpto|nom_mpio/);
  assert.match(mapSource, /IDEAM · Mapa Nacional de Coberturas de la Tierra 2024 · escala 1:100\.000/);
});
