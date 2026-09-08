import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isDateLikeValue, normalizeContextDetail } from "../lib/context-detail-values.mjs";

export const DETAIL_SHARD_COUNT = 128;
const VALID_SOURCES = new Set(["runap", "anm", "anla", "anh"]);
const DATE_FIELDS_BY_SOURCE = {
  anm: ["fecha_inscripcion", "fecha_terminacion"],
  anla: ["fecha_acto"],
  anh: ["fecha_firma"],
};

export function detailShardIndex(detailKey) {
  let hash = 5381;
  for (let index = 0; index < detailKey.length; index += 1) {
    hash = Math.imul(hash, 33) ^ detailKey.charCodeAt(index);
  }
  return (hash >>> 0) % DETAIL_SHARD_COUNT;
}

export function detailShardName(detailKey) {
  return detailShardIndex(detailKey).toString(16).padStart(2, "0");
}

function sourceFromKey(detailKey) {
  const source = detailKey.split(":", 1)[0];
  if (!VALID_SOURCES.has(source)) throw new Error(`Fuente territorial inesperada en ${detailKey}`);
  return source;
}

export async function buildContextDetailShards({ inputPath, outputDir } = {}) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const input = inputPath ?? path.join(root, "public", "data", "context-details.json");
  const output = outputDir ?? path.join(root, "public", "data", "context-details");
  const catalog = JSON.parse(await readFile(input, "utf8"));
  const records = catalog?.records;
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    throw new Error("context-details.json no contiene un objeto records válido");
  }

  const shards = new Map();
  const sourceCounts = { runap: 0, anm: 0, anla: 0, anh: 0 };
  const quality = { normalizedDateFields: 0, suppressedAnmStateDates: 0 };
  for (const [detailKey, detail] of Object.entries(records)) {
    const source = sourceFromKey(detailKey);
    const shardName = detailShardName(detailKey);
    const shardKey = `${source}/${shardName}`;
    let shard = shards.get(shardKey);
    if (!shard) {
      shard = {};
      shards.set(shardKey, shard);
    }

    const normalizedDetail = normalizeContextDetail(detailKey, detail) ?? {};
    if (source === "anm" && isDateLikeValue(detail?.estado) && normalizedDetail.estado === "") {
      quality.suppressedAnmStateDates += 1;
    }
    for (const field of DATE_FIELDS_BY_SOURCE[source] ?? []) {
      const before = detail?.[field] == null ? "" : String(detail[field]);
      const after = normalizedDetail?.[field] == null ? "" : String(normalizedDetail[field]);
      if (before !== after) quality.normalizedDateFields += 1;
    }

    shard[detailKey] = normalizedDetail;
    sourceCounts[source] += 1;
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  let totalShardBytes = 0;
  let maxShardBytes = 0;
  for (const [shardKey, shardRecords] of shards.entries()) {
    const target = path.join(output, `${shardKey}.json`);
    await mkdir(path.dirname(target), { recursive: true });
    const payload = `${JSON.stringify({ records: shardRecords })}\n`;
    await writeFile(target, payload, "utf8");
    const size = (await stat(target)).size;
    totalShardBytes += size;
    maxShardBytes = Math.max(maxShardBytes, size);
  }

  const manifest = {
    generatedAtUtc: catalog.generatedAtUtc ?? null,
    generatedFrom: "context-details.json",
    shardCount: DETAIL_SHARD_COUNT,
    writtenShards: shards.size,
    recordCount: Object.keys(records).length,
    sourceCounts,
    quality,
    totalShardBytes,
    maxShardBytes,
  };
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildContextDetailShards();
  console.log(JSON.stringify(manifest));
}
