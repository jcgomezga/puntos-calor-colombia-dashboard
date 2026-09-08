"use client";

import { normalizeContextDetail } from "@/lib/context-detail-values.mjs";

export type ContextDetail = Record<string, unknown>;

type ContextDetailShard = {
  records?: Record<string, ContextDetail>;
};

const DETAIL_SHARD_COUNT = 128;
const VALID_SOURCES = new Set(["runap", "anm", "anla", "anh"]);
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
  return { source, shard, cacheKey: `${source}/${shard}` };
}

function shardUrl(source: string, shard: string) {
  return new URL(`./data/context-details/${source}/${shard}.json`, window.location.href).toString();
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
  return normalizeContextDetail(key, shard.records?.[key] ?? null) as ContextDetail | null;
}
