import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DETAIL_SHARD_COUNT,
  buildContextDetailShards,
  detailShardName,
} from "../scripts/shard-context-details.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const mapSource = await readFile(`${root}/components/operational-geovisor-map.tsx`, "utf8");
const loaderSource = await readFile(`${root}/components/context-detail-catalog.ts`, "utf8");
const shardSource = await readFile(`${root}/scripts/shard-context-details.mjs`, "utf8");
const tileBuilder = await readFile(`${root}/scripts/build_context_tiles_enriched.py`, "utf8");
const tileWorkflow = await readFile(`${root}/.github/workflows/build-context-tiles.yml`, "utf8");
const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8"));

test("loads complete territorial cards lazily from small deterministic shards", () => {
  assert.match(mapSource, /loadContextDetail/);
  assert.match(mapSource, /detail_key/);
  assert.match(mapSource, /Cargando ficha completa/);
  assert.match(mapSource, /No fue posible cargar los atributos ampliados/);
  assert.match(loaderSource, /context-details\/\$\{source\}\/\$\{shard\}\.json/);
  assert.match(loaderSource, /shardPromises/);
  assert.match(loaderSource, /cache: "force-cache"/);
  assert.doesNotMatch(loaderSource, /fetch\([^\n]*context-details\.json/);
  assert.match(shardSource, /DETAIL_SHARD_COUNT = 128/);
  assert.match(tileBuilder, /detail_key/);
  assert.match(tileBuilder, /context-details\.json/);
  assert.match(tileWorkflow, /public\/data\/context-details\.json/);
  assert.equal(packageJson.scripts["prepare:context-details"], "node scripts/shard-context-details.mjs");
  for (const hook of ["predev", "prebuild", "prebuild:pages"]) {
    assert.match(packageJson.scripts[hook], /prepare:context-details/);
  }
});

test("shards the canonical catalog without losing records", async () => {
  assert.equal(DETAIL_SHARD_COUNT, 128);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "context-details-test-"));
  const inputPath = path.join(temporary, "context-details.json");
  const outputDir = path.join(temporary, "shards");
  const records = {
    "runap:1": { source: "runap", nombre: "Área uno" },
    "anm:55": { source: "anm", codigo: "ABC-55" },
    "anla:6:90": { source: "anla", expediente: "LAV0090" },
    "anh:8": { source: "anh", contrato: "E&P-8" },
  };
  await writeFile(inputPath, JSON.stringify({ generatedAtUtc: "2026-09-08T00:00:00Z", records }), "utf8");
  try {
    const manifest = await buildContextDetailShards({ inputPath, outputDir });
    assert.equal(manifest.recordCount, Object.keys(records).length);
    assert.deepEqual(manifest.sourceCounts, { runap: 1, anm: 1, anla: 1, anh: 1 });
    for (const [key, expected] of Object.entries(records)) {
      const source = key.split(":", 1)[0];
      const shardPath = path.join(outputDir, source, `${detailShardName(key)}.json`);
      const shard = JSON.parse(await readFile(shardPath, "utf8"));
      assert.deepEqual(shard.records[key], expected);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
