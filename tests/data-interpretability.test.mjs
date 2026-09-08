import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dashboard = JSON.parse(await readFile(`${root}/public/data/dashboard.json`, "utf8"));
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const mapSource = await readFile(`${root}/components/public-detection-geovisor-map.tsx`, "utf8");
const methodologySource = await readFile(`${root}/app/metodologia/page.tsx`, "utf8");

const operational = dashboard.points.filter((point) => point[7] === 1);
const withoutTerritory = operational.filter((point) => point[2] < 0).length;
const withoutCoverage = operational.filter((point) => (point[12] ?? -1) < 0).length;
const anlaOverlap = operational.filter((point) => ((point[15] ?? 0) & 3) === 3).length;

console.log(`MB-06 data reconciliation: operational=${operational.length}, withoutTerritory=${withoutTerritory}, withoutCoverage=${withoutCoverage}, anlaEvaluationAndLicensed=${anlaOverlap}`);

test("current operational universe contains isolatable unassigned records", () => {
  assert.ok(withoutTerritory > 0, "El dataset actual debe conservar al menos un registro operativo sin territorio para verificar DATA-004.");
  assert.ok(withoutCoverage > 0, "El dataset actual debe conservar al menos un registro operativo sin cobertura para verificar DATA-004.");
  assert.match(pageSource, /const UNASSIGNED_TERRITORY = "__unassigned_territory__"/);
  assert.match(pageSource, /const UNASSIGNED_LAND_COVER = "__unassigned_land_cover__"/);
  assert.match(pageSource, /Sin territorio asignado \(\{numberFormat\.format\(dataGaps\.territory\)\}\)/);
  assert.match(pageSource, /Sin cobertura asignada \(\{numberFormat\.format\(dataGaps\.coverage\)\}\)/);
  assert.match(pageSource, /departmentCode === UNASSIGNED_TERRITORY && point\[2\] >= 0/);
  assert.match(pageSource, /landCoverLevel === UNASSIGNED_LAND_COVER && \(point\[12\] \?\? -1\) >= 0/);
});

test("unassigned territory filter participates in visiblePoints memo dependencies", () => {
  assert.match(
    pageSource,
    /\[startIndex, endIndex, departmentCode, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, landCovers\]\);/,
  );
  assert.match(pageSource, /departmentCode === UNASSIGNED_TERRITORY \? "Detecciones sin territorio asignado"/);
});

test("every operational confidence index resolves to the published confidence catalog", () => {
  assert.ok(Array.isArray(dashboard.confidences) && dashboard.confidences.length > 0, "Debe existir el catálogo dashboard.confidences.");
  for (const point of operational) {
    const value = dashboard.confidences[point[9]];
    assert.equal(typeof value, "string");
    assert.ok(value.trim(), `confidenceIndex ${point[9]} debe resolver a un valor no vacío.`);
  }
});

test("published confidence values preserve sensor-specific scales", () => {
  let viirs = 0;
  let modis = 0;
  for (const point of operational) {
    const source = dashboard.sources[point[6]] ?? "";
    const confidence = dashboard.confidences[point[9]] ?? "";
    if (source.startsWith("VIIRS")) {
      viirs += 1;
      assert.match(confidence, /^(Baja|Nominal|Alta)$/i, `VIIRS debe conservar categoría, no índice: ${source} -> ${confidence}`);
    } else if (source.startsWith("MODIS")) {
      modis += 1;
      assert.match(confidence, /^\d+(?:[.,]\d+)?\s*%$/, `MODIS debe conservar porcentaje: ${source} -> ${confidence}`);
    }
  }
  assert.ok(viirs > 0, "El universo operativo actual debe contener VIIRS.");
  assert.ok(modis > 0, "El universo operativo actual debe contener MODIS.");
});

test("geovisor decodes confidenceIndex before rendering the popup", () => {
  assert.match(mapSource, /confidence: confidences\[point\[9\]\] \?\? "Sin dato"/);
  assert.doesNotMatch(mapSource, /confidence: point\[9\]/);
  assert.match(mapSource, /Categoría VIIRS \(Baja\/Nominal\/Alta\)/);
  assert.match(mapSource, /MODIS \(0–100 %\)/);
  assert.match(mapSource, /no es probabilidad de incendio ni escala comparable entre sensores/);
});

test("ANLA overlap is represented and explained as multitag", () => {
  assert.ok(anlaOverlap > 0, "El dataset actual debe contener detecciones relacionadas con estados ANLA solapados para verificar UX-005.");
  assert.match(pageSource, /Situación ANLA:<\/strong> es multietiqueta/);
  assert.match(pageSource, /los subtotales no deben sumarse/);
  assert.match(methodologySource, /no son excluyentes a escala de detección/);
  assert.match(methodologySource, /una detección puede aparecer en ambos filtros/);
});

test("public methodology distinguishes VIIRS and MODIS confidence semantics", () => {
  assert.match(methodologySource, /VIIRS y MODIS no usan la misma escala/);
  assert.match(methodologySource, /Baja, Nominal o Alta/);
  assert.match(methodologySource, /0 a 100&nbsp;%/);
  assert.match(methodologySource, /no es la probabilidad de que exista un incendio/);
});
