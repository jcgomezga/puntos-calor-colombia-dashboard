import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONTEXT_DETAIL_CONTRACT_VERSION,
  DETAIL_SHARD_COUNT,
  buildContextDetailShards,
  detailShardName,
  normalizeContextDate,
  normalizeContextDetailRecord,
} from "../scripts/shard-context-details.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const mapSource = await readFile(`${root}/components/operational-geovisor-map.tsx`, "utf8");
const publicMapSource = await readFile(`${root}/components/public-detection-geovisor-map.tsx`, "utf8");
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

test("normalizes ArcGIS and ISO dates without inventing unknown values", () => {
  assert.equal(normalizeContextDate(1577923200000), "2020-01-02");
  assert.equal(normalizeContextDate("1715904000000"), "2024-05-17");
  assert.equal(normalizeContextDate("2026-09-08T14:30:00Z"), "2026-09-08");
  assert.equal(normalizeContextDate("2026-09-08 00:00:00"), "2026-09-08");
  assert.equal(normalizeContextDate("fecha no interpretable"), "fecha no interpretable");
  assert.equal(normalizeContextDate(null), "");
});

test("omits the unreliable ANM state from the public detail contract", () => {
  const normalized = normalizeContextDetailRecord("anm:55", {
    source: "anm",
    codigo: "ABC-55",
    estado: "2024-01-01 00:00:00",
    fecha_inscripcion: 1577923200000,
  });
  assert.equal(normalized.estado, "");
  assert.equal(normalized.fecha_inscripcion, "2020-01-02");
  assert.doesNotMatch(tileBuilder, /"estado": BASE\.clean\(properties\.get\("estado_exp"\)\)/);
  assert.doesNotMatch(tileBuilder, /"estado": BASE\.clean\(properties\.get\("estado_exp"\)\),/);
  assert.match(tileBuilder, /"fecha_inscripcion": normalize_date/);
  assert.match(tileBuilder, /"fecha_terminacion": normalize_date/);
  assert.match(publicMapSource, /Ficha de título minero ANM/);
});

test("shards the canonical catalog without losing records and applies contract v2", async () => {
  assert.equal(DETAIL_SHARD_COUNT, 128);
  assert.equal(CONTEXT_DETAIL_CONTRACT_VERSION, 2);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "context-details-test-"));
  const inputPath = path.join(temporary, "context-details.json");
  const outputDir = path.join(temporary, "shards");
  const records = {
    "runap:1": { source: "runap", nombre: "Área uno" },
    "anm:55": { source: "anm", codigo: "ABC-55", estado: "2024-01-01 00:00:00", fecha_inscripcion: 1577923200000 },
    "anla:6:90": { source: "anla", expediente: "LAV0090", fecha_acto: 1715904000000 },
    "anh:8": { source: "anh", contrato: "E&P-8", fecha_firma: "2026-09-08T00:00:00Z" },
  };
  await writeFile(inputPath, JSON.stringify({ generatedAtUtc: "2026-09-08T00:00:00Z", records }), "utf8");
  try {
    const manifest = await buildContextDetailShards({ inputPath, outputDir });
    assert.equal(manifest.recordCount, Object.keys(records).length);
    assert.equal(manifest.contractVersion, 2);
    assert.deepEqual(manifest.sourceCounts, { runap: 1, anm: 1, anla: 1, anh: 1 });

    const expected = {
      "runap:1": { source: "runap", nombre: "Área uno" },
      "anm:55": { source: "anm", codigo: "ABC-55", estado: "", fecha_inscripcion: "2020-01-02" },
      "anla:6:90": { source: "anla", expediente: "LAV0090", fecha_acto: "2024-05-17" },
      "anh:8": { source: "anh", contrato: "E&P-8", fecha_firma: "2026-09-08" },
    };
    for (const [key, expectedRecord] of Object.entries(expected)) {
      const source = key.split(":", 1)[0];
      const shardPath = path.join(outputDir, source, `${detailShardName(key)}.json`);
      const shard = JSON.parse(await readFile(shardPath, "utf8"));
      assert.equal(shard.contractVersion, 2);
      assert.deepEqual(shard.records[key], expectedRecord);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
