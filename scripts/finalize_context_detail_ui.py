#!/usr/bin/env python3
"""Conecta el geovisor con el catálogo diferido de fichas territoriales.

Migración temporal y verificable: modifica solo el popup de contexto, crea el
cargador del catálogo y añade una prueba estructural. Falla si el archivo base
no coincide con los marcadores esperados.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "components" / "operational-geovisor-map.tsx"
LOADER_PATH = ROOT / "components" / "context-detail-catalog.ts"
TEST_PATH = ROOT / "tests" / "context-detail-catalog.test.mjs"

source = MAP_PATH.read_text(encoding="utf-8")

old_import = 'import type { FeatureCollection, PointRow } from "@/components/dashboard-map";\nimport dashboardJson from "@/public/data/dashboard.json";'
new_import = 'import type { FeatureCollection, PointRow } from "@/components/dashboard-map";\nimport { loadContextDetail } from "@/components/context-detail-catalog";\nimport dashboardJson from "@/public/data/dashboard.json";'
if old_import not in source:
    raise RuntimeError("No se encontró el bloque de importación esperado")
source = source.replace(old_import, new_import, 1)

start = source.index("function contextPopup(")
end = source.index("\nfunction featureBounds", start)
section = source[start:end]
old_signature = 'function contextPopup(feature: MapGeoJSONFeature) {\n  const properties = feature.properties as Record<string, unknown>;'
new_signature = 'function contextPopup(\n  feature: MapGeoJSONFeature,\n  details: Record<string, unknown> | null = null,\n  status: "loading" | "ready" | "error" = "ready",\n) {\n  const properties = { ...(feature.properties as Record<string, unknown>), ...(details ?? {}) };'
if old_signature not in section:
    raise RuntimeError("No se encontró la firma original de contextPopup")
section = section.replace(old_signature, new_signature, 1)
old_end = '  root.append(title, ...rows);\n  return root;\n}'
new_end = '  if (status === "loading") rows.push(popupRow("Detalle", "Cargando ficha completa…"));\n  if (status === "error") rows.push(popupRow("Detalle", "No fue posible cargar los atributos ampliados; se muestran los datos disponibles en la tesela."));\n  root.append(title, ...rows);\n  return root;\n}'
if old_end not in section:
    raise RuntimeError("No se encontró el cierre original de contextPopup")
section = section.replace(old_end, new_end, 1)
source = source[:start] + section + source[end:]

old_click = '''          if (queryModeRef.current === "context") {
            const feature = map.queryRenderedFeatures(event.point, { layers: [...CONTEXT_LAYER_IDS] })[0];
            if (!feature) return;
            new maplibregl.Popup({ offset: 8, closeButton: true }).setLngLat(event.lngLat).setDOMContent(contextPopup(feature)).addTo(map);
            return;
          }
'''
new_click = '''          if (queryModeRef.current === "context") {
            const feature = map.queryRenderedFeatures(event.point, { layers: [...CONTEXT_LAYER_IDS] })[0];
            if (!feature) return;
            const detailKey = present((feature.properties as Record<string, unknown>).detail_key);
            const popup = new maplibregl.Popup({ offset: 8, closeButton: true })
              .setLngLat(event.lngLat)
              .setDOMContent(contextPopup(feature, null, detailKey ? "loading" : "ready"))
              .addTo(map);
            if (detailKey) {
              void loadContextDetail(detailKey)
                .then((details) => {
                  if (popup.isOpen()) popup.setDOMContent(contextPopup(feature, details, "ready"));
                })
                .catch(() => {
                  if (popup.isOpen()) popup.setDOMContent(contextPopup(feature, null, "error"));
                });
            }
            return;
          }
'''
if old_click not in source:
    raise RuntimeError("No se encontró el manejador de consulta territorial esperado")
source = source.replace(old_click, new_click, 1)
MAP_PATH.write_text(source, encoding="utf-8")

LOADER_PATH.write_text('''"use client";

export type ContextDetail = Record<string, unknown>;

type ContextDetailCatalog = {
  generatedAtUtc?: string;
  recordCount?: number;
  records?: Record<string, ContextDetail>;
};

let catalogPromise: Promise<ContextDetailCatalog> | null = null;

function catalogUrl() {
  return new URL("./data/context-details.json", window.location.href).toString();
}

async function fetchCatalog() {
  const response = await fetch(catalogUrl(), { cache: "no-cache" });
  if (!response.ok) throw new Error(`No fue posible cargar context-details.json (${response.status})`);
  const catalog = await response.json() as ContextDetailCatalog;
  if (!catalog || typeof catalog !== "object" || !catalog.records || typeof catalog.records !== "object") {
    throw new Error("El catálogo de fichas territoriales no tiene el formato esperado");
  }
  return catalog;
}

export async function loadContextDetail(detailKey: string): Promise<ContextDetail | null> {
  const key = detailKey.trim();
  if (!key) return null;
  if (!catalogPromise) {
    catalogPromise = fetchCatalog().catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  const catalog = await catalogPromise;
  return catalog.records?.[key] ?? null;
}
''', encoding="utf-8")

TEST_PATH.write_text('''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const mapSource = await readFile(`${root}/components/operational-geovisor-map.tsx`, "utf8");
const loaderSource = await readFile(`${root}/components/context-detail-catalog.ts`, "utf8");
const tileBuilder = await readFile(`${root}/scripts/build_context_tiles_enriched.py`, "utf8");
const tileWorkflow = await readFile(`${root}/.github/workflows/build-context-tiles.yml`, "utf8");

test("loads complete territorial cards lazily from one catalog", () => {
  assert.match(mapSource, /loadContextDetail/);
  assert.match(mapSource, /detail_key/);
  assert.match(mapSource, /Cargando ficha completa/);
  assert.match(mapSource, /No fue posible cargar los atributos ampliados/);
  assert.match(loaderSource, /context-details\.json/);
  assert.match(loaderSource, /catalogPromise/);
  assert.match(loaderSource, /cache: "no-cache"/);
  assert.match(tileBuilder, /detail_key/);
  assert.match(tileBuilder, /context-details\.json/);
  assert.match(tileWorkflow, /public\/data\/context-details\.json/);
});
''', encoding="utf-8")

# Verificaciones locales de la propia migración.
updated = MAP_PATH.read_text(encoding="utf-8")
for marker in [
    'loadContextDetail',
    'detail_key',
    'Cargando ficha completa…',
    'popup.isOpen()',
]:
    if marker not in updated:
        raise RuntimeError(f"Falta marcador posterior a migración: {marker}")

print("Migración de fichas diferidas aplicada correctamente")
