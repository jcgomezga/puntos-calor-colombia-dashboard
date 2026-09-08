"use client";

import { Layers3 } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, PointRow } from "@/components/dashboard-map";
import { loadContextDetail } from "@/components/context-detail-catalog";

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

const LAND_COVER_CLASSES = [
  ["1.1.1. Tejido urbano continuo", "#CC0000"], ["1.1.2. Tejido urbano discontinuo", "#F80000"],
  ["1.2.1. Zonas industriales o comerciales", "#CC4D2A"], ["1.2.2. Red vial, ferroviaria y terrenos asociados", "#D96545"],
  ["1.2.3. Zonas portuarias", "#E1846B"], ["1.2.4. Aeropuertos", "#E79C87"], ["1.2.5. Obras hidráulicas", "#EEB9AA"],
  ["1.3.1. Zonas de extracción minera", "#A600CC"], ["1.3.2. Zona de disposición de residuos", "#D317FF"],
  ["1.4.1. Zonas verdes urbanas", "#FF8080"], ["1.4.2. Instalaciones recreativas", "#FFAFAF"],
  ["2.1.1. Otros cultivos transitorios", "#FFFFA6"], ["2.1.2. Cereales", "#EEE800"], ["2.1.3. Oleaginosas y leguminosas", "#FFFF5F"],
  ["2.1.4. Hortalizas", "#E1D200"], ["2.1.5. Tubérculos", "#D2CD00"], ["2.2.1. Cultivos permanentes herbáceos", "#F2CCA6"],
  ["2.2.2. Cultivos permanentes arbustivos", "#F2A64D"], ["2.2.3. Cultivos permanentes arbóreos", "#E6A600"],
  ["2.2.4. Cultivos agroforestales", "#CC900A"], ["2.2.5. Cultivos confinados", "#824A12"], ["2.3.1. Pastos limpios", "#CCFFCC"],
  ["2.3.2. Pastos arbolados", "#9EFF9E"], ["2.3.3. Pastos enmalezados", "#9EFFC8"], ["2.4.1. Mosaico de cultivos", "#FFE6A6"],
  ["2.4.2. Mosaico de pastos y cultivos", "#FFD875"], ["2.4.3. Mosaico de cultivos, pastos y espacios naturales", "#FFC941"],
  ["2.4.4. Mosaico de pastos con espacios naturales", "#FEB500"], ["2.4.5. Mosaico de cultivos con espacios naturales", "#FFB03C"],
  ["3.1.1. Bosque denso", "#478F00"], ["3.1.2. Bosque abierto", "#55AB00"], ["3.1.3. Bosque fragmentado", "#61C200"],
  ["3.1.4. Bosque de galería y ripario", "#70E000"], ["3.1.5. Plantación forestal", "#80FF00"], ["3.2.1. Herbazal", "#CCF24E"],
  ["3.2.2. Arbustal", "#ACDB0F"], ["3.2.3. Vegetación secundaria o en transición", "#96BF0D"], ["3.3.1. Zonas arenosas naturales", "#C2C2C2"],
  ["3.3.2. Afloramientos rocosos", "#B3B3B3"], ["3.3.3. Tierras desnudas y degradadas", "#9E9E9E"], ["3.3.4. Zonas quemadas", "#898989"],
  ["3.3.5. Zonas glaciares y nivales", "#6565B4"], ["4.1.1. Zonas pantanosas", "#A6A6FF"], ["4.1.2. Turberas", "#4D91FF"],
  ["4.1.3. Vegetación acuática sobre cuerpos de agua", "#5050FF"], ["4.2.1. Pantanos costeros", "#CCCCFF"], ["4.2.2. Salitral", "#B7B7FF"],
  ["4.2.3. Sedimentos expuestos en bajamar", "#A6A6E6"], ["5.1.1. Ríos", "#0000F8"], ["5.1.2. Lagunas, lagos y ciénagas naturales", "#0080FF"],
  ["5.1.3. Canales", "#00B2FF"], ["5.1.4. Cuerpos de agua artificiales", "#00CEF2"], ["5.2.1. Lagunas costeras", "#45E0F5"],
  ["5.2.3. Estanques para acuicultura marina", "#CCF6FF"],
] as const;

const LAND_COVER_LAYER_IDS = LAND_COVER_CLASSES.map((_, index) => `ideam-cobertura-${index}`);
const FAMILY_LEGEND = [
  ["Territorios artificializados", "#d44832"], ["Áreas agrícolas", "#e4bd31"], ["Bosques y áreas seminaturales", "#5fa620"],
  ["Áreas húmedas", "#7e91ed"], ["Superficies de agua", "#168ddd"],
] as const;
const CONTEXT_GROUPS = {
  runap: ["runap-fill", "runap-line"], anh: ["anh-fill", "anh-line"], anm: ["anm-fill", "anm-line"],
  anla: ["anla-fill", "anla-line", "anla-point"],
} as const;
let pmtilesProtocol: Protocol | null = null;

type LayerState = { landCover: boolean; hotspots: boolean; boundaries: boolean; runap: boolean; anm: boolean; anla: boolean; anh: boolean };
type QueryMode = "territory" | "coverage" | "context";
type TerritoryNames = Record<string, string>;
const INITIAL_LAYERS: LayerState = { landCover: true, hotspots: true, boundaries: true, runap: false, anm: false, anla: false, anh: false };

function present(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text && text.toLowerCase() !== "null" ? text : "";
}
function firstProperty(properties: Record<string, unknown>, keys: string[]) {
  for (const key of keys) { const value = present(properties[key]); if (value) return value; }
  return "";
}
function humanNumber(value: unknown, suffix = "") {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString("es-CO", { maximumFractionDigits: 2 })}${suffix}` : "Sin dato";
}
function popupRow(label: string, value: string) {
  const row = document.createElement("div");
  const key = document.createElement("span");
  const content = document.createElement("strong");
  key.textContent = label; content.textContent = value; row.append(key, content); return row;
}
function relationLabel(value: unknown) {
  const code = Number(value);
  if (code === 3) return "Dentro";
  if (code === 2) return "Hasta 1 km";
  if (code === 1) return "Entre 1 y 5 km";
  return "A más de 5 km";
}
function hotspotGeoJson(points: PointRow[], dates: string[], sources: string[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return { type: "FeatureCollection", features: points.map((point, index) => ({
    type: "Feature", id: index, geometry: { type: "Point", coordinates: [point[0], point[1]] }, properties: {
      date: dates[point[4]] ?? "Sin fecha", minute: point[5], source: sources[point[6]] ?? "Fuente no identificada",
      frp: point[8], confidence: point[9], protected: point[11] === 1, mining: point[13] === 1,
      anlaRelation: point[14] ?? 0, anhRelation: point[16] ?? 0,
    },
  })) };
}
function hotspotPopup(feature: MapGeoJSONFeature) {
  const p = feature.properties as Record<string, unknown>;
  const root = document.createElement("div"); root.className = "geovisor-popup";
  const title = document.createElement("h3"); title.textContent = "Detección térmica IDEAM";
  const minute = Number(p.minute);
  const hour = Number.isFinite(minute) ? `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}` : "—";
  root.append(title, popupRow("Fecha", `${present(p.date) || "Sin fecha"} · ${hour}`), popupRow("Sensor", present(p.source) || "Sin dato"),
    popupRow("FRP", p.frp == null ? "Sin dato" : humanNumber(p.frp, " MW")), popupRow("Confianza", humanNumber(p.confidence)),
    popupRow("RUNAP", p.protected ? "Dentro" : "Fuera"), popupRow("Título ANM", p.mining ? "Dentro" : "Fuera"),
    popupRow("Proyecto ANLA", relationLabel(p.anlaRelation)), popupRow("Área ANH", relationLabel(p.anhRelation)));
  return root;
}
function landCoverPopup(feature: MapGeoJSONFeature) {
  const p = feature.properties as Record<string, unknown>; const symbol = Number(p._symbol);
  const root = document.createElement("div"); root.className = "geovisor-popup";
  const title = document.createElement("h3"); title.textContent = "Cobertura de la Tierra 2024";
  root.append(title, popupRow("Clase cartográfica", LAND_COVER_CLASSES[symbol]?.[0] ?? "Clase sin identificar"));
  for (const [label, keys] of [["Nivel 1", ["nivel_1", "NIVEL_1"]], ["Nivel 2", ["nivel_2", "NIVEL_2"]], ["Nivel 3", ["nivel_3", "NIVEL_3"]], ["Nivel 4", ["nivel_4", "NIVEL_4"]], ["Nivel 5", ["nivel_5", "NIVEL_5"]], ["Nivel 6", ["nivel_6", "NIVEL_6"]]] as const) {
    const value = firstProperty(p, [...keys]); if (value) root.append(popupRow(label, value));
  }
  const area = firstProperty(p, ["area_ha", "AREA_HA"]); if (area && Number.isFinite(Number(area))) root.append(popupRow("Área del polígono", humanNumber(area, " ha")));
  const dep = firstProperty(p, ["nom_dep", "NOM_DEP"]), mun = firstProperty(p, ["nom_mun", "NOM_MUN"]);
  if (dep || mun) root.append(popupRow("Territorio", [mun, dep].filter(Boolean).join(" · ")));
  const authority = firstProperty(p, ["nom_aua", "NOM_AUA"]); if (authority) root.append(popupRow("Autoridad ambiental", authority));
  const period = firstProperty(p, ["periodo", "PERIODO"]); if (period) root.append(popupRow("Periodo", period));
  root.append(popupRow("Fuente", "IDEAM · Mapa Nacional de Coberturas de la Tierra 2024 · escala 1:100.000")); return root;
}
function contextPopup(feature: MapGeoJSONFeature, details: Record<string, unknown> | null = null, status: "loading" | "ready" | "error" = "ready") {
  const p = { ...(feature.properties as Record<string, unknown>), ...(details ?? {}) }; const sourceLayer = feature.sourceLayer;
  const root = document.createElement("div"); root.className = "geovisor-popup"; root.style.maxHeight = "380px"; root.style.overflowY = "auto";
  const title = document.createElement("h3"); const rows: HTMLElement[] = [];
  const add = (label: string, value: unknown) => { const text = present(value); if (text) rows.push(popupRow(label, text)); };
  if (sourceLayer === "runap") {
    title.textContent = "Ficha RUNAP"; if (feature.id != null) rows.push(popupRow("ID", String(feature.id)));
    add("Nombre", p.nombre); add("Categoría", p.categoria); add("Condición", p.condicion); add("Administración", p.organizacion);
    rows.push(popupRow("Lectura", "Coincidencia espacial; no implica causalidad"));
  } else if (sourceLayer === "anm") {
    title.textContent = "Ficha de título minero ANM"; add("Expediente", p.codigo); add("Titular / solicitante", p.solicitante); add("Minerales", p.minerales);
    add("Etapa", p.etapa); add("Estado", p.estado); add("Modalidad", p.modalidad); add("Tipo de explotación", p.tipo); add("Municipios", p.municipios); add("Departamento", p.departamento);
    if (p.area_ha != null && Number.isFinite(Number(p.area_ha))) rows.push(popupRow("Área", humanNumber(p.area_ha, " ha")));
    add("Fecha de inscripción", p.fecha_inscripcion); add("Fecha de terminación", p.fecha_terminacion); rows.push(popupRow("Lectura", "Intersección espacial; no implica origen del fuego"));
  } else if (sourceLayer === "anla") {
    title.textContent = "Ficha de proyecto ANLA"; add("Expediente", p.expediente); add("Proyecto", p.proyecto); add("Operador", p.operador); add("Sector", p.sector);
    add("Situación", p.situacion === "evaluacion" ? "En evaluación" : p.situacion === "licenciado" ? "Licenciado" : p.situacion); add("Estado", p.estado); add("Geometría", p.geometria);
    add("Acto administrativo", p.acto_administrativo); add("Fecha del acto", p.fecha_acto); add("Artículo", p.articulo_acto); add("Contrato", p.contrato); add("Tipo de infraestructura", p.tipo_infraestructura);
    if (p.area_ha != null && Number.isFinite(Number(p.area_ha))) rows.push(popupRow("Área", humanNumber(p.area_ha, " ha")));
    if (p.longitud_m != null && Number.isFinite(Number(p.longitud_m))) rows.push(popupRow("Longitud", humanNumber(p.longitud_m, " m")));
    add("Descripción", p.descripcion); add("Nomenclatura", p.nomenclatura); add("Observación", p.observacion); rows.push(popupRow("Lectura", "Coincidencia/proximidad espacial; no implica causalidad"));
  } else {
    title.textContent = "Ficha de área contractual ANH"; add("ID contractual", p.contrato_id); add("Contrato", p.contrato); add("Área / bloque", p.area); add("Operador", p.operador); add("Operador abreviado", p.operador_abrev);
    add("Estado", p.estado); add("Clasificación", p.clasificacion); add("Tipo de contrato", p.tipo); add("Subtipo", p.subtipo); add("Fecha de firma", p.fecha_firma); add("Cuenca", p.cuenca);
    if (p.area_ha != null && Number.isFinite(Number(p.area_ha))) rows.push(popupRow("Área", humanNumber(p.area_ha, " ha")));
    add("Superficie", p.superficie); add("Yacimiento", p.yacimiento); add("Proceso", p.proceso); add("Leyenda", p.leyenda); add("ID GECOH", p.id_gecoh); add("Minuta oficial", p.url_minuta);
    rows.push(popupRow("Lectura", "Coincidencia/proximidad espacial; no implica causalidad"));
  }
  if (status === "loading") rows.push(popupRow("Detalle", "Cargando ficha completa…"));
  if (status === "error") rows.push(popupRow("Detalle", "No fue posible cargar los atributos ampliados; se muestran los datos disponibles en la tesela."));
  root.append(title, ...rows); return root;
}
function geometryCoordinates(feature: FeatureCollection["features"][number]): number[][][] {
  if (feature.geometry.type === "Polygon") return feature.geometry.coordinates as number[][][];
  return (feature.geometry.coordinates as number[][][][]).map((polygon) => polygon[0]).filter(Boolean);
}
function labelPoint(feature: FeatureCollection["features"][number]) {
  let best: [number, number] | null = null, bestSpan = -1;
  for (const ring of geometryCoordinates(feature)) { if (!ring?.length) continue; const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), span = (maxX - minX) * (maxY - minY);
    if (span > bestSpan) { bestSpan = span; best = [(minX + maxX) / 2, (minY + maxY) / 2]; } }
  return best;
}
function territoryLabels(features: FeatureCollection["features"], names: TerritoryNames, codeProperty: string, departmentProperty?: string): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return { type: "FeatureCollection", features: features.flatMap((feature) => { const code = String(feature.properties[codeProperty] ?? ""), point = labelPoint(feature);
    if (!code || !point || !names[code]) return []; return [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: point }, properties: { code, name: names[code], ...(departmentProperty ? { departmentCode: String(feature.properties[departmentProperty] ?? "") } : {}) } }]; }) };
}
function featureBounds(features: FeatureCollection["features"]): maplibregl.LngLatBoundsLike | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (value: unknown) => { if (!Array.isArray(value)) return; if (typeof value[0] === "number" && typeof value[1] === "number") { minX = Math.min(minX, value[0]); minY = Math.min(minY, value[1]); maxX = Math.max(maxX, value[0]); maxY = Math.max(maxY, value[1]); return; } value.forEach(visit); };
  features.forEach((feature) => visit(feature.geometry.coordinates)); return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}
function ensurePmtilesProtocol() { if (!pmtilesProtocol) { pmtilesProtocol = new Protocol(); maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile); } }
function contextArchiveUrl() { return `pmtiles://${new URL("./data/context-layers.pmtiles", window.location.href).toString()}`; }
function addInteractiveCursor(map: MapLibreMap, layerId: string) { map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; }); map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; }); }
function visibleContextLayerIds(state: LayerState) {
  return (Object.keys(CONTEXT_GROUPS) as Array<keyof typeof CONTEXT_GROUPS>).flatMap((key) => state[key] ? [...CONTEXT_GROUPS[key]] : []);
}

export function PublicDetectionGeovisorMap({ departments, municipalities, departmentNames, municipalityNames, points, dates, sources, departmentCode, municipalityCode, onDepartment, onMunicipality }: {
  departments: FeatureCollection; municipalities: FeatureCollection; departmentNames: TerritoryNames; municipalityNames: TerritoryNames;
  points: PointRow[]; dates: string[]; sources: string[]; departmentCode: string; municipalityCode: string; onDepartment: (code: string) => void; onMunicipality: (code: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null), mapRef = useRef<MapLibreMap | null>(null);
  const callbacksRef = useRef({ onDepartment, onMunicipality }), selectionRef = useRef({ departmentCode, municipalityCode });
  const queryModeRef = useRef<QueryMode>("territory"), layerStateRef = useRef<LayerState>(INITIAL_LAYERS);
  const [ready, setReady] = useState(false), [mapError, setMapError] = useState("");
  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS), [queryMode, setQueryMode] = useState<QueryMode>("territory");
  const [landCoverOpacity, setLandCoverOpacity] = useState(DEFAULT_LAND_COVER_OPACITY);
  const hotspotData = useMemo(() => hotspotGeoJson(points, dates, sources), [points, dates, sources]);
  const departmentLabelData = useMemo(() => territoryLabels(departments.features, departmentNames, "DPTO_CCDGO"), [departments.features, departmentNames]);
  const municipalityLabelData = useMemo(() => territoryLabels(municipalities.features, municipalityNames, "m", "d"), [municipalities.features, municipalityNames]);
  const hotspotDataRef = useRef(hotspotData);

  useEffect(() => { hotspotDataRef.current = hotspotData; callbacksRef.current = { onDepartment, onMunicipality }; selectionRef.current = { departmentCode, municipalityCode }; queryModeRef.current = queryMode; layerStateRef.current = layers; }, [hotspotData, onDepartment, onMunicipality, departmentCode, municipalityCode, queryMode, layers]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2")) { queueMicrotask(() => setMapError("Este navegador no ofrece WebGL2. Usa «Mapa básico» para consultar límites y detecciones.")); return; }
    try {
      ensurePmtilesProtocol();
      const map = new maplibregl.Map({ container: containerRef.current, style: { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#edf2ed" } }] }, bounds: COLOMBIA_BOUNDS, fitBoundsOptions: { padding: 28 }, maxBounds: [[-85, -7], [-63.5, 17]], minZoom: 3, maxZoom: 16, attributionControl: false });
      mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left"); map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right"); map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
      map.on("error", (event) => { const message = event.error?.message ?? ""; if (message.includes("context-layers.pmtiles")) setMapError("Las capas RUNAP, ANM, ANLA y ANH no respondieron; el resto del geovisor sigue disponible."); else if (message.includes("MNCT_2024") || message.includes("VectorTileServer")) setMapError("La capa remota de coberturas IDEAM no respondió; el resto del geovisor sigue disponible."); });
      map.on("load", () => {
        map.addSource(IDEAM_SOURCE_ID, { type: "vector", tiles: [IDEAM_TILE_URL], minzoom: 0, maxzoom: 23, attribution: "IDEAM · Mapa Nacional de las Coberturas de la Tierra 2024" });
        LAND_COVER_CLASSES.forEach(([label, color], index) => map.addLayer({ id: LAND_COVER_LAYER_IDS[index], type: "fill", source: IDEAM_SOURCE_ID, "source-layer": IDEAM_SOURCE_LAYER, filter: ["==", "_symbol", index], paint: { "fill-color": color, "fill-opacity": DEFAULT_LAND_COVER_OPACITY }, metadata: { label } }));
        map.addSource(CONTEXT_SOURCE_ID, { type: "vector", url: contextArchiveUrl(), attribution: "PNN · ANM · ANLA · ANH" });
        map.addLayer({ id: "runap-fill", type: "fill", source: CONTEXT_SOURCE_ID, "source-layer": "runap", layout: { visibility: "none" }, paint: { "fill-color": "#26854d", "fill-opacity": 0.24 } });
        map.addLayer({ id: "runap-line", type: "line", source: CONTEXT_SOURCE_ID, "source-layer": "runap", layout: { visibility: "none" }, paint: { "line-color": "#176338", "line-width": 1.2, "line-opacity": 0.9 } });
        map.addLayer({ id: "anh-fill", type: "fill", source: CONTEXT_SOURCE_ID, "source-layer": "anh", layout: { visibility: "none" }, paint: { "fill-color": "#d28a1b", "fill-opacity": 0.2 } });
        map.addLayer({ id: "anh-line", type: "line", source: CONTEXT_SOURCE_ID, "source-layer": "anh", layout: { visibility: "none" }, paint: { "line-color": "#9a5d08", "line-width": 1.25, "line-opacity": 0.92 } });
        map.addLayer({ id: "anm-fill", type: "fill", source: CONTEXT_SOURCE_ID, "source-layer": "anm", layout: { visibility: "none" }, paint: { "fill-color": "#8a47b8", "fill-opacity": 0.18 } });
        map.addLayer({ id: "anm-line", type: "line", source: CONTEXT_SOURCE_ID, "source-layer": "anm", layout: { visibility: "none" }, paint: { "line-color": "#6b2d96", "line-width": 1.05, "line-opacity": 0.9 } });
        map.addLayer({ id: "anla-fill", type: "fill", source: CONTEXT_SOURCE_ID, "source-layer": "anla", filter: ["==", ["geometry-type"], "Polygon"], layout: { visibility: "none" }, paint: { "fill-color": ["match", ["get", "situacion"], "evaluacion", "#22a6b3", "#2e69c9"], "fill-opacity": 0.2 } });
        map.addLayer({ id: "anla-line", type: "line", source: CONTEXT_SOURCE_ID, "source-layer": "anla", filter: ["==", ["geometry-type"], "LineString"], layout: { visibility: "none" }, paint: { "line-color": ["match", ["get", "situacion"], "evaluacion", "#17808b", "#1f4f9f"], "line-width": 1.4, "line-opacity": 0.9 } });
        map.addLayer({ id: "anla-point", type: "circle", source: CONTEXT_SOURCE_ID, "source-layer": "anla", filter: ["==", ["geometry-type"], "Point"], layout: { visibility: "none" }, paint: { "circle-color": "#2e69c9", "circle-radius": 4.5, "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
        map.addSource("dane-departments", { type: "geojson", data: departments as GeoJSON.FeatureCollection });
        map.addLayer({ id: "dane-departments-fill", type: "fill", source: "dane-departments", paint: { "fill-color": "#d4e3d6", "fill-opacity": 0.035 } });
        map.addLayer({ id: "dane-departments-line", type: "line", source: "dane-departments", paint: { "line-color": "#476653", "line-width": 1.1, "line-opacity": 0.8 } });
        map.addSource("dane-municipalities", { type: "geojson", data: municipalities as GeoJSON.FeatureCollection });
        map.addLayer({ id: "dane-municipalities-fill", type: "fill", source: "dane-municipalities", filter: ["==", ["get", "d"], "__none__"], paint: { "fill-color": "#ecf3ed", "fill-opacity": 0.025 } });
        map.addLayer({ id: "dane-municipalities-line", type: "line", source: "dane-municipalities", filter: ["==", ["get", "d"], "__none__"], paint: { "line-color": "#789184", "line-width": 0.7, "line-opacity": 0.7 } });
        map.addSource("dane-department-label-points", { type: "geojson", data: departmentLabelData });
        map.addLayer({ id: DEPARTMENT_LABEL_LAYER_ID, type: "symbol", source: "dane-department-label-points", maxzoom: NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM, layout: { "text-field": ["get", "name"], "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10.5, 5, 13, 7.6, 15.25], "text-transform": "uppercase", "text-letter-spacing": 0.04, "text-max-width": 10, "text-padding": 4, "text-allow-overlap": false }, paint: { "text-color": "#173a28", "text-halo-color": "rgba(255,255,255,.96)", "text-halo-width": 2.2, "text-halo-blur": 0.35 } });
        map.addSource("dane-municipality-label-points", { type: "geojson", data: municipalityLabelData });
        map.addLayer({ id: MUNICIPALITY_LABEL_LAYER_ID, type: "symbol", source: "dane-municipality-label-points", minzoom: NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM, maxzoom: MUNICIPALITY_LABEL_MAX_ZOOM, layout: { "text-field": ["get", "name"], "text-size": ["interpolate", ["linear"], ["zoom"], 6.35, 9.25, 8, 10.5, 10, 12, 12, 13.2], "text-variable-anchor": ["center", "top", "bottom", "left", "right"], "text-justify": "auto", "text-radial-offset": 0.2, "text-max-width": 8.5, "text-padding": 5, "text-allow-overlap": false }, paint: { "text-color": "#28483a", "text-halo-color": "rgba(255,255,255,.96)", "text-halo-width": 1.8, "text-halo-blur": 0.3 } });
        map.addSource("hotspots", { type: "geojson", data: hotspotDataRef.current, cluster: true, clusterMaxZoom: 9, clusterRadius: 42 });
        map.addLayer({ id: "hotspot-clusters", type: "circle", source: "hotspots", filter: ["has", "point_count"], paint: { "circle-color": ["step", ["get", "point_count"], "#f39a53", 100, "#e56235", 1000, "#ba2f25"], "circle-radius": ["step", ["get", "point_count"], 15, 100, 20, 1000, 26], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5, "circle-opacity": 0.9 } });
        map.addLayer({ id: "hotspot-cluster-count", type: "symbol", source: "hotspots", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 }, paint: { "text-color": "#fff" } });
        map.addLayer({ id: "hotspot-unclustered", type: "circle", source: "hotspots", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#d93f2b", "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.2, 10, 6.2], "circle-stroke-color": "#fff", "circle-stroke-width": 1, "circle-opacity": 0.86 } });
        map.on("click", "hotspot-clusters", async (event) => { const cluster = event.features?.[0]; if (!cluster || cluster.geometry.type !== "Point") return; const source = map.getSource("hotspots") as GeoJSONSource; const zoom = await source.getClusterExpansionZoom(Number(cluster.properties.cluster_id)); map.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom }); });
        map.on("click", "hotspot-unclustered", (event) => { const feature = event.features?.[0]; if (!feature || feature.geometry.type !== "Point") return; new maplibregl.Popup({ offset: 10, closeButton: true }).setLngLat(feature.geometry.coordinates as [number, number]).setDOMContent(hotspotPopup(feature)).addTo(map); });
        map.on("click", (event) => {
          if (map.queryRenderedFeatures(event.point, { layers: ["hotspot-clusters", "hotspot-unclustered"] }).length) return;
          if (queryModeRef.current === "coverage" && layerStateRef.current.landCover) { const feature = map.queryRenderedFeatures(event.point, { layers: LAND_COVER_LAYER_IDS })[0]; if (!feature) return; new maplibregl.Popup({ offset: 8, closeButton: true }).setLngLat(event.lngLat).setDOMContent(landCoverPopup(feature)).addTo(map); return; }
          if (queryModeRef.current === "context") {
            const contextLayers = visibleContextLayerIds(layerStateRef.current); const feature = contextLayers.length ? map.queryRenderedFeatures(event.point, { layers: contextLayers })[0] : undefined; if (!feature) return;
            const detailKey = present((feature.properties as Record<string, unknown>).detail_key);
            const popup = new maplibregl.Popup({ offset: 8, closeButton: true }).setLngLat(event.lngLat).setDOMContent(contextPopup(feature, null, detailKey ? "loading" : "ready")).addTo(map);
            if (detailKey) void loadContextDetail(detailKey).then((details) => { if (popup.isOpen()) popup.setDOMContent(contextPopup(feature, details, "ready")); }).catch(() => { if (popup.isOpen()) popup.setDOMContent(contextPopup(feature, null, "error")); });
            return;
          }
          if (queryModeRef.current !== "territory" || !layerStateRef.current.boundaries) return;
          if (selectionRef.current.departmentCode !== "00") { const municipality = map.queryRenderedFeatures(event.point, { layers: ["dane-municipalities-fill"] })[0]; const code = String(municipality?.properties.m ?? ""); if (code) callbacksRef.current.onMunicipality(code); return; }
          const department = map.queryRenderedFeatures(event.point, { layers: ["dane-departments-fill"] })[0]; const code = String(department?.properties.DPTO_CCDGO ?? ""); if (code) callbacksRef.current.onDepartment(code);
        });
        ["hotspot-clusters", "hotspot-unclustered", "dane-departments-fill", "dane-municipalities-fill", ...LAND_COVER_LAYER_IDS, ...Object.values(CONTEXT_GROUPS).flat()].forEach((id) => addInteractiveCursor(map, id)); setReady(true);
      });
    } catch (error) { queueMicrotask(() => setMapError(error instanceof Error ? error.message : "El navegador no pudo iniciar el geovisor.")); }
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, [departments, municipalities, departmentLabelData, municipalityLabelData]);

  useEffect(() => { const map = mapRef.current; if (map?.isStyleLoaded()) (map.getSource("hotspots") as GeoJSONSource | undefined)?.setData(hotspotData); }, [hotspotData]);
  useEffect(() => {
    const map = mapRef.current; if (!map?.isStyleLoaded()) return;
    map.setFilter("dane-municipalities-fill", ["==", ["get", "d"], departmentCode]); map.setFilter("dane-municipalities-line", ["==", ["get", "d"], departmentCode]);
    const selected = departmentCode !== "00"; map.setFilter(MUNICIPALITY_LABEL_LAYER_ID, selected ? ["==", ["get", "departmentCode"], departmentCode] : null);
    map.setLayerZoomRange(DEPARTMENT_LABEL_LAYER_ID, 3, selected ? SELECTED_DEPARTMENT_LABEL_MAX_ZOOM : NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM); map.setLayerZoomRange(MUNICIPALITY_LABEL_LAYER_ID, selected ? SELECTED_MUNICIPALITY_LABEL_MIN_ZOOM : NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM, MUNICIPALITY_LABEL_MAX_ZOOM);
    map.setPaintProperty("dane-departments-fill", "fill-color", ["case", ["==", ["get", "DPTO_CCDGO"], departmentCode], "#2f7d4c", "#d4e3d6"]); map.setPaintProperty("dane-departments-fill", "fill-opacity", ["case", ["==", ["get", "DPTO_CCDGO"], departmentCode], 0.25, 0.035]);
    map.setPaintProperty("dane-municipalities-fill", "fill-color", ["case", ["==", ["get", "m"], municipalityCode], "#215b39", "#ecf3ed"]); map.setPaintProperty("dane-municipalities-fill", "fill-opacity", ["case", ["==", ["get", "m"], municipalityCode], 0.3, 0.025]);
    const target = municipalityCode !== "00000" ? municipalities.features.filter((f) => f.properties.m === municipalityCode) : departmentCode !== "00" ? departments.features.filter((f) => f.properties.DPTO_CCDGO === departmentCode) : departments.features;
    const bounds = featureBounds(target); if (bounds) map.fitBounds(bounds, { padding: departmentCode === "00" ? 28 : 55, duration: 650, maxZoom: municipalityCode !== "00000" ? 12 : 9 });
  }, [departmentCode, municipalityCode, departments.features, municipalities.features, ready]);
  useEffect(() => {
    const map = mapRef.current; if (!map?.isStyleLoaded()) return;
    LAND_COVER_LAYER_IDS.forEach((id) => map.setLayoutProperty(id, "visibility", layers.landCover ? "visible" : "none")); ["hotspot-clusters", "hotspot-cluster-count", "hotspot-unclustered"].forEach((id) => map.setLayoutProperty(id, "visibility", layers.hotspots ? "visible" : "none"));
    ["dane-departments-fill", "dane-departments-line", "dane-municipalities-fill", "dane-municipalities-line", DEPARTMENT_LABEL_LAYER_ID, MUNICIPALITY_LABEL_LAYER_ID].forEach((id) => map.setLayoutProperty(id, "visibility", layers.boundaries ? "visible" : "none"));
    (Object.keys(CONTEXT_GROUPS) as Array<keyof typeof CONTEXT_GROUPS>).forEach((key) => CONTEXT_GROUPS[key].forEach((id) => map.setLayoutProperty(id, "visibility", layers[key] ? "visible" : "none")));
  }, [layers, ready]);
  useEffect(() => { const map = mapRef.current; if (map?.isStyleLoaded()) LAND_COVER_LAYER_IDS.forEach((id) => map.setPaintProperty(id, "fill-opacity", landCoverOpacity)); }, [landCoverOpacity, ready]);

  const toggleLayer = (key: keyof LayerState) => {
    const next = { ...layers, [key]: !layers[key] }; setLayers(next);
    if ((key === "runap" || key === "anm" || key === "anla" || key === "anh") && next[key]) setQueryMode("context");
    if (queryMode === "context" && !next.runap && !next.anm && !next.anla && !next.anh) setQueryMode("territory");
    if (queryMode === "coverage" && !next.landCover) setQueryMode("territory");
  };
  const hasVisibleContext = layers.runap || layers.anm || layers.anla || layers.anh;
  return <div className="geovisor-map" aria-label={`Geovisor interactivo con ${points.length.toLocaleString("es-CO")} detecciones térmicas`}>
    <div ref={containerRef} className="geovisor-canvas" />{!ready && !mapError && <div className="geovisor-loading"><span /> Preparando capas geográficas…</div>}{mapError && <div className="geovisor-error" role="status">{mapError}</div>}
    <aside className="layer-control" aria-label="Control de capas"><div className="layer-control-title"><Layers3 size={15} /><strong>Capas visibles</strong></div>
      <label><input type="checkbox" checked={layers.hotspots} onChange={() => toggleLayer("hotspots")} /><span className="layer-symbol hotspot" /> Detecciones térmicas IDEAM</label>
      <label><input type="checkbox" checked={layers.boundaries} onChange={() => toggleLayer("boundaries")} /><span className="layer-symbol boundary" /> Límites DANE 2025</label>
      <label><input type="checkbox" checked={layers.landCover} onChange={() => toggleLayer("landCover")} /><span className="layer-symbol coverage" /> Coberturas IDEAM 2024</label>
      <label className="opacity-control"><span>Opacidad de coberturas</span><input type="range" min="0.15" max="0.85" step="0.05" value={landCoverOpacity} disabled={!layers.landCover} onChange={(e) => setLandCoverOpacity(Number(e.target.value))} /></label>
      <div className="layer-group-title">Contexto territorial</div>
      <label><input type="checkbox" checked={layers.runap} onChange={() => toggleLayer("runap")} /><span className="layer-symbol runap" /> Áreas protegidas RUNAP</label><label><input type="checkbox" checked={layers.anm} onChange={() => toggleLayer("anm")} /><span className="layer-symbol anm" /> Títulos mineros ANM</label><label><input type="checkbox" checked={layers.anla} onChange={() => toggleLayer("anla")} /><span className="layer-symbol anla" /> Proyectos ANLA</label><label><input type="checkbox" checked={layers.anh} onChange={() => toggleLayer("anh")} /><span className="layer-symbol anh" /> Áreas asignadas ANH</label>
      <div className="query-control"><span>Consulta con clic</span><div role="group" aria-label="Capa consultada al hacer clic"><button type="button" className={queryMode === "territory" ? "active" : ""} disabled={!layers.boundaries} onClick={() => setQueryMode("territory")}>Territorio</button><button type="button" className={queryMode === "coverage" ? "active" : ""} disabled={!layers.landCover} onClick={() => setQueryMode("coverage")}>Cobertura</button><button type="button" className={queryMode === "context" ? "active" : ""} disabled={!hasVisibleContext} onClick={() => setQueryMode("context")}>Contexto</button></div></div>
      <details><summary>Leyenda de coberturas</summary><div className="coverage-legend">{FAMILY_LEGEND.map(([label, color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div></details>
    </aside>
  </div>;
}
