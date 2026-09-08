"use client";

import { Layers3 } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, PointRow } from "@/components/dashboard-map";
import { loadContextDetail } from "@/components/context-detail-catalog";
import dashboardJson from "@/public/data/dashboard.json";

const COLOMBIA_BOUNDS: maplibregl.LngLatBoundsLike = [[-81.85, -4.35], [-66.75, 13.55]];
const IDEAM_SOURCE_ID = "ideam-coberturas-2024";
const IDEAM_SOURCE_LAYER = "Capa geográfica del Mapa Nacional de las Coberturas de la Tierra";
const IDEAM_TILE_URL = "https://visualizador.ideam.gov.co/gisserver/rest/services/Hosted/MNCT_2024V01_VT/VectorTileServer/tile/{z}/{y}/{x}.pbf";
const DEFAULT_LAND_COVER_OPACITY = 0.48;
const CONTEXT_SOURCE_ID = "contexto-territorial";
const DEPARTMENT_LABEL_LAYER_ID = "dane-department-labels";
const MUNICIPALITY_LABEL_LAYER_ID = "dane-municipality-labels";
const NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM = 7.6;
const NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM = 8;
const SELECTED_DEPARTMENT_LABEL_MAX_ZOOM = 6.6;
const SELECTED_MUNICIPALITY_LABEL_MIN_ZOOM = 6.35;
const MUNICIPALITY_LABEL_MAX_ZOOM = 14;
const OPERATIONAL_SPATIAL_METERS = 1_000;
const OPERATIONAL_TEMPORAL_HOURS = 24;
const OPERATIONAL_MINIMUM_MEMBERS = 3;

const LAND_COVER_CLASSES = [
  ["1.1.1. Tejido urbano continuo", "#CC0000"],
  ["1.1.2. Tejido urbano discontinuo", "#F80000"],
  ["1.2.1. Zonas industriales o comerciales", "#CC4D2A"],
  ["1.2.2. Red vial, ferroviaria y terrenos asociados", "#D96545"],
  ["1.2.3. Zonas portuarias", "#E1846B"],
  ["1.2.4. Aeropuertos", "#E79C87"],
  ["1.2.5. Obras hidráulicas", "#EEB9AA"],
  ["1.3.1. Zonas de extracción minera", "#A600CC"],
  ["1.3.2. Zona de disposición de residuos", "#D317FF"],
  ["1.4.1. Zonas verdes urbanas", "#FF8080"],
  ["1.4.2. Instalaciones recreativas", "#FFAFAF"],
  ["2.1.1. Otros cultivos transitorios", "#FFFFA6"],
  ["2.1.2. Cereales", "#EEE800"],
  ["2.1.3. Oleaginosas y leguminosas", "#FFFF5F"],
  ["2.1.4. Hortalizas", "#E1D200"],
  ["2.1.5. Tubérculos", "#D2CD00"],
  ["2.2.1. Cultivos permanentes herbáceos", "#F2CCA6"],
  ["2.2.2. Cultivos permanentes arbustivos", "#F2A64D"],
  ["2.2.3. Cultivos permanentes arbóreos", "#E6A600"],
  ["2.2.4. Cultivos agroforestales", "#CC900A"],
  ["2.2.5. Cultivos confinados", "#824A12"],
  ["2.3.1. Pastos limpios", "#CCFFCC"],
  ["2.3.2. Pastos arbolados", "#9EFF9E"],
  ["2.3.3. Pastos enmalezados", "#9EFFC8"],
  ["2.4.1. Mosaico de cultivos", "#FFE6A6"],
  ["2.4.2. Mosaico de pastos y cultivos", "#FFD875"],
  ["2.4.3. Mosaico de cultivos, pastos y espacios naturales", "#FFC941"],
  ["2.4.4. Mosaico de pastos con espacios naturales", "#FEB500"],
  ["2.4.5. Mosaico de cultivos con espacios naturales", "#FFB03C"],
  ["3.1.1. Bosque denso", "#478F00"],
  ["3.1.2. Bosque abierto", "#55AB00"],
  ["3.1.3. Bosque fragmentado", "#61C200"],
  ["3.1.4. Bosque de galería y ripario", "#70E000"],
  ["3.1.5. Plantación forestal", "#80FF00"],
  ["3.2.1. Herbazal", "#CCF24E"],
  ["3.2.2. Arbustal", "#ACDB0F"],
  ["3.2.3. Vegetación secundaria o en transición", "#96BF0D"],
  ["3.3.1. Zonas arenosas naturales", "#C2C2C2"],
  ["3.3.2. Afloramientos rocosos", "#B3B3B3"],
  ["3.3.3. Tierras desnudas y degradadas", "#9E9E9E"],
  ["3.3.4. Zonas quemadas", "#898989"],
  ["3.3.5. Zonas glaciares y nivales", "#6565B4"],
  ["4.1.1. Zonas pantanosas", "#A6A6FF"],
  ["4.1.2. Turberas", "#4D91FF"],
  ["4.1.3. Vegetación acuática sobre cuerpos de agua", "#5050FF"],
  ["4.2.1. Pantanos costeros", "#CCCCFF"],
  ["4.2.2. Salitral", "#B7B7FF"],
  ["4.2.3. Sedimentos expuestos en bajamar", "#A6A6E6"],
  ["5.1.1. Ríos", "#0000F8"],
  ["5.1.2. Lagunas, lagos y ciénagas naturales", "#0080FF"],
  ["5.1.3. Canales", "#00B2FF"],
  ["5.1.4. Cuerpos de agua artificiales", "#00CEF2"],
  ["5.2.1. Lagunas costeras", "#45E0F5"],
  ["5.2.3. Estanques para acuicultura marina", "#CCF6FF"],
] as const;

const LAND_COVER_LAYER_IDS = LAND_COVER_CLASSES.map((_, index) => `ideam-cobertura-${index}`);
const FAMILY_LEGEND = [
  ["Territorios artificializados", "#d44832"],
  ["Áreas agrícolas", "#e4bd31"],
  ["Bosques y áreas seminaturales", "#5fa620"],
  ["Áreas húmedas", "#7e91ed"],
  ["Superficies de agua", "#168ddd"],
] as const;
const CONTEXT_LAYER_IDS = [
  "runap-fill", "runap-line", "anh-fill", "anh-line", "anm-fill", "anm-line",
  "anla-fill", "anla-line", "anla-point",
] as const;
const CONTEXT_GROUPS = {
  runap: ["runap-fill", "runap-line"],
  anh: ["anh-fill", "anh-line"],
  anm: ["anm-fill", "anm-line"],
  anla: ["anla-fill", "anla-line", "anla-point"],
} as const;
let pmtilesProtocol: Protocol | null = null;

type DashboardEpisode = {
  id: string;
  size: number;
  start: string;
  end: string;
  durationHours: number;
  longitude: number;
  latitude: number;
  chained: boolean;
  extentKm?: number;
  departments?: string[];
  municipalities?: string[];
  frpMeanMw?: number | null;
  frpMaxMw?: number | null;
};
type DashboardCatalog = { episodes?: DashboardEpisode[] };
type TerritoryNames = Record<string, string>;
type LayerState = {
  landCover: boolean;
  episodes: boolean;
  detections: boolean;
  boundaries: boolean;
  runap: boolean;
  anm: boolean;
  anla: boolean;
  anh: boolean;
};
type QueryMode = "territory" | "coverage" | "context";

const dashboard = dashboardJson as unknown as DashboardCatalog;
const INITIAL_LAYERS: LayerState = {
  landCover: true,
  episodes: true,
  detections: false,
  boundaries: true,
  runap: false,
  anm: false,
  anla: false,
  anh: false,
};

function popupRow(label: string, value: string) {
  const row = document.createElement("div");
  const key = document.createElement("span");
  const content = document.createElement("strong");
  key.textContent = label;
  content.textContent = value;
  row.append(key, content);
  return row;
}

function popupButton(label: string, onClick: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.marginTop = "6px";
  button.style.padding = "6px 8px";
  button.style.border = "1px solid #bfcac1";
  button.style.borderRadius = "6px";
  button.style.background = "#ffffff";
  button.style.color = "#214d35";
  button.style.fontSize = "10px";
  button.style.fontWeight = "700";
  button.addEventListener("click", onClick);
  return button;
}

function humanNumber(value: unknown, suffix = "") {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString("es-CO", { maximumFractionDigits: 2 })}${suffix}` : "Sin dato";
}

function present(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text && text.toLowerCase() !== "null" ? text : "";
}

function firstProperty(properties: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = present(properties[key]);
    if (value) return value;
  }
  return "";
}

function hotspotGeoJson(points: PointRow[], dates: string[], sources: string[], focusedEpisodeIndex: number | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const filtered = focusedEpisodeIndex === null ? points : points.filter((point) => point[18] === focusedEpisodeIndex);
  return {
    type: "FeatureCollection",
    features: filtered.map((point, index) => ({
      type: "Feature",
      id: index,
      geometry: { type: "Point", coordinates: [point[0], point[1]] },
      properties: {
        date: dates[point[4]] ?? "Sin fecha",
        minute: point[5],
        source: sources[point[6]] ?? "Fuente no identificada",
        frp: point[8],
        confidence: point[9],
        protected: point[11] === 1,
        mining: point[13] === 1,
        episodeClass: point[17] ?? 0,
        episodeIndex: point[18] ?? -1,
        episodeId: (point[18] ?? -1) >= 0 ? dashboard.episodes?.[point[18]!]?.id ?? "" : "",
      },
    })),
  };
}

function episodeGeoJson(points: PointRow[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const visibleMembers = new Map<number, number>();
  for (const point of points) {
    const index = point[18] ?? -1;
    if (index >= 0) visibleMembers.set(index, (visibleMembers.get(index) ?? 0) + 1);
  }
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const [index, count] of visibleMembers.entries()) {
    const episode = dashboard.episodes?.[index];
    if (!episode) continue;
    features.push({
      type: "Feature",
      id: index,
      geometry: { type: "Point", coordinates: [episode.longitude, episode.latitude] },
      properties: {
        index,
        id: episode.id,
        size: episode.size,
        visibleMembers: count,
        start: episode.start,
        end: episode.end,
        durationHours: episode.durationHours,
        chained: episode.chained,
        extentKm: episode.extentKm ?? null,
        frpMeanMw: episode.frpMeanMw ?? null,
        frpMaxMw: episode.frpMaxMw ?? null,
        departments: episode.departments?.join(", ") ?? "",
        municipalities: episode.municipalities?.join(", ") ?? "",
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function hotspotPopup(feature: MapGeoJSONFeature) {
  const properties = feature.properties as Record<string, unknown>;
  const root = document.createElement("div");
  root.className = "geovisor-popup";
  const title = document.createElement("h3");
  title.textContent = "Detección térmica individual";
  const minute = Number(properties.minute);
  const hourLabel = Number.isFinite(minute)
    ? `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
    : "—";
  const classLabel = Number(properties.episodeClass) >= 2 ? "Miembro de episodio" : Number(properties.episodeClass) === 1 ? "Asociación de 2" : "Aislada";
  root.append(
    title,
    popupRow("Fecha", `${present(properties.date) || "Sin fecha"} · ${hourLabel}`),
    popupRow("Sensor", present(properties.source) || "Sin dato"),
    popupRow("FRP", properties.frp == null ? "Sin dato" : humanNumber(properties.frp, " MW")),
    popupRow("Confianza", humanNumber(properties.confidence)),
    popupRow("Clasificación", classLabel),
  );
  if (present(properties.episodeId)) root.append(popupRow("Episodio", present(properties.episodeId)));
  root.append(
    popupRow("RUNAP", properties.protected ? "Dentro" : "Fuera"),
    popupRow("Título ANM", properties.mining ? "Dentro" : "Fuera"),
  );
  return root;
}

function episodePopup(feature: MapGeoJSONFeature, onFocusMembers: (index: number) => void) {
  const properties = feature.properties as Record<string, unknown>;
  const root = document.createElement("div");
  root.className = "geovisor-popup";
  const title = document.createElement("h3");
  title.textContent = "Episodio de detecciones térmicas";
  root.append(
    title,
    popupRow("Identificador", present(properties.id) || "Sin dato"),
    popupRow("Detecciones", humanNumber(properties.size)),
    popupRow("Visibles con filtros", humanNumber(properties.visibleMembers)),
    popupRow("Inicio", present(properties.start) || "Sin dato"),
    popupRow("Fin", present(properties.end) || "Sin dato"),
    popupRow("Duración", humanNumber(properties.durationHours, " h")),
    popupRow("Extensión de caja", properties.extentKm == null ? "Sin dato" : humanNumber(properties.extentKm, " km")),
    popupRow("FRP máxima", properties.frpMaxMw == null ? "Sin dato" : humanNumber(properties.frpMaxMw, " MW")),
    popupRow("Municipios", present(properties.municipalities) || "Sin dato"),
    popupRow("Estado", properties.chained ? "Encadenado · requiere revisión" : "Episodio operacional"),
  );
  root.append(popupButton("Mostrar detecciones de este episodio", () => onFocusMembers(Number(properties.index))));
  return root;
}

function landCoverPopup(feature: MapGeoJSONFeature) {
  const properties = feature.properties as Record<string, unknown>;
  const symbol = Number(properties._symbol);
  const root = document.createElement("div");
  root.className = "geovisor-popup";
  const title = document.createElement("h3");
  title.textContent = "Cobertura de la Tierra 2024";
  const level1 = firstProperty(properties, ["nivel_1", "NIVEL_1"]);
  const level2 = firstProperty(properties, ["nivel_2", "NIVEL_2"]);
  const level3 = firstProperty(properties, ["nivel_3", "NIVEL_3"]);
  const level4 = firstProperty(properties, ["nivel_4", "NIVEL_4"]);
  const level5 = firstProperty(properties, ["nivel_5", "NIVEL_5"]);
  const level6 = firstProperty(properties, ["nivel_6", "NIVEL_6"]);
  const rendererLabel = LAND_COVER_CLASSES[symbol]?.[0] ?? "Clase sin identificar";
  const area = firstProperty(properties, ["area_ha", "AREA_HA"]);
  const department = firstProperty(properties, ["nom_dep", "NOM_DEP"]);
  const municipality = firstProperty(properties, ["nom_mun", "NOM_MUN"]);
  const authority = firstProperty(properties, ["nom_aua", "NOM_AUA"]);
  const period = firstProperty(properties, ["periodo", "PERIODO"]);
  root.append(title, popupRow("Clase cartográfica", rendererLabel));
  if (level1) root.append(popupRow("Nivel 1", level1));
  if (level2) root.append(popupRow("Nivel 2", level2));
  if (level3) root.append(popupRow("Nivel 3", level3));
  if (level4) root.append(popupRow("Nivel 4", level4));
  if (level5) root.append(popupRow("Nivel 5", level5));
  if (level6) root.append(popupRow("Nivel 6", level6));
  if (area && Number.isFinite(Number(area))) root.append(popupRow("Área del polígono", humanNumber(area, " ha")));
  if (department || municipality) root.append(popupRow("Territorio", [municipality, department].filter(Boolean).join(" · ")));
  if (authority) root.append(popupRow("Autoridad ambiental", authority));
  if (period) root.append(popupRow("Periodo", period));
  root.append(popupRow("Fuente", "IDEAM · Mapa Nacional de Coberturas de la Tierra 2024 · escala 1:100.000"));
  return root;
}

function contextPopup(
  feature: MapGeoJSONFeature,
  details: Record<string, unknown> | null = null,
  status: "loading" | "ready" | "error" = "ready",
) {
  const properties = { ...(feature.properties as Record<string, unknown>), ...(details ?? {}) };
  const sourceLayer = feature.sourceLayer;
  const root = document.createElement("div");
  root.className = "geovisor-popup";
  root.style.maxHeight = "380px";
  root.style.overflowY = "auto";
  const title = document.createElement("h3");
  const rows: HTMLElement[] = [];
  const addIf = (label: string, value: unknown, suffix = "") => {
    const text = present(value);
    if (text) rows.push(popupRow(label, suffix ? `${text}${suffix}` : text));
  };
  if (sourceLayer === "runap") {
    title.textContent = "Ficha RUNAP";
    if (feature.id !== undefined && feature.id !== null) rows.push(popupRow("ID", String(feature.id)));
    addIf("Nombre", properties.nombre);
    addIf("Categoría", properties.categoria);
    addIf("Condición", properties.condicion);
    addIf("Administración", properties.organizacion);
    rows.push(popupRow("Lectura", "Coincidencia espacial; no implica causalidad"));
  } else if (sourceLayer === "anm") {
    title.textContent = "Ficha de título minero ANM";
    addIf("Expediente", properties.codigo);
    addIf("Titular / solicitante", properties.solicitante);
    addIf("Minerales", properties.minerales);
    addIf("Etapa", properties.etapa);
    addIf("Estado", properties.estado);
    addIf("Modalidad", properties.modalidad);
    addIf("Tipo de explotación", properties.tipo);
    addIf("Municipios", properties.municipios);
    addIf("Departamento", properties.departamento);
    if (properties.area_ha != null && Number.isFinite(Number(properties.area_ha))) rows.push(popupRow("Área", humanNumber(properties.area_ha, " ha")));
    addIf("Fecha de inscripción", properties.fecha_inscripcion);
    addIf("Fecha de terminación", properties.fecha_terminacion);
    rows.push(popupRow("Lectura", "Intersección espacial; no implica origen del fuego"));
  } else if (sourceLayer === "anla") {
    title.textContent = "Ficha de proyecto ANLA";
    addIf("Expediente", properties.expediente);
    addIf("Proyecto", properties.proyecto);
    addIf("Operador", properties.operador);
    addIf("Sector", properties.sector);
    addIf("Situación", properties.situacion === "evaluacion" ? "En evaluación" : "Licenciado");
    addIf("Estado", properties.estado);
    addIf("Geometría", properties.geometria);
    addIf("Acto administrativo", properties.acto_administrativo);
    addIf("Fecha del acto", properties.fecha_acto);
    addIf("Artículo", properties.articulo_acto);
    addIf("Contrato", properties.contrato);
    addIf("Tipo de infraestructura", properties.tipo_infraestructura);
    if (properties.area_ha != null && Number.isFinite(Number(properties.area_ha))) rows.push(popupRow("Área", humanNumber(properties.area_ha, " ha")));
    if (properties.longitud_m != null && Number.isFinite(Number(properties.longitud_m))) rows.push(popupRow("Longitud", humanNumber(properties.longitud_m, " m")));
    addIf("Descripción", properties.descripcion);
    addIf("Nomenclatura", properties.nomenclatura);
    addIf("Observación", properties.observacion);
    rows.push(popupRow("Lectura", "Coincidencia/proximidad espacial; no implica causalidad"));
  } else {
    title.textContent = "Ficha de área contractual ANH";
    addIf("ID contractual", properties.contrato_id);
    addIf("Contrato", properties.contrato);
    addIf("Área / bloque", properties.area);
    addIf("Operador", properties.operador);
    addIf("Operador abreviado", properties.operador_abrev);
    addIf("Estado", properties.estado);
    addIf("Clasificación", properties.clasificacion);
    addIf("Tipo de contrato", properties.tipo);
    addIf("Subtipo", properties.subtipo);
    addIf("Fecha de firma", properties.fecha_firma);
    addIf("Cuenca", properties.cuenca);
    if (properties.area_ha != null && Number.isFinite(Number(properties.area_ha))) rows.push(popupRow("Área", humanNumber(properties.area_ha, " ha")));
    addIf("Superficie", properties.superficie);
    addIf("Yacimiento", properties.yacimiento);
    addIf("Proceso", properties.proceso);
    addIf("Leyenda", properties.leyenda);
    addIf("ID GECOH", properties.id_gecoh);
    addIf("Minuta oficial", properties.url_minuta);
    rows.push(popupRow("Lectura", "Coincidencia/proximidad espacial; no implica causalidad"));
  }
  if (status === "loading") rows.push(popupRow("Detalle", "Cargando ficha completa…"));
  if (status === "error") rows.push(popupRow("Detalle", "No fue posible cargar los atributos ampliados; se muestran los datos disponibles en la tesela."));
  root.append(title, ...rows);
  return root;
}

function featureBounds(features: FeatureCollection["features"]): maplibregl.LngLatBoundsLike | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      minX = Math.min(minX, value[0]); minY = Math.min(minY, value[1]);
      maxX = Math.max(maxX, value[0]); maxY = Math.max(maxY, value[1]);
      return;
    }
    value.forEach(visit);
  };
  features.forEach((feature) => visit(feature.geometry.coordinates));
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

function geometryCoordinates(feature: FeatureCollection["features"][number]): number[][][] {
  if (feature.geometry.type === "Polygon") return feature.geometry.coordinates as number[][][];
  return (feature.geometry.coordinates as number[][][][]).map((polygon) => polygon[0]).filter(Boolean);
}

function labelPoint(feature: FeatureCollection["features"][number]) {
  const rings = geometryCoordinates(feature);
  let best: [number, number] | null = null;
  let bestSpan = -1;
  for (const ring of rings) {
    if (!ring?.length) continue;
    const xs = ring.map((point) => point[0]);
    const ys = ring.map((point) => point[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = (maxX - minX) * (maxY - minY);
    if (span > bestSpan) {
      bestSpan = span;
      best = [(minX + maxX) / 2, (minY + maxY) / 2];
    }
  }
  return best;
}

function territoryLabels(features: FeatureCollection["features"], names: TerritoryNames, codeProperty: string, departmentProperty?: string): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: features.flatMap((feature) => {
      const code = String(feature.properties[codeProperty] ?? "");
      const point = labelPoint(feature);
      if (!code || !point || !names[code]) return [];
      return [{
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: point },
        properties: { code, name: names[code], ...(departmentProperty ? { departmentCode: String(feature.properties[departmentProperty] ?? "") } : {}) },
      }];
    }),
  };
}

function ensurePmtilesProtocol() {
  if (pmtilesProtocol) return;
  pmtilesProtocol = new Protocol();
  maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile);
}

function contextArchiveUrl() {
  return `pmtiles://${new URL("./data/context-layers.pmtiles", window.location.href).toString()}`;
}

function addInteractiveCursor(map: MapLibreMap, layerId: string) {
  map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
}

export function OperationalGeovisorMap({
  departments,
  municipalities,
  departmentNames,
  municipalityNames,
  points,
  dates,
  sources,
  departmentCode,
  municipalityCode,
  onDepartment,
  onMunicipality,
}: {
  departments: FeatureCollection;
  municipalities: FeatureCollection;
  departmentNames: TerritoryNames;
  municipalityNames: TerritoryNames;
  points: PointRow[];
  dates: string[];
  sources: string[];
  departmentCode: string;
  municipalityCode: string;
  onDepartment: (code: string) => void;
  onMunicipality: (code: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacksRef = useRef({ onDepartment, onMunicipality });
  const selectionRef = useRef({ departmentCode, municipalityCode });
  const queryModeRef = useRef<QueryMode>("territory");
  const layerStateRef = useRef<LayerState>(INITIAL_LAYERS);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS);
  const [queryMode, setQueryMode] = useState<QueryMode>("territory");
  const [landCoverOpacity, setLandCoverOpacity] = useState(DEFAULT_LAND_COVER_OPACITY);
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] = useState<number | null>(null);
  const episodeData = useMemo(() => episodeGeoJson(points), [points]);
  const detectionData = useMemo(() => hotspotGeoJson(points, dates, sources, focusedEpisodeIndex), [points, dates, sources, focusedEpisodeIndex]);
  const departmentLabelData = useMemo(() => territoryLabels(departments.features, departmentNames, "DPTO_CCDGO"), [departments.features, departmentNames]);
  const municipalityLabelData = useMemo(() => territoryLabels(municipalities.features, municipalityNames, "m", "d"), [municipalities.features, municipalityNames]);
  const episodeDataRef = useRef(episodeData);
  const detectionDataRef = useRef(detectionData);

  useEffect(() => {
    callbacksRef.current = { onDepartment, onMunicipality };
    selectionRef.current = { departmentCode, municipalityCode };
    queryModeRef.current = queryMode;
    layerStateRef.current = layers;
    episodeDataRef.current = episodeData;
    detectionDataRef.current = detectionData;
  }, [onDepartment, onMunicipality, departmentCode, municipalityCode, queryMode, layers, episodeData, detectionData]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2")) {
      queueMicrotask(() => setMapError("Este navegador no ofrece WebGL2. Usa «Mapa básico» para consultar límites y detecciones."));
      return;
    }
    try {
      ensurePmtilesProtocol();
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#edf2ed" } }] },
        bounds: COLOMBIA_BOUNDS,
        fitBoundsOptions: { padding: 28 },
        maxBounds: [[-85, -7], [-63.5, 17]],
        minZoom: 3,
        maxZoom: 16,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

      map.on("error", (event) => {
        const message = event.error?.message ?? "";
        if (message.includes("context-layers.pmtiles")) setMapError("Las capas RUNAP, ANM, ANLA y ANH no respondieron; el resto del geovisor sigue disponible.");
        else if (message.includes("MNCT_2024") || message.includes("VectorTileServer")) setMapError("La capa remota de coberturas IDEAM no respondió; el resto del geovisor sigue disponible.");
      });

      map.on("load", () => {
        map.addSource(IDEAM_SOURCE_ID, { type: "vector", tiles: [IDEAM_TILE_URL], minzoom: 0, maxzoom: 23, attribution: "IDEAM · Mapa Nacional de las Coberturas de la Tierra 2024" });
        LAND_COVER_CLASSES.forEach(([label, color], index) => map.addLayer({
          id: LAND_COVER_LAYER_IDS[index], type: "fill", source: IDEAM_SOURCE_ID, "source-layer": IDEAM_SOURCE_LAYER,
          filter: ["==", "_symbol", index], paint: { "fill-color": color, "fill-opacity": DEFAULT_LAND_COVER_OPACITY }, metadata: { label },
        }));

        map.addSource(CONTEXT_SOURCE_ID, { type: "vector", url: contextArchiveUrl(), attribution: "PNN · ANM · ANLA · ANH" });
        map.addLayer({ id: "runap-fill", type: "fill", source: CONTEXT_SOURCE_ID, "source-layer": "runap", layout: { visibility: "none" }, paint: { "fill-color": "#26854d", "fill-opacity": 0.24 } });
        map.addLayer({ id: "runap-line", type: "line", source: CONTEXT_SOURCE_ID, "source-layer": "runap", layout: { visibility: "none" }, paint: { "line-color": "#176338", "line-width": 1.2, "line-opacity": 0.9 } });
        map.addLayer({ id: "anh-fill", type: "fill", source: CONTEXT_SOURCE_ID, "source-layer": "anh", layout: { visibility: "none" }, paint: { "fill-color": "#d28a1b", "fill-opacity": 0.2 } });
        map.addLayer({ id: "anh-line", type: "line", source: CONTEXT_SOURCE_ID, "source-layer": "anh", layout: { visibility: "none" }, paint: { "line-color": "#9a5d08", "line-width": 1.25, "line-opacity": 0.92 } });
        map.addLayer({ id: "anm-fill", type: "fill", source: CONTEXT_SOURCE_ID, "source-layer": "anm", layout: { visibility: "none" }, paint: { "fill-color": "#8a47b8", "fill-opacity": 0.18 } });
        map.addLayer({ id: "anm-line", type: "line", source: CONTEXT_SOURCE_ID, "source-layer": "anm", layout: { visibility: "none" }, paint: { "line-color": "#6b2d96", "line-width": 1.05, "line-opacity": 0.9 } });
        map.addLayer({ id: "anla-fill", type: "fill", source: CONTEXT_SOURCE_ID, "source-layer": "anla", filter: ["==", ["geometry-type"], "Polygon"], layout: { visibility: "none" }, paint: { "fill-color": ["match", ["get", "situacion"], "evaluacion", "#22a6b3", "#2e69c9"], "fill-opacity": 0.2 } });
        map.addLayer({ id: "anla-line", type: "line", source: CONTEXT_SOURCE_ID, "source-layer": "anla", filter: ["==", ["geometry-type"], "LineString"], layout: { visibility: "none" }, paint: { "line-color": ["match", ["get", "situacion"], "evaluacion", "#17808b", "#1f4f9f"], "line-width": 1.4, "line-opacity": 0.9 } });
        map.addLayer({ id: "anla-point", type: "circle", source: CONTEXT_SOURCE_ID, "source-layer": "anla", filter: ["==", ["geometry-type"], "Point"], layout: { visibility: "none" }, paint: { "circle-color": "#2e69c9", "circle-radius": 4.5, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });

        map.addSource("dane-departments", { type: "geojson", data: departments as GeoJSON.FeatureCollection });
        map.addLayer({ id: "dane-departments-fill", type: "fill", source: "dane-departments", paint: { "fill-color": "#d4e3d6", "fill-opacity": 0.035 } });
        map.addLayer({ id: "dane-departments-line", type: "line", source: "dane-departments", paint: { "line-color": "#476653", "line-width": 1.1, "line-opacity": 0.8 } });
        map.addSource("dane-municipalities", { type: "geojson", data: municipalities as GeoJSON.FeatureCollection });
        map.addLayer({ id: "dane-municipalities-fill", type: "fill", source: "dane-municipalities", filter: ["==", ["get", "d"], "__none__"], paint: { "fill-color": "#ecf3ed", "fill-opacity": 0.025 } });
        map.addLayer({ id: "dane-municipalities-line", type: "line", source: "dane-municipalities", filter: ["==", ["get", "d"], "__none__"], paint: { "line-color": "#789184", "line-width": 0.7, "line-opacity": 0.7 } });
        map.addSource("dane-department-label-points", { type: "geojson", data: departmentLabelData });
        map.addLayer({
          id: DEPARTMENT_LABEL_LAYER_ID, type: "symbol", source: "dane-department-label-points", maxzoom: NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM,
          layout: { "text-field": ["get", "name"], "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10.5, 5, 13, 7.6, 15.25], "text-transform": "uppercase", "text-letter-spacing": 0.04, "text-max-width": 10, "text-padding": 4, "text-allow-overlap": false },
          paint: { "text-color": "#173a28", "text-halo-color": "rgba(255,255,255,.96)", "text-halo-width": 2.2, "text-halo-blur": 0.35 },
        });
        map.addSource("dane-municipality-label-points", { type: "geojson", data: municipalityLabelData });
        map.addLayer({
          id: MUNICIPALITY_LABEL_LAYER_ID, type: "symbol", source: "dane-municipality-label-points", minzoom: NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM, maxzoom: MUNICIPALITY_LABEL_MAX_ZOOM,
          layout: { "text-field": ["get", "name"], "text-size": ["interpolate", ["linear"], ["zoom"], 6.35, 9.25, 8, 10.5, 10, 12, 12, 13.2], "text-variable-anchor": ["center", "top", "bottom", "left", "right"], "text-justify": "auto", "text-radial-offset": 0.2, "text-max-width": 8.5, "text-padding": 5, "text-allow-overlap": false },
          paint: { "text-color": "#28483a", "text-halo-color": "rgba(255,255,255,.96)", "text-halo-width": 1.8, "text-halo-blur": 0.3 },
        });

        map.addSource("episodes", { type: "geojson", data: episodeDataRef.current });
        map.addLayer({
          id: "episode-points", type: "circle", source: "episodes",
          paint: {
            "circle-color": ["case", ["get", "chained"], "#8f2323", ["step", ["get", "size"], "#ef9a45", 10, "#e45e31", 30, "#c73524"]],
            "circle-radius": ["interpolate", ["linear"], ["sqrt", ["max", 3, ["get", "size"]]], 1.7, 5, 5, 12, 12, 20],
            "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.4, "circle-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "episode-count", type: "symbol", source: "episodes", minzoom: 7.5,
          layout: { "text-field": ["to-string", ["get", "size"]], "text-size": 9, "text-allow-overlap": false },
          paint: { "text-color": "#ffffff", "text-halo-color": "#8a2d21", "text-halo-width": 0.7 },
        });

        map.addSource("detections", { type: "geojson", data: detectionDataRef.current });
        map.addLayer({
          id: "detection-points", type: "circle", source: "detections", layout: { visibility: "none" },
          paint: { "circle-color": "#202b27", "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2, 10, 4.4], "circle-stroke-color": "#ffffff", "circle-stroke-width": 0.8, "circle-opacity": 0.72 },
        });

        map.on("click", "episode-points", (event) => {
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          new maplibregl.Popup({ offset: 12, closeButton: true })
            .setLngLat(feature.geometry.coordinates as [number, number])
            .setDOMContent(episodePopup(feature, (index) => {
              setFocusedEpisodeIndex(index);
              setLayers((current) => ({ ...current, detections: true }));
            }))
            .addTo(map);
        });
        map.on("click", "detection-points", (event) => {
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          new maplibregl.Popup({ offset: 9, closeButton: true }).setLngLat(feature.geometry.coordinates as [number, number]).setDOMContent(hotspotPopup(feature)).addTo(map);
        });
        map.on("click", (event) => {
          const principal = map.queryRenderedFeatures(event.point, { layers: ["episode-points", "detection-points"] });
          if (principal.length) return;
          if (queryModeRef.current === "coverage" && layerStateRef.current.landCover) {
            const feature = map.queryRenderedFeatures(event.point, { layers: LAND_COVER_LAYER_IDS })[0];
            if (!feature) return;
            new maplibregl.Popup({ offset: 8, closeButton: true }).setLngLat(event.lngLat).setDOMContent(landCoverPopup(feature)).addTo(map);
            return;
          }
          if (queryModeRef.current === "context") {
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
          if (queryModeRef.current !== "territory" || !layerStateRef.current.boundaries) return;
          if (selectionRef.current.departmentCode !== "00") {
            const municipality = map.queryRenderedFeatures(event.point, { layers: ["dane-municipalities-fill"] })[0];
            const code = String(municipality?.properties.m ?? "");
            if (code) callbacksRef.current.onMunicipality(code);
            return;
          }
          const department = map.queryRenderedFeatures(event.point, { layers: ["dane-departments-fill"] })[0];
          const code = String(department?.properties.DPTO_CCDGO ?? "");
          if (code) callbacksRef.current.onDepartment(code);
        });

        ["episode-points", "detection-points", "dane-departments-fill", "dane-municipalities-fill", ...LAND_COVER_LAYER_IDS, ...CONTEXT_LAYER_IDS].forEach((id) => addInteractiveCursor(map, id));
        setReady(true);
      });
    } catch (error) {
      queueMicrotask(() => setMapError(error instanceof Error ? error.message : "El navegador no pudo iniciar el geovisor."));
    }
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, [departments, municipalities, departmentLabelData, municipalityLabelData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource("episodes") as GeoJSONSource | undefined)?.setData(episodeData);
  }, [episodeData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource("detections") as GeoJSONSource | undefined)?.setData(detectionData);
  }, [detectionData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    map.setFilter("dane-municipalities-fill", ["==", ["get", "d"], departmentCode]);
    map.setFilter("dane-municipalities-line", ["==", ["get", "d"], departmentCode]);
    const hasDepartmentSelection = departmentCode !== "00";
    map.setFilter(MUNICIPALITY_LABEL_LAYER_ID, hasDepartmentSelection ? ["==", ["get", "departmentCode"], departmentCode] : null);
    map.setLayerZoomRange(DEPARTMENT_LABEL_LAYER_ID, 3, hasDepartmentSelection ? SELECTED_DEPARTMENT_LABEL_MAX_ZOOM : NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM);
    map.setLayerZoomRange(MUNICIPALITY_LABEL_LAYER_ID, hasDepartmentSelection ? SELECTED_MUNICIPALITY_LABEL_MIN_ZOOM : NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM, MUNICIPALITY_LABEL_MAX_ZOOM);
    map.setPaintProperty("dane-departments-fill", "fill-color", ["case", ["==", ["get", "DPTO_CCDGO"], departmentCode], "#2f7d4c", "#d4e3d6"]);
    map.setPaintProperty("dane-departments-fill", "fill-opacity", ["case", ["==", ["get", "DPTO_CCDGO"], departmentCode], 0.25, 0.035]);
    map.setPaintProperty("dane-municipalities-fill", "fill-color", ["case", ["==", ["get", "m"], municipalityCode], "#215b39", "#ecf3ed"]);
    map.setPaintProperty("dane-municipalities-fill", "fill-opacity", ["case", ["==", ["get", "m"], municipalityCode], 0.3, 0.025]);
    const target = municipalityCode !== "00000"
      ? municipalities.features.filter((feature) => feature.properties.m === municipalityCode)
      : departmentCode !== "00"
        ? departments.features.filter((feature) => feature.properties.DPTO_CCDGO === departmentCode)
        : departments.features;
    const bounds = featureBounds(target);
    if (bounds) map.fitBounds(bounds, { padding: departmentCode === "00" ? 28 : 55, duration: 650, maxZoom: municipalityCode !== "00000" ? 12 : 9 });
  }, [departmentCode, municipalityCode, departments.features, municipalities.features, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    LAND_COVER_LAYER_IDS.forEach((id) => map.setLayoutProperty(id, "visibility", layers.landCover ? "visible" : "none"));
    ["episode-points", "episode-count"].forEach((id) => map.setLayoutProperty(id, "visibility", layers.episodes ? "visible" : "none"));
    map.setLayoutProperty("detection-points", "visibility", layers.detections ? "visible" : "none");
    ["dane-departments-fill", "dane-departments-line", "dane-municipalities-fill", "dane-municipalities-line", DEPARTMENT_LABEL_LAYER_ID, MUNICIPALITY_LABEL_LAYER_ID]
      .forEach((id) => map.setLayoutProperty(id, "visibility", layers.boundaries ? "visible" : "none"));
    (Object.keys(CONTEXT_GROUPS) as Array<keyof typeof CONTEXT_GROUPS>).forEach((key) => CONTEXT_GROUPS[key].forEach((id) => map.setLayoutProperty(id, "visibility", layers[key] ? "visible" : "none")));
  }, [layers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    LAND_COVER_LAYER_IDS.forEach((id) => map.setPaintProperty(id, "fill-opacity", landCoverOpacity));
  }, [landCoverOpacity, ready]);

  const toggleLayer = (key: keyof LayerState) => {
    const next = { ...layers, [key]: !layers[key] };
    setLayers(next);
    if (queryMode === "context" && !next.runap && !next.anm && !next.anla && !next.anh) setQueryMode("territory");
    if (queryMode === "coverage" && !next.landCover) setQueryMode("territory");
  };
  const hasVisibleContext = layers.runap || layers.anm || layers.anla || layers.anh;

  return <div className="geovisor-map" aria-label={`Geovisor operacional con ${episodeData.features.length.toLocaleString("es-CO")} episodios visibles`}>
    <div ref={containerRef} className="geovisor-canvas" />
    {!ready && !mapError && <div className="geovisor-loading"><span /> Preparando capas geográficas…</div>}
    {mapError && <div className="geovisor-error" role="status">{mapError}</div>}
    <aside className="layer-control" aria-label="Control de capas">
      <div className="layer-control-title"><Layers3 size={15} /><strong>Capas visibles</strong></div>
      <label><input type="checkbox" checked={layers.episodes} onChange={() => toggleLayer("episodes")} /><span className="layer-symbol hotspot" /> Episodios de detecciones térmicas</label>
      <label><input type="checkbox" checked={layers.detections} onChange={() => toggleLayer("detections")} /><span className="layer-symbol hotspot" style={{ filter: "grayscale(1) brightness(.55)" }} /> Detecciones individuales</label>
      {focusedEpisodeIndex !== null && <div className="query-control"><span>Detecciones enfocadas en un episodio</span><div><button type="button" onClick={() => setFocusedEpisodeIndex(null)}>Mostrar todas</button></div></div>}
      <label><input type="checkbox" checked={layers.boundaries} onChange={() => toggleLayer("boundaries")} /><span className="layer-symbol boundary" /> Límites DANE 2025</label>
      <label><input type="checkbox" checked={layers.landCover} onChange={() => toggleLayer("landCover")} /><span className="layer-symbol coverage" /> Coberturas IDEAM 2024</label>
      <label className="opacity-control"><span>Opacidad de coberturas</span><input type="range" min="0.15" max="0.85" step="0.05" value={landCoverOpacity} disabled={!layers.landCover} onChange={(event) => setLandCoverOpacity(Number(event.target.value))} /></label>
      <div className="layer-group-title">Contexto territorial</div>
      <label><input type="checkbox" checked={layers.runap} onChange={() => toggleLayer("runap")} /><span className="layer-symbol runap" /> Áreas protegidas RUNAP</label>
      <label><input type="checkbox" checked={layers.anm} onChange={() => toggleLayer("anm")} /><span className="layer-symbol anm" /> Títulos mineros ANM</label>
      <label><input type="checkbox" checked={layers.anla} onChange={() => toggleLayer("anla")} /><span className="layer-symbol anla" /> Proyectos ANLA</label>
      <label><input type="checkbox" checked={layers.anh} onChange={() => toggleLayer("anh")} /><span className="layer-symbol anh" /> Áreas asignadas ANH</label>
      <div className="query-control"><span>Consulta con clic</span><div role="group" aria-label="Capa consultada al hacer clic"><button type="button" className={queryMode === "territory" ? "active" : ""} disabled={!layers.boundaries} onClick={() => setQueryMode("territory")}>Territorio</button><button type="button" className={queryMode === "coverage" ? "active" : ""} disabled={!layers.landCover} onClick={() => setQueryMode("coverage")}>Cobertura</button><button type="button" className={queryMode === "context" ? "active" : ""} disabled={!hasVisibleContext} onClick={() => setQueryMode("context")}>Contexto</button></div></div>
      <details><summary>Leyenda de coberturas</summary><div className="coverage-legend">{FAMILY_LEGEND.map(([label, color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div></details>
      <div className="layer-group-title">Configuración operativa</div>
      <div style={{ fontSize: 9, lineHeight: 1.35, color: "#5e6c63" }}>{OPERATIONAL_SPATIAL_METERS / 1000} km · {OPERATIONAL_TEMPORAL_HOURS} h · mínimo {OPERATIONAL_MINIMUM_MEMBERS} detecciones. Un episodio es una agrupación algorítmica, no un incendio confirmado.</div>
    </aside>
  </div>;
}
