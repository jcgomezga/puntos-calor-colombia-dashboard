import { readFile, writeFile } from "node:fs/promises";

async function replaceFirst(path, before, after, label) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) throw new Error(`${label}: patrón no encontrado en ${path}`);
  await writeFile(path, source.replace(before, after));
}

await replaceFirst(
  "app/globals.css",
  ".layer-control { max-height: calc(100% - 20px); padding: 8px; display: flex; flex-direction: column; overflow: hidden; }",
  ".layer-control { max-height: calc(100% - 72px); padding: 8px; display: flex; flex-direction: column; overflow: hidden; }",
  "reserva inferior escritorio",
);
await replaceFirst(
  "app/globals.css",
  ".layer-control { width: min(280px, calc(100% - 20px)); max-height: calc(100% - 20px); }",
  ".layer-control { width: min(280px, calc(100% - 20px)); max-height: calc(100% - 72px); }",
  "reserva inferior móvil",
);
await replaceFirst(
  "scripts/check-geovisor-webgl-e2e.mjs",
  'import { mkdtemp, readFile, rm, stat } from "node:fs/promises";',
  'import { mkdtemp, rm, stat } from "node:fs/promises";',
  "limpieza import E2E",
);
await replaceFirst(
  "scripts/check-geovisor-webgl-e2e.mjs",
  '    const nav = document.querySelector(".maplibregl-ctrl-group button");\n    return {',
  '    const nav = document.querySelector(".maplibregl-ctrl-group button");\n    const rect = (element) => { if (!element) return null; const r = element.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };\n    const panelRect = rect(panel);\n    const scaleRect = rect(document.querySelector(".maplibregl-ctrl-scale"));\n    const overlapArea = (a, b) => { if (!a || !b) return 0; const width = Math.max(0, Math.min(a.right,b.right)-Math.max(a.x,b.x)); const height = Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)); return width * height; };\n    return {',
  "medición escala escritorio",
);
await replaceFirst(
  "scripts/check-geovisor-webgl-e2e.mjs",
  '      navHeight: nav ? Number.parseFloat(getComputedStyle(nav).height) : 0,\n    };',
  '      navHeight: nav ? Number.parseFloat(getComputedStyle(nav).height) : 0,\n      scalePanelOverlap: overlapArea(panelRect, scaleRect),\n    };',
  "resultado escala escritorio",
);
await replaceFirst(
  "scripts/check-geovisor-webgl-e2e.mjs",
  '  assert(desktop.navWidth >= 40 && desktop.navHeight >= 40, `Targets MapLibre insuficientes en escritorio: ${desktop.navWidth}×${desktop.navHeight}.`);\n  checks.push({ flow: "geovisor escritorio", ...desktop });',
  '  assert(desktop.navWidth >= 40 && desktop.navHeight >= 40, `Targets MapLibre insuficientes en escritorio: ${desktop.navWidth}×${desktop.navHeight}.`);\n  assert(desktop.scalePanelOverlap === 0, `El panel de escritorio tapa la escala cartográfica (${desktop.scalePanelOverlap}px²).`);\n  checks.push({ flow: "geovisor escritorio", ...desktop });',
  "gate escala escritorio",
);
await replaceFirst(
  "scripts/check-geovisor-webgl-e2e.mjs",
  '  await waitFor(cdp.send, `document.querySelector(".layer-control")?.classList.contains("open") === true && Boolean(document.querySelector(".center-query-button"))`, "No fue posible abrir el panel cartográfico móvil.");\n  checks.push({ flow: "panel móvil expandible" });',
  '  await waitFor(cdp.send, `document.querySelector(".layer-control")?.classList.contains("open") === true && Boolean(document.querySelector(".center-query-button"))`, "No fue posible abrir el panel cartográfico móvil.");\n  const mobileOpen = await evaluate(cdp.send, `(() => {\n    const rect = (element) => { if (!element) return null; const r = element.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };\n    const overlapArea = (a, b) => { if (!a || !b) return 0; const width = Math.max(0, Math.min(a.right,b.right)-Math.max(a.x,b.x)); const height = Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)); return width * height; };\n    const panel = rect(document.querySelector(".layer-control"));\n    const scale = rect(document.querySelector(".maplibregl-ctrl-scale"));\n    const attribution = rect(document.querySelector(".maplibregl-ctrl-attrib"));\n    return { panel, scaleOverlap: overlapArea(panel, scale), attributionOverlap: overlapArea(panel, attribution) };\n  })()`);\n  assert(mobileOpen.scaleOverlap === 0, `El panel móvil tapa la escala cartográfica (${mobileOpen.scaleOverlap}px²).`);\n  assert(mobileOpen.attributionOverlap === 0, `El panel móvil tapa la atribución cartográfica (${mobileOpen.attributionOverlap}px²).`);\n  checks.push({ flow: "panel móvil expandible", ...mobileOpen });',
  "gate controles inferiores móvil",
);

console.log("MB-09: pulido final aplicado (reserva inferior + gates de escala/atribución + lint)." );
