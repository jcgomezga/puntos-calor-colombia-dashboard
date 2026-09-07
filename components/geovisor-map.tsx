"use client";

import { Layers3 } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, PointRow } from "@/components/dashboard-map";

const COLOMBIA_BOUNDS: maplibregl.LngLatBoundsLike = [[-81.85, -4.35], [-66.75, 13.55]];
const IDEAM_SOURCE_ID = "ideam-coberturas-2024";
const IDEAM_SOURCE_LAYER = "Capa geográfica del Mapa Nacional de las Coberturas de la Tierra";
const IDEAM_TILE_URL = "https://visualizador.ideam.gov.co/gisserver/rest/services/Hosted/MNCT_2024V01_VT/VectorTileServer/tile/{z}/{y}/{x}.pbf";
const DEFAULT_LAND_COVER_OPACITY = 0.54;

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

type LayerState = {
  landCover: boolean;
  hotspots: boolean;
  boundaries: boolean;
};
type QueryMode = "territory" | "coverage";

function hotspotGeoJson(points: PointRow[], dates: string[], sources: string[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point, index) => ({
      type: "Feature",
      id: index,
      geometry: { type: "Point", coordinates: [point[0], point[1]] },
      properties: {
        date: dates[point[4]] ?? "Sin fecha",
        minute: point[5],
        source: sources[point[6]] ?? "Fuente no identificada",
        frp: point[8],
        confidence: point[9],
        dayCapture: point[10],
        protected: point[11] === 1,
        mining: point[13] === 1,
        episodeClass: point[17] ?? 0,
      },
    })),
  };
}

function featureBounds(features: FeatureCollection["features"]): maplibregl.LngLatBoundsLike | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      minX = Math.min(minX, value[0]);
      minY = Math.min(minY, value[1]);
      maxX = Math.max(maxX, value[0]);
      maxY = Math.max(maxY, value[1]);
      return;
    }
    value.forEach(visit);
  };

  features.forEach((feature) => visit(feature.geometry.coordinates));
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

function popupRow(label: string, value: string) {
  const row = document.createElement("div");
  const key = document.createElement("span");
  const content = document.createElement("strong");
  key.textContent = label;
  content.textContent = value;
  row.append(key, content);
  return row;
}

function hotspotPopup(feature: MapGeoJSONFeature) {
  const properties = feature.properties;
  const root = document.createElement("div");
  root.className = "geovisor-popup";
  const title = document.createElement("h3");
  title.textContent = "Detección térmica";
  root.append(title);
  const minute = Number(properties.minute);
  const hourLabel = Number.isFinite(minute)
    ? `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
    : "—";
  root.append(
    popupRow("Fecha", `${properties.date} · ${hourLabel}`),
    popupRow("Sensor", String(properties.source)),
    popupRow("FRP", properties.frp == null ? "Sin dato" : `${Number(properties.frp).toLocaleString("es-CO")} MW`),
    popupRow("Confianza", Number(properties.confidence).toLocaleString("es-CO")),
    popupRow("RUNAP", properties.protected ? "Dentro" : "Fuera"),
    popupRow("Título ANM", properties.mining ? "Dentro" : "Fuera"),
  );
  return root;
}

function landCoverPopup(feature: MapGeoJSONFeature) {
  const symbol = Number(feature.properties._symbol);
  const root = document.createElement("div");
  root.className = "geovisor-popup";
  const title = document.createElement("h3");
  title.textContent = "Cobertura de la Tierra 2024";
  root.append(title, popupRow("Clase", LAND_COVER_CLASSES[symbol]?.[0] ?? "Clase sin identificar"), popupRow("Fuente", "IDEAM · escala 1:100.000"));
  return root;
}

function addInteractiveCursor(map: MapLibreMap, layerId: string) {
  map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
}

export function GeovisorMap({
  departments,
  municipalities,
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
  const layerStateRef = useRef<LayerState>({ landCover: true, hotspots: true, boundaries: true });
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [layers, setLayers] = useState<LayerState>({ landCover: true, hotspots: true, boundaries: true });
  const [queryMode, setQueryMode] = useState<QueryMode>("territory");
  const [landCoverOpacity, setLandCoverOpacity] = useState(DEFAULT_LAND_COVER_OPACITY);
  const hotspotData = useMemo(() => hotspotGeoJson(points, dates, sources), [points, dates, sources]);
  const hotspotDataRef = useRef(hotspotData);

  useEffect(() => {
    hotspotDataRef.current = hotspotData;
    callbacksRef.current = { onDepartment, onMunicipality };
    selectionRef.current = { departmentCode, municipalityCode };
    queryModeRef.current = queryMode;
    layerStateRef.current = layers;
  }, [hotspotData, onDepartment, onMunicipality, departmentCode, municipalityCode, queryMode, layers]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "background", type: "background", paint: { "background-color": "#edf2ed" } }],
        },
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
        if (message.includes("MNCT_2024") || message.includes("VectorTileServer")) {
          setMapError("La capa remota de coberturas no respondió; los límites y las detecciones siguen disponibles.");
        }
      });

      map.on("load", () => {
        map.addSource(IDEAM_SOURCE_ID, {
          type: "vector",
          tiles: [IDEAM_TILE_URL],
          minzoom: 0,
          maxzoom: 23,
          attribution: "IDEAM · Mapa Nacional de las Coberturas de la Tierra 2024",
        });
        LAND_COVER_CLASSES.forEach(([label, color], index) => {
          map.addLayer({
            id: LAND_COVER_LAYER_IDS[index],
            type: "fill",
            source: IDEAM_SOURCE_ID,
            "source-layer": IDEAM_SOURCE_LAYER,
            filter: ["==", "_symbol", index],
            paint: { "fill-color": color, "fill-opacity": DEFAULT_LAND_COVER_OPACITY },
            metadata: { label },
          });
        });

        map.addSource("dane-departments", { type: "geojson", data: departments as GeoJSON.FeatureCollection });
        map.addLayer({
          id: "dane-departments-fill",
          type: "fill",
          source: "dane-departments",
          paint: {
            "fill-color": ["case", ["==", ["get", "DPTO_CCDGO"], selectionRef.current.departmentCode], "#2f7d4c", "#d4e3d6"],
            "fill-opacity": ["case", ["==", ["get", "DPTO_CCDGO"], selectionRef.current.departmentCode], 0.25, 0.035],
          },
        });
        map.addLayer({
          id: "dane-departments-line",
          type: "line",
          source: "dane-departments",
          paint: { "line-color": "#395c45", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 9, 1.45], "line-opacity": 0.9 },
        });

        map.addSource("dane-municipalities", { type: "geojson", data: municipalities as GeoJSON.FeatureCollection });
        map.addLayer({
          id: "dane-municipalities-fill",
          type: "fill",
          source: "dane-municipalities",
          filter: ["==", ["get", "d"], selectionRef.current.departmentCode],
          paint: {
            "fill-color": ["case", ["==", ["get", "m"], selectionRef.current.municipalityCode], "#215b39", "#ecf3ed"],
            "fill-opacity": ["case", ["==", ["get", "m"], selectionRef.current.municipalityCode], 0.3, 0.025],
          },
        });
        map.addLayer({
          id: "dane-municipalities-line",
          type: "line",
          source: "dane-municipalities",
          filter: ["==", ["get", "d"], selectionRef.current.departmentCode],
          paint: { "line-color": "#607b66", "line-width": 0.8, "line-opacity": 0.88 },
        });

        map.addSource("hotspots", {
          type: "geojson",
          data: hotspotDataRef.current,
          cluster: true,
          clusterMaxZoom: 9,
          clusterRadius: 42,
        });
        map.addLayer({
          id: "hotspot-clusters",
          type: "circle",
          source: "hotspots",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": ["step", ["get", "point_count"], "#f39a53", 100, "#e56235", 1000, "#ba2f25"],
            "circle-radius": ["step", ["get", "point_count"], 15, 100, 20, 1000, 26],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "hotspot-cluster-count",
          type: "symbol",
          source: "hotspots",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "hotspot-unclustered",
          type: "circle",
          source: "hotspots",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#d93f2b",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.2, 10, 6.2],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.86,
          },
        });

        map.on("click", "hotspot-clusters", async (event) => {
          const cluster = event.features?.[0];
          if (!cluster || cluster.geometry.type !== "Point") return;
          const clusterId = Number(cluster.properties.cluster_id);
          const source = map.getSource("hotspots") as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom });
        });
        map.on("click", "hotspot-unclustered", (event) => {
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          new maplibregl.Popup({ offset: 10, closeButton: true })
            .setLngLat(feature.geometry.coordinates as [number, number])
            .setDOMContent(hotspotPopup(feature))
            .addTo(map);
        });
        map.on("click", (event) => {
          const hotspot = map.queryRenderedFeatures(event.point, { layers: ["hotspot-clusters", "hotspot-unclustered"] });
          if (hotspot.length) return;
          if (queryModeRef.current === "coverage" && layerStateRef.current.landCover) {
            const feature = map.queryRenderedFeatures(event.point, { layers: LAND_COVER_LAYER_IDS })[0];
            if (!feature) return;
            new maplibregl.Popup({ offset: 8, closeButton: true })
              .setLngLat(event.lngLat)
              .setDOMContent(landCoverPopup(feature))
              .addTo(map);
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

        ["hotspot-clusters", "hotspot-unclustered", "dane-departments-fill", "dane-municipalities-fill", ...LAND_COVER_LAYER_IDS]
          .forEach((layerId) => addInteractiveCursor(map, layerId));
        setReady(true);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "El navegador no pudo iniciar el geovisor.";
      queueMicrotask(() => setMapError(message));
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [departments, municipalities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("hotspots") as GeoJSONSource | undefined;
    source?.setData(hotspotData);
  }, [hotspotData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    map.setFilter("dane-municipalities-fill", ["==", ["get", "d"], departmentCode]);
    map.setFilter("dane-municipalities-line", ["==", ["get", "d"], departmentCode]);
    map.setPaintProperty("dane-departments-fill", "fill-color", ["case", ["==", ["get", "DPTO_CCDGO"], departmentCode], "#2f7d4c", "#d4e3d6"]);
    map.setPaintProperty("dane-departments-fill", "fill-opacity", ["case", ["==", ["get", "DPTO_CCDGO"], departmentCode], 0.25, 0.035]);
    map.setPaintProperty("dane-municipalities-fill", "fill-color", ["case", ["==", ["get", "m"], municipalityCode], "#215b39", "#ecf3ed"]);
    map.setPaintProperty("dane-municipalities-fill", "fill-opacity", ["case", ["==", ["get", "m"], municipalityCode], 0.3, 0.025]);

    const targetFeatures = municipalityCode !== "00000"
      ? municipalities.features.filter((feature) => feature.properties.m === municipalityCode)
      : departmentCode !== "00"
        ? departments.features.filter((feature) => feature.properties.DPTO_CCDGO === departmentCode)
        : departments.features;
    const bounds = featureBounds(targetFeatures);
    if (bounds) map.fitBounds(bounds, { padding: departmentCode === "00" ? 28 : 55, duration: 650, maxZoom: municipalityCode !== "00000" ? 12 : 9 });
  }, [departmentCode, municipalityCode, departments.features, municipalities.features, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    LAND_COVER_LAYER_IDS.forEach((id) => map.setLayoutProperty(id, "visibility", layers.landCover ? "visible" : "none"));
    ["hotspot-clusters", "hotspot-cluster-count", "hotspot-unclustered"].forEach((id) => map.setLayoutProperty(id, "visibility", layers.hotspots ? "visible" : "none"));
    ["dane-departments-fill", "dane-departments-line", "dane-municipalities-fill", "dane-municipalities-line"].forEach((id) => map.setLayoutProperty(id, "visibility", layers.boundaries ? "visible" : "none"));
  }, [layers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    LAND_COVER_LAYER_IDS.forEach((id) => map.setPaintProperty(id, "fill-opacity", landCoverOpacity));
  }, [landCoverOpacity, ready]);

  const toggleLayer = (key: keyof LayerState) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  return <div className="geovisor-map" aria-label={`Geovisor interactivo con ${points.length.toLocaleString("es-CO")} detecciones filtradas`}>
    <div ref={containerRef} className="geovisor-canvas" />
    {!ready && !mapError && <div className="geovisor-loading"><span /> Preparando capas geográficas…</div>}
    {mapError && <div className="geovisor-error" role="status">{mapError}</div>}
    <aside className="layer-control" aria-label="Control de capas">
      <div className="layer-control-title"><Layers3 size={15} /><strong>Capas visibles</strong></div>
      <label><input type="checkbox" checked={layers.hotspots} onChange={() => toggleLayer("hotspots")} /><span className="layer-symbol hotspot" /> Detecciones IDEAM</label>
      <label><input type="checkbox" checked={layers.boundaries} onChange={() => toggleLayer("boundaries")} /><span className="layer-symbol boundary" /> Límites DANE 2025</label>
      <label><input type="checkbox" checked={layers.landCover} onChange={() => toggleLayer("landCover")} /><span className="layer-symbol coverage" /> Coberturas IDEAM 2024</label>
      <label className="opacity-control"><span>Opacidad de coberturas</span><input type="range" min="0.15" max="0.85" step="0.05" value={landCoverOpacity} disabled={!layers.landCover} onChange={(event) => setLandCoverOpacity(Number(event.target.value))} /></label>
      <div className="query-control"><span>Consulta con clic</span><div role="group" aria-label="Capa consultada al hacer clic"><button type="button" className={queryMode === "territory" ? "active" : ""} onClick={() => setQueryMode("territory")}>Territorio</button><button type="button" className={queryMode === "coverage" ? "active" : ""} disabled={!layers.landCover} onClick={() => setQueryMode("coverage")}>Cobertura</button></div></div>
      <details>
        <summary>Leyenda de coberturas</summary>
        <div className="coverage-legend">{FAMILY_LEGEND.map(([label, color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div>
      </details>
    </aside>
  </div>;
}
