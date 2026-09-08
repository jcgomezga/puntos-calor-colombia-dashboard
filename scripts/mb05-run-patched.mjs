import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const sourcePath = "scripts/mb05-apply-a11y-responsive.mjs";
let source = readFileSync(sourcePath, "utf8");
const from = '  const updated = source.replace(from, to);\n  if (updated.includes(from)) throw new Error(`El fragmento aparece más de una vez: ${label}`);';
const to = '  if (source.indexOf(from) !== source.lastIndexOf(from)) throw new Error(`El fragmento aparece más de una vez: ${label}`);\n  const updated = source.replace(from, to);';
if (!source.includes(from)) throw new Error("No se encontró el helper temporal que debía corregirse.");
source = source.replace(from, to);
const patchedPath = "/tmp/mb05-apply-a11y-responsive.mjs";
writeFileSync(patchedPath, source);
await import(pathToFileURL(patchedPath).href);
