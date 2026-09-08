import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { gzipSync } from "node:zlib";

const outputRoot = join(process.cwd(), "out");
const chunksRoot = join(outputRoot, "_next", "static", "chunks");
const htmlPath = join(outputRoot, "index.html");
const INITIAL_GZIP_BUDGET_BYTES = 500_000;

if (!existsSync(htmlPath)) {
  throw new Error(`No existe ${htmlPath}. Ejecuta primero npm run build:pages.`);
}

const html = readFileSync(htmlPath, "utf8");
const scriptSources = [...new Set(
  [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi)].map((match) => match[1]),
)];

if (!scriptSources.length) {
  throw new Error("No se encontraron scripts JavaScript referenciados por out/index.html.");
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

const outputFiles = walk(outputRoot);
const byBasename = new Map();
for (const path of outputFiles) {
  const name = basename(path);
  const items = byBasename.get(name) ?? [];
  items.push(path);
  byBasename.set(name, items);
}

function resolveOutputFile(source) {
  const pathname = new URL(source, "https://example.invalid").pathname;
  const relative = pathname.replace(/^\/+/, "");
  const candidates = [
    join(outputRoot, relative),
    join(outputRoot, relative.replace(/^puntos-calor-colombia-dashboard\//, "")),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const matches = byBasename.get(basename(pathname)) ?? [];
  if (matches.length === 1) return matches[0];
  throw new Error(`No se pudo resolver el script publicado: ${source}`);
}

function measure(path, source = null) {
  const bytes = readFileSync(path);
  return {
    ...(source ? { source } : {}),
    path: path.replace(`${process.cwd()}/`, ""),
    decodedBytes: statSync(path).size,
    gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
  };
}

const initialScripts = scriptSources.map((source) => measure(resolveOutputFile(source), source));
const initialPaths = new Set(initialScripts.map((item) => item.path));
const deferredScripts = walk(chunksRoot)
  .filter((path) => path.endsWith(".js"))
  .map((path) => measure(path))
  .filter((item) => !initialPaths.has(item.path))
  .sort((a, b) => b.gzipBytes - a.gzipBytes);

const summary = {
  initialGzipBudgetBytes: INITIAL_GZIP_BUDGET_BYTES,
  initial: {
    scriptCount: initialScripts.length,
    decodedBytes: initialScripts.reduce((sum, item) => sum + item.decodedBytes, 0),
    gzipBytes: initialScripts.reduce((sum, item) => sum + item.gzipBytes, 0),
    largestDecodedBytes: Math.max(...initialScripts.map((item) => item.decodedBytes)),
    largestGzipBytes: Math.max(...initialScripts.map((item) => item.gzipBytes)),
    scripts: initialScripts.sort((a, b) => b.gzipBytes - a.gzipBytes),
  },
  deferred: {
    scriptCount: deferredScripts.length,
    largestDecodedBytes: deferredScripts[0]?.decodedBytes ?? 0,
    largestGzipBytes: deferredScripts[0]?.gzipBytes ?? 0,
    largestScripts: deferredScripts.slice(0, 10),
  },
};

console.log(JSON.stringify(summary, null, 2));

if (summary.initial.gzipBytes > INITIAL_GZIP_BUDGET_BYTES) {
  throw new Error(
    `JavaScript inicial excede el presupuesto: ${summary.initial.gzipBytes} > ${INITIAL_GZIP_BUDGET_BYTES} bytes gzip.`,
  );
}
