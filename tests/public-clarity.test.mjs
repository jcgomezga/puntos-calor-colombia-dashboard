import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const layoutSource = await readFile(`${root}/app/layout.tsx`, "utf8");
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const methodologySource = await readFile(`${root}/app/metodologia/page.tsx`, "utf8");

test("aligns public metadata with individual thermal detections", () => {
  assert.match(layoutSource, /Detecciones térmicas IDEAM · Colombia/);
  assert.match(layoutSource, /contexto territorial, ambiental y extractivo/);
  assert.doesNotMatch(layoutSource, /episodios algorítmicos/i);
  assert.match(layoutSource, /GITHUB_ACTIONS/);
  assert.match(layoutSource, /\$\{basePath\}\/favicon\.svg/);
});

test("publishes readable IDEAM land-cover family labels", () => {
  for (const [code, label] of [
    ["1", "Territorios artificializados"],
    ["2", "Áreas agrícolas"],
    ["3", "Bosques y áreas seminaturales"],
    ["4", "Áreas húmedas"],
    ["5", "Superficies de agua"],
  ]) {
    assert.match(pageSource, new RegExp(`"${code}": "${label}"`));
  }
  assert.match(pageSource, /\{code\} · \{label\}/);
});

test("links the dashboard to a real public methodology route", () => {
  assert.match(pageSource, /href="\/metodologia"/);
  assert.match(pageSource, /Ver metodología y alcance/);
  assert.match(pageSource, /Metodología, fuentes y trazabilidad/);
  assert.doesNotMatch(pageSource, /<code>\/docs<\/code>/);
});

test("explains operational scope without exposing A-B selectors", () => {
  assert.match(pageSource, /universo operativo/i);
  assert.match(methodologySource, /universo operativo de detecciones/i);
  assert.match(methodologySource, /control de calidad instrumental/i);
  assert.doesNotMatch(methodologySource, /Escenario A/);
  assert.doesNotMatch(methodologySource, /Escenario B/);
});

test("explains confidence, ANLA overlap and unassigned records", () => {
  assert.match(methodologySource, /no deben interpretarse como una probabilidad de que exista un incendio/i);
  assert.match(methodologySource, /no son necesariamente excluyentes/i);
  assert.match(methodologySource, /sin asignación/i);
  assert.match(methodologySource, /subtotales por situación no deben sumarse/i);
});
