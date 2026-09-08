import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { gzipSync } from "node:zlib";

const outputRoot = join(process.cwd(), "out");
const htmlPath = join(outputRoot, "index.html");

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

const scripts = scriptSources.map((source) => {
  const path = resolveOutputFile(source);
  const bytes = readFileSync(path);
  return {
    source,
    path: path.replace(`${process.cwd()}/`, ""),
    decodedBytes: statSync(path).size,
    gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
  };
});

const summary = {
  scriptCount: scripts.length,
  decodedBytes: scripts.reduce((sum, item) => sum + item.decodedBytes, 0),
  gzipBytes: scripts.reduce((sum, item) => sum + item.gzipBytes, 0),
  largestDecodedBytes: Math.max(...scripts.map((item) => item.decodedBytes)),
  largestGzipBytes: Math.max(...scripts.map((item) => item.gzipBytes)),
  scripts: scripts.sort((a, b) => b.gzipBytes - a.gzipBytes),
};

console.log(JSON.stringify(summary, null, 2));
