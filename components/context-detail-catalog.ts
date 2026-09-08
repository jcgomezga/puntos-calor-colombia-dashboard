"use client";

export type ContextDetail = Record<string, unknown>;

type ContextDetailShard = {
  contractVersion?: number;
  records?: Record<string, ContextDetail>;
};

const DETAIL_SHARD_COUNT = 128;
const CONTEXT_DETAIL_CONTRACT_VERSION = 2;
const VALID_SOURCES = new Set(["runap", "anm", "anla", "anh"]);
const DATE_FIELDS: Record<string, string[]> = {
  runap: ["fecha_registro"],
  anm: ["fecha_inscripcion", "fecha_terminacion"],
  anla: ["fecha_acto"],
  anh: ["fecha_firma"],
};
const shardPromises = new Map<string, Promise<ContextDetailShard>>();

function detailShardIndex(detailKey: string) {
  let hash = 5381;
  for (let index = 0; index < detailKey.length; index += 1) {
    hash = Math.imul(hash, 33) ^ detailKey.charCodeAt(index);
  }
  return (hash >>> 0) % DETAIL_SHARD_COUNT;
}

function shardDescriptor(detailKey: string) {
  const source = detailKey.split(":", 1)[0];
  if (!VALID_SOURCES.has(source)) return null;
  const shard = detailShardIndex(detailKey).toString(16).padStart(2, "0");
  return { source, shard, cacheKey: `${source}/${shard}/v${CONTEXT_DETAIL_CONTRACT_VERSION}` };
}

function normalizeContextDate(value: unknown) {
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

function normalizeLoadedDetail(detailKey: string, detail: ContextDetail): ContextDetail {
  const source = detailKey.split(":", 1)[0];
  const normalized: ContextDetail = { ...detail, source };
  for (const field of DATE_FIELDS[source] ?? []) {
    if (field in normalized) normalized[field] = normalizeContextDate(normalized[field]);
  }
  if (source === "anm") normalized.estado = "";
  return normalized;
}

function shardUrl(source: string, shard: string) {
  return new URL(`./data/context-details/${source}/${shard}.json?v=${CONTEXT_DETAIL_CONTRACT_VERSION}`, window.location.href).toString();
}

async function fetchShard(source: string, shard: string) {
  const response = await fetch(shardUrl(source, shard), { cache: "force-cache" });
  if (!response.ok) throw new Error(`No fue posible cargar la ficha territorial (${response.status})`);
  const catalog = await response.json() as ContextDetailShard;
  if (!catalog || typeof catalog !== "object" || !catalog.records || typeof catalog.records !== "object") {
    throw new Error("El fragmento de fichas territoriales no tiene el formato esperado");
  }
  return catalog;
}

export async function loadContextDetail(detailKey: string): Promise<ContextDetail | null> {
  const key = detailKey.trim();
  if (!key) return null;
  const descriptor = shardDescriptor(key);
  if (!descriptor) return null;
  let promise = shardPromises.get(descriptor.cacheKey);
  if (!promise) {
    promise = fetchShard(descriptor.source, descriptor.shard).catch((error) => {
      shardPromises.delete(descriptor.cacheKey);
      throw error;
    });
    shardPromises.set(descriptor.cacheKey, promise);
  }
  const shard = await promise;
  const detail = shard.records?.[key];
  return detail ? normalizeLoadedDetail(key, detail) : null;
}
