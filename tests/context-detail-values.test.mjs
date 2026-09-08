import assert from "node:assert/strict";
import test from "node:test";
import {
  isDateLikeValue,
  normalizeContextDetail,
  normalizeDateValue,
} from "../lib/context-detail-values.mjs";

const epochMs = Date.parse("2026-08-06T00:00:00Z");

test("normalizes unambiguous ArcGIS dates without guessing local formats", () => {
  assert.equal(normalizeDateValue(epochMs), "2026-08-06");
  assert.equal(normalizeDateValue(String(epochMs)), "2026-08-06");
  assert.equal(normalizeDateValue(`/Date(${epochMs})/`), "2026-08-06");
  assert.equal(normalizeDateValue("2026-08-06T18:30:00.000Z"), "2026-08-06");
  assert.equal(normalizeDateValue("06/08/2026"), "06/08/2026");
  assert.equal(normalizeDateValue(null), "");
});

test("detects date-shaped values without confusing valid ANM status text", () => {
  assert.equal(isDateLikeValue(String(epochMs)), true);
  assert.equal(isDateLikeValue("2026-08-06T00:00:00Z"), true);
  assert.equal(isDateLikeValue("06/08/2026"), true);
  assert.equal(isDateLikeValue("TITULO VIGENTE-EN EJECUCION"), false);
});

test("fails closed when ANM estado contains a date but preserves a valid status", () => {
  const invalidState = normalizeContextDetail("anm:10", {
    source: "anm",
    estado: "2026-08-06T00:00:00Z",
    fecha_inscripcion: epochMs,
    fecha_terminacion: "2036-08-06T00:00:00Z",
  });
  assert.equal(invalidState?.estado, "");
  assert.equal(invalidState?.fecha_inscripcion, "2026-08-06");
  assert.equal(invalidState?.fecha_terminacion, "2036-08-06");

  const validState = normalizeContextDetail("anm:11", {
    source: "anm",
    estado: "TITULO VIGENTE-EN EJECUCION",
  });
  assert.equal(validState?.estado, "TITULO VIGENTE-EN EJECUCION");
});

test("normalizes ANLA and ANH date fields while leaving RUNAP untouched", () => {
  const anla = normalizeContextDetail("anla:6:90", { source: "anla", fecha_acto: epochMs, expediente: "LAV0090" });
  const anh = normalizeContextDetail("anh:8", { source: "anh", fecha_firma: `/Date(${epochMs})/`, contrato: "E&P-8" });
  const runap = { source: "runap", nombre: "Área uno" };

  assert.equal(anla?.fecha_acto, "2026-08-06");
  assert.equal(anh?.fecha_firma, "2026-08-06");
  assert.deepEqual(normalizeContextDetail("runap:1", runap), runap);
});
