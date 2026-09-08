import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const DETAIL_SHARD_COUNT = 128;
export const CONTEXT_DETAIL_CONTRACT_VERSION = 2;
const VALID_SOURCES = new Set(["runap", "anm", "anla", "anh"]);
const DATE_FIELDS = {
  runap: ["fecha_registro"],
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

export function normalizeContextDate(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return "";

  if (/^\d{4}-\d{2}-\d{2}(?:$|[T\s])/.test(text)) return text.slice(0, 10);

  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      const milliseconds = Math.abs(numeric) >= 100_000_000_000 ? numeric : Math.abs(numeric) >= 100_000_000 ? numeric * 1000 : Number.NaN;
      if (Number.isFinite(milliseconds)) {
        const date = new Date(milliseconds);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
      }
    }
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed) && /[-/:T\s]/.test(text)) return new Date(parsed).toISOString().slice(0, 10);
  return text;
}

export function normalizeContextDetailRecord(detailKey, detail) {
  const source = sourceFromKey(detailKey);
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    throw new Error(`Ficha territorial inválida en ${detailKey}`);
  }
  const normalized = { ...detail, source };
  for (const field of DATE_FIELDS[source] ?? []) {
    if (field in normalized) normalized[field] = normalizeContextDate(normalized[field]);
  }

  // La capa oficial ANM declara `estado_exp` como texto, pero la auditoría del
  // corte publicado encontró que la mayoría de sus valores tienen apariencia
  // de fecha. Hasta reconciliar esa semántica con la fuente, la ficha pública
  // no presenta ese atributo como un estado administrativo.
  if (source === "anm") normalized.estado = "";
  return normalized;
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
  for (const [detailKey, detail] of Object.entries(records)) {
    const source = sourceFromKey(detailKey);
    const shardName = detailShardName(detailKey);
    const shardKey = `${source}/${shardName}`;
    let shard = shards.get(shardKey);
    if (!shard) {
      shard = {};
      shards.set(shardKey, shard);
    }
    shard[detailKey] = normalizeContextDetailRecord(detailKey, detail);
    sourceCounts[source] += 1;
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  let totalShardBytes = 0;
  let maxShardBytes = 0;
  for (const [shardKey, shardRecords] of shards.entries()) {
    const target = path.join(output, `${shardKey}.json`);
    await mkdir(path.dirname(target), { recursive: true });
    const payload = `${JSON.stringify({ contractVersion: CONTEXT_DETAIL_CONTRACT_VERSION, records: shardRecords })}\n`;
    await writeFile(target, payload, "utf8");
    const size = (await stat(target)).size;
    totalShardBytes += size;
    maxShardBytes = Math.max(maxShardBytes, size);
  }

  const manifest = {
    generatedAtUtc: catalog.generatedAtUtc ?? null,
    generatedFrom: "context-details.json",
    contractVersion: CONTEXT_DETAIL_CONTRACT_VERSION,
    shardCount: DETAIL_SHARD_COUNT,
    writtenShards: shards.size,
    recordCount: Object.keys(records).length,
    sourceCounts,
    totalShardBytes,
    maxShardBytes,
    normalization: {
      dates: "YYYY-MM-DD",
      anmEstado: "omitido de la ficha pública hasta reconciliar la semántica de estado_exp",
    },
  };
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildContextDetailShards();
  console.log(JSON.stringify(manifest));
}
