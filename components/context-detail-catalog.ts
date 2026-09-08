"use client";

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
