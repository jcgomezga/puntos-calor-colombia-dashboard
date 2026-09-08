import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const mapSource = await readFile(`${root}/components/operational-geovisor-map.tsx`, "utf8");
const loaderSource = await readFile(`${root}/components/context-detail-catalog.ts`, "utf8");
const tileBuilder = await readFile(`${root}/scripts/build_context_tiles_enriched.py`, "utf8");
const tileWorkflow = await readFile(`${root}/.github/workflows/build-context-tiles.yml`, "utf8");

test("loads complete territorial cards lazily from one catalog", () => {
  assert.match(mapSource, /loadContextDetail/);
  assert.match(mapSource, /detail_key/);
  assert.match(mapSource, /Cargando ficha completa/);
  assert.match(mapSource, /No fue posible cargar los atributos ampliados/);
  assert.match(loaderSource, /context-details\.json/);
  assert.match(loaderSource, /catalogPromise/);
  assert.match(loaderSource, /cache: "no-cache"/);
  assert.match(tileBuilder, /detail_key/);
  assert.match(tileBuilder, /context-details\.json/);
  assert.match(tileWorkflow, /public\/data\/context-details\.json/);
});
