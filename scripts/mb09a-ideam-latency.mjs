import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const ARTIFACT_DIR = resolve(process.cwd(), "artifacts/mb09a");
const ENDPOINT = "https://visualizador.ideam.gov.co/gisserver/rest/services/Hosted/MNCT_2024V01_VT/VectorTileServer/tile/{z}/{y}/{x}.pbf";
const CENTER = { longitude: -73.5, latitude: 4.5 };

function tileFor(longitude, latitude, zoom) {
  const n = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const latRad = (latitude * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

async function measure(tile, attempt) {
  const url = ENDPOINT.replace("{z}", tile.z).replace("{y}", tile.y).replace("{x}", tile.x);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.mapbox-vector-tile, application/x-protobuf, */*" },
      signal: controller.signal,
      cache: "no-store",
    });
    const firstByteMs = performance.now() - started;
    const body = await response.arrayBuffer();
    const totalMs = performance.now() - started;
    return {
      attempt,
      tile,
      url,
      ok: response.ok,
      status: response.status,
      firstByteMs: Number(firstByteMs.toFixed(1)),
      totalMs: Number(totalMs.toFixed(1)),
      bytes: body.byteLength,
      contentType: response.headers.get("content-type"),
      cacheControl: response.headers.get("cache-control"),
    };
  } catch (error) {
    return {
      attempt,
      tile,
      url,
      ok: false,
      status: null,
      elapsedMs: Number((performance.now() - started).toFixed(1)),
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const tiles = [5, 6, 7].map((zoom) => tileFor(CENTER.longitude, CENTER.latitude, zoom));
const samples = [];
for (const tile of tiles) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    samples.push(await measure(tile, attempt));
  }
}

const successful = samples.filter((sample) => sample.ok);
const totals = successful.map((sample) => sample.totalMs);
const summary = {
  endpoint: ENDPOINT,
  center: CENTER,
  measuredAtUtc: new Date().toISOString(),
  sampleCount: samples.length,
  successCount: successful.length,
  minTotalMs: totals.length ? Math.min(...totals) : null,
  maxTotalMs: totals.length ? Math.max(...totals) : null,
  meanTotalMs: totals.length ? Number((totals.reduce((sum, value) => sum + value, 0) / totals.length).toFixed(1)) : null,
  samples,
  interpretation: "Sondeo diagnóstico desde un runner de GitHub Actions; no representa por sí solo la latencia de todos los usuarios ni sustituye medición en navegador físico.",
};

await writeFile(resolve(ARTIFACT_DIR, "ideam-latency.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
