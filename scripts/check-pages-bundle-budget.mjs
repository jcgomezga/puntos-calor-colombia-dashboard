import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const outputRoot = resolve(process.cwd(), process.env.PAGES_OUTPUT_DIR ?? "out");
const chunksRoot = resolve(outputRoot, "_next/static/chunks");
const defaultLargestChunkBudget = 2_100_000;
const largestChunkBudget = Number(process.env.PAGES_LARGEST_JS_GZIP_BUDGET_BYTES ?? defaultLargestChunkBudget);

function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectJavaScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

let files;
try {
  files = collectJavaScriptFiles(chunksRoot);
} catch (error) {
  console.error(`No se pudo inspeccionar ${relative(process.cwd(), chunksRoot)}. Ejecute primero npm run build:pages.`);
  throw error;
}

if (!files.length) {
  throw new Error(`No se encontraron chunks JavaScript en ${relative(process.cwd(), chunksRoot)}.`);
}

const rows = files
  .map((path) => {
    const rawBytes = statSync(path).size;
    const gzipBytes = gzipSync(readFileSync(path), { level: 9 }).byteLength;
    return { path: relative(outputRoot, path), rawBytes, gzipBytes };
  })
  .sort((a, b) => b.gzipBytes - a.gzipBytes);

const totalRawBytes = rows.reduce((sum, row) => sum + row.rawBytes, 0);
const totalGzipBytes = rows.reduce((sum, row) => sum + row.gzipBytes, 0);
const largest = rows[0];

console.log(JSON.stringify({
  jsChunkCount: rows.length,
  totalRawBytes,
  totalGzipBytes,
  largestChunk: largest,
  largestChunkBudgetBytes: largestChunkBudget,
  topFive: rows.slice(0, 5),
}, null, 2));

if (!Number.isFinite(largestChunkBudget) || largestChunkBudget <= 0) {
  throw new Error(`Presupuesto inválido: ${process.env.PAGES_LARGEST_JS_GZIP_BUDGET_BYTES}`);
}

if (largest.gzipBytes > largestChunkBudget) {
  throw new Error(`El mayor chunk JS (${largest.gzipBytes} bytes gzip) supera el presupuesto de ${largestChunkBudget} bytes.`);
}
