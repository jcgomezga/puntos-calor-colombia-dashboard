"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";

const FILTER_KEYS: Record<string, string> = {
  desde: "date_from",
  hasta: "date_to",
  departamento: "department",
  municipio: "municipality",
  "area protegida": "protected_area",
  "cobertura 2024": "land_cover",
  "titulo minero": "mining_title",
  "relacion con proyecto anla": "anla_relation",
  "situacion anla": "anla_status",
  "area contractual anh": "anh_relation",
};

const QUERY_MODE_KEYS: Record<string, string> = {
  deteccion: "detection",
  territorio: "territory",
  cobertura: "coverage",
  contexto: "context",
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function directLabelText(label: HTMLLabelElement | null) {
  if (!label) return "";
  const span = Array.from(label.children).find((child) => child.tagName === "SPAN");
  return span?.textContent?.trim() ?? "";
}

function queryModeFromPanel() {
  const active = document.querySelector<HTMLButtonElement>('.query-control button[aria-pressed="true"]');
  return QUERY_MODE_KEYS[normalizeText(active?.textContent)] ?? "unknown";
}

function layerFromLabel(text: string) {
  const normalized = normalizeText(text);
  if (normalized.includes("coberturas ideam")) return "land_cover";
  if (normalized.includes("runap")) return "runap";
  if (normalized.includes("titulos mineros") || normalized.includes("anm")) return "anm";
  if (normalized.includes("proyectos anla") || normalized.includes("anla")) return "anla";
  if (normalized.includes("areas asignadas anh") || normalized.includes("anh")) return "anh";
  if (normalized.includes("detecciones")) return "detections";
  if (normalized.includes("limites") || normalized.includes("divisiones territoriales")) return "boundaries";
  return "";
}

function contextSourceFromText(text: string) {
  const normalized = normalizeText(text);
  if (normalized.includes("runap")) return "runap";
  if (normalized.includes("anm") || normalized.includes("titulo minero")) return "anm";
  if (normalized.includes("anla")) return "anla";
  if (normalized.includes("anh") || normalized.includes("area contractual")) return "anh";
  return "unknown";
}

function findFilterSelect(labelName: string) {
  const wanted = normalizeText(labelName);
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>(".filterbar label"));
  const label = labels.find((item) => normalizeText(directLabelText(item)) === wanted);
  return label?.querySelector<HTMLSelectElement>("select") ?? null;
}

function currentTerritoryView() {
  const heading = document.querySelector<HTMLElement>(".map-panel .panel-heading h2")?.textContent?.trim();
  if (!heading) return null;

  const department = findFilterSelect("Departamento");
  const municipality = findFilterSelect("Municipio");
  let level = "national";
  let code = "00";

  if (municipality && municipality.value !== "00000") {
    level = "municipality";
    code = municipality.value;
  } else if (department && department.value !== "00") {
    level = department.value === "__unassigned_territory__" ? "unassigned" : "department";
    code = level === "unassigned" ? "unassigned" : department.value;
  }

  return { level, code, name: heading.slice(0, 100), signature: `${level}|${code}|${heading}` };
}

function popupResult(heading: string) {
  const normalized = normalizeText(heading);
  if (normalized.includes("deteccion termica ideam")) return { event: "map_result_view", key: "detection", params: { result_type: "detection" } };
  if (normalized.includes("cobertura de la tierra")) return { event: "map_result_view", key: "coverage", params: { result_type: "coverage" } };
  if (normalized.startsWith("ficha")) {
    const source = contextSourceFromText(heading);
    return { event: "context_entity_view", key: `context_${source}`, params: { source } };
  }
  return null;
}

export function AnalyticsInteractionTracker() {
  useEffect(() => {
    let lastTerritorySignature = currentTerritoryView()?.signature ?? "";

    const trackTerritoryChange = () => {
      const territory = currentTerritoryView();
      if (!territory || territory.signature === lastTerritorySignature) return;
      lastTerritorySignature = territory.signature;
      trackAnalyticsEvent("territory_view", {
        territory_level: territory.level,
        territory_code: territory.code,
        territory_name: territory.name,
      });
    };

    const trackRenderedResults = () => {
      document.querySelectorAll<HTMLElement>(".maplibregl-popup .geovisor-popup h3").forEach((heading) => {
        const result = popupResult(heading.textContent ?? "");
        if (!result) return;
        const popup = heading.closest<HTMLElement>(".maplibregl-popup");
        if (!popup) return;
        const seen = new Set((popup.dataset.analyticsResults ?? "").split(",").filter(Boolean));
        if (seen.has(result.key)) return;
        seen.add(result.key);
        popup.dataset.analyticsResults = Array.from(seen).join(",");
        trackAnalyticsEvent(result.event, result.params);
      });

      document.querySelectorAll<HTMLElement>(".geovisor-error, .coverage-status.error").forEach((element) => {
        if (element.dataset.analyticsSeen === "true") return;
        element.dataset.analyticsSeen = "true";
        trackAnalyticsEvent("geovisor_error", {
          error_type: element.classList.contains("coverage-status") ? "land_cover_service" : "map_initialization",
        });
      });
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target instanceof HTMLSelectElement && target.closest(".filterbar")) {
        const label = target.closest("label");
        const filter = FILTER_KEYS[normalizeText(directLabelText(label))];
        if (filter) trackAnalyticsEvent("filter_change", { filter, value: target.value.slice(0, 100) });
        return;
      }

      if (target instanceof HTMLInputElement && target.type === "date" && target.closest(".filterbar")) {
        const label = target.closest("label");
        const filter = FILTER_KEYS[normalizeText(directLabelText(label))];
        if (filter) trackAnalyticsEvent("filter_change", { filter, value: target.value });
        return;
      }

      if (target instanceof HTMLInputElement && target.type === "checkbox" && target.closest(".geovisor-map")) {
        const layer = layerFromLabel(target.closest("label")?.textContent ?? "");
        if (layer) trackAnalyticsEvent("map_layer_toggle", { layer, enabled: target.checked });
        return;
      }

      if (target instanceof HTMLSelectElement && target.closest(".context-match-selector")) {
        const source = contextSourceFromText(target.selectedOptions[0]?.textContent ?? "");
        trackAnalyticsEvent("context_entity_select", { source });
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const reset = target.closest<HTMLButtonElement>(".reset-button");
      if (reset) {
        trackAnalyticsEvent("filter_reset");
        return;
      }

      const mapModeButton = target.closest<HTMLButtonElement>('[aria-label="Modo de mapa"] button');
      if (mapModeButton) {
        if (mapModeButton.getAttribute("aria-pressed") === "true") return;
        const view = normalizeText(mapModeButton.textContent) === "mapa basico" ? "basic" : "geovisor";
        trackAnalyticsEvent("map_view_change", { view });
        return;
      }

      const queryModeButton = target.closest<HTMLButtonElement>(".query-control button");
      if (queryModeButton) {
        if (queryModeButton.getAttribute("aria-pressed") === "true") return;
        const mode = QUERY_MODE_KEYS[normalizeText(queryModeButton.textContent)] ?? "unknown";
        trackAnalyticsEvent("map_query_mode_change", { mode });
        return;
      }

      const centerQuery = target.closest<HTMLButtonElement>(".center-query-button");
      if (centerQuery) {
        trackAnalyticsEvent("map_query", { mode: queryModeFromPanel(), method: "center" });
        return;
      }

      if (target.closest(".geovisor-canvas")) {
        trackAnalyticsEvent("map_query", { mode: queryModeFromPanel(), method: "map_click" });
        return;
      }

      const methodologyLink = target.closest<HTMLAnchorElement>('a[href*="/metodologia"]');
      if (methodologyLink) trackAnalyticsEvent("methodology_view", { method: "internal_link" });
    };

    const observer = new MutationObserver(() => {
      trackTerritoryChange();
      trackRenderedResults();
    });

    document.addEventListener("change", onChange, true);
    document.addEventListener("click", onClick, true);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    trackRenderedResults();

    return () => {
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
