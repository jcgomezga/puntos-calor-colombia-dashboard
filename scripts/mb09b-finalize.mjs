import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(text, oldValue, newValue, label) {
  const first = text.indexOf(oldValue);
  if (first < 0) throw new Error(`No se encontró el bloque: ${label}`);
  if (text.indexOf(oldValue, first + oldValue.length) >= 0) throw new Error(`Bloque ambiguo: ${label}`);
  return text.slice(0, first) + newValue + text.slice(first + oldValue.length);
}

const componentPath = "components/public-detection-geovisor-map.tsx";
let component = readFileSync(componentPath, "utf8");

component = replaceOnce(
  component,
  'type QueryMode = "hotspot" | "territory" | "coverage" | "context";\ntype TerritoryNames = Record<string, string>;',
  'type QueryMode = "hotspot" | "territory" | "coverage" | "context";\ntype CoverageStatus = "loading" | "ready" | "error";\ntype TerritoryNames = Record<string, string>;',
  "tipo CoverageStatus",
);

component = replaceOnce(
  component,
  '  const callbacksRef = useRef({ onDepartment, onMunicipality }), selectionRef = useRef({ departmentCode, municipalityCode });\n  const queryModeRef = useRef<QueryMode>("hotspot"), layerStateRef = useRef<LayerState>(INITIAL_LAYERS);\n  const [ready, setReady] = useState(false), [mapError, setMapError] = useState("");\n  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS), [queryMode, setQueryMode] = useState<QueryMode>("hotspot");\n  const [landCoverOpacity, setLandCoverOpacity] = useState(DEFAULT_LAND_COVER_OPACITY);',
  '  const callbacksRef = useRef({ onDepartment, onMunicipality }), selectionRef = useRef({ departmentCode, municipalityCode });\n  const queryModeRef = useRef<QueryMode>("hotspot"), layerStateRef = useRef<LayerState>(INITIAL_LAYERS), coverageStatusRef = useRef<CoverageStatus>("loading");\n  const centerQueryRef = useRef<() => void>(() => {});\n  const [ready, setReady] = useState(false), [mapError, setMapError] = useState("");\n  const [coverageStatus, setCoverageStatus] = useState<CoverageStatus>("loading"), [queryFeedback, setQueryFeedback] = useState("");\n  const [panelOpen, setPanelOpen] = useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 640px)").matches);\n  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS), [queryMode, setQueryMode] = useState<QueryMode>("hotspot");\n  const [landCoverOpacity, setLandCoverOpacity] = useState(DEFAULT_LAND_COVER_OPACITY);',
  "refs y estado cartográfico",
);

component = replaceOnce(
  component,
  '  useEffect(() => { hotspotDataRef.current = hotspotData; callbacksRef.current = { onDepartment, onMunicipality }; selectionRef.current = { departmentCode, municipalityCode }; queryModeRef.current = queryMode; layerStateRef.current = layers; }, [hotspotData, onDepartment, onMunicipality, departmentCode, municipalityCode, queryMode, layers]);',
  '  useEffect(() => { hotspotDataRef.current = hotspotData; callbacksRef.current = { onDepartment, onMunicipality }; selectionRef.current = { departmentCode, municipalityCode }; queryModeRef.current = queryMode; layerStateRef.current = layers; coverageStatusRef.current = coverageStatus; }, [hotspotData, onDepartment, onMunicipality, departmentCode, municipalityCode, queryMode, layers, coverageStatus]);\n  useEffect(() => {\n    const media = window.matchMedia("(max-width: 640px)");\n    const adaptPanel = () => setPanelOpen(!media.matches);\n    media.addEventListener("change", adaptPanel);\n    return () => media.removeEventListener("change", adaptPanel);\n  }, []);',
  "sincronización de refs y responsive",
);

component = replaceOnce(
  component,
  '      mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left"); map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right"); map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");\n      map.on("error", (event) => { const message = event.error?.message ?? ""; if (message.includes("context-layers.pmtiles")) setMapError("Las capas RUNAP, ANM, ANLA y ANH no respondieron; el resto del geovisor sigue disponible."); else if (message.includes("MNCT_2024") || message.includes("VectorTileServer")) setMapError("La capa remota de coberturas IDEAM no respondió; el resto del geovisor sigue disponible."); });',
  '      mapRef.current = map; map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left"); map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-right"); map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");\n      map.on("error", (event) => {\n        const message = event.error?.message ?? "";\n        if (message.includes("context-layers.pmtiles")) setMapError("Las capas RUNAP, ANM, ANLA y ANH no respondieron; el resto del geovisor sigue disponible.");\n        else if (message.includes("MNCT_2024") || message.includes("VectorTileServer")) { setCoverageStatus("error"); coverageStatusRef.current = "error"; setMapError("La capa remota de coberturas IDEAM no respondió; el resto del geovisor sigue disponible."); }\n      });',
  "error granular IDEAM",
);

component = replaceOnce(
  component,
  '        map.addSource(IDEAM_SOURCE_ID, { type: "vector", tiles: [IDEAM_TILE_URL], minzoom: 0, maxzoom: 23, attribution: "IDEAM · Mapa Nacional de las Coberturas de la Tierra 2024" });\n        LAND_COVER_CLASSES.forEach',
  '        setCoverageStatus("loading"); coverageStatusRef.current = "loading";\n        map.addSource(IDEAM_SOURCE_ID, { type: "vector", tiles: [IDEAM_TILE_URL], minzoom: 0, maxzoom: 23, attribution: "IDEAM · Mapa Nacional de las Coberturas de la Tierra 2024" });\n        map.on("sourcedata", (event) => { if (event.sourceId === IDEAM_SOURCE_ID && event.isSourceLoaded) { setCoverageStatus("ready"); coverageStatusRef.current = "ready"; } });\n        LAND_COVER_CLASSES.forEach',
  "estado de carga cobertura",
);

component = replaceOnce(
  component,
  'paint: { "circle-color": "#2e69c9", "circle-radius": 4.5, "circle-stroke-color": "#fff", "circle-stroke-width": 1 }',
  'paint: { "circle-color": ["match", ["get", "situacion"], "evaluacion", "#22a6b3", "#2e69c9"], "circle-radius": 4.5, "circle-stroke-color": "#fff", "circle-stroke-width": 1 }',
  "simbología puntual ANLA",
);

const oldClickBlock = `        map.on("click", "hotspot-clusters", async (event) => { if (queryModeRef.current !== "hotspot") return; const cluster = event.features?.[0]; if (!cluster || cluster.geometry.type !== "Point") return; const source = map.getSource("hotspots") as GeoJSONSource; const zoom = await source.getClusterExpansionZoom(Number(cluster.properties.cluster_id)); map.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom }); });
        map.on("click", "hotspot-unclustered", (event) => { if (queryModeRef.current !== "hotspot") return; const feature = event.features?.[0]; if (!feature || feature.geometry.type !== "Point") return; new maplibregl.Popup({ offset: 10, closeButton: true }).setLngLat(feature.geometry.coordinates as [number, number]).setDOMContent(hotspotPopup(feature)).addTo(map); });
        map.on("click", (event) => {
          if (queryModeRef.current === "hotspot") { if (map.queryRenderedFeatures(event.point, { layers: ["hotspot-clusters", "hotspot-unclustered"] }).length) return; return; }
          if (queryModeRef.current === "coverage" && layerStateRef.current.landCover) { const feature = map.queryRenderedFeatures(event.point, { layers: LAND_COVER_LAYER_IDS })[0]; if (!feature) return; new maplibregl.Popup({ offset: 8, closeButton: true }).setLngLat(event.lngLat).setDOMContent(landCoverPopup(feature)).addTo(map); return; }
          if (queryModeRef.current === "context") {
            const contextLayers = visibleContextLayerIds(layerStateRef.current);
            const features = contextLayers.length ? uniqueContextFeatures(map.queryRenderedFeatures(event.point, { layers: contextLayers })) : [];
            if (!features.length) return;
            contextSelectionPopup(features, event.lngLat).addTo(map);
            return;
          }
          if (queryModeRef.current !== "territory" || !layerStateRef.current.boundaries) return;
          if (selectionRef.current.departmentCode !== "00") { const municipality = map.queryRenderedFeatures(event.point, { layers: ["dane-municipalities-fill"] })[0]; const code = String(municipality?.properties.m ?? ""); if (code) callbacksRef.current.onMunicipality(code); return; }
          const department = map.queryRenderedFeatures(event.point, { layers: ["dane-departments-fill"] })[0]; const code = String(department?.properties.DPTO_CCDGO ?? ""); if (code) callbacksRef.current.onDepartment(code);
        });`;

const newClickBlock = `        const queryAtPoint = async (point: maplibregl.Point, lngLat: maplibregl.LngLat) => {
          const mode = queryModeRef.current;
          if (mode === "hotspot") {
            const feature = map.queryRenderedFeatures(point, { layers: ["hotspot-clusters", "hotspot-unclustered"] })[0];
            if (!feature) { setQueryFeedback("No hay una detección térmica consultable en el punto actual."); return; }
            if (feature.geometry.type !== "Point") return;
            if (feature.properties?.cluster_id !== undefined) {
              const source = map.getSource("hotspots") as GeoJSONSource;
              const zoom = await source.getClusterExpansionZoom(Number(feature.properties.cluster_id));
              map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
              setQueryFeedback(\`Cluster con \${Number(feature.properties.point_count ?? 0).toLocaleString("es-CO")} detecciones; se amplió el mapa para desagregarlo.\`);
              return;
            }
            new maplibregl.Popup({ offset: 10, closeButton: true }).setLngLat(feature.geometry.coordinates as [number, number]).setDOMContent(hotspotPopup(feature)).addTo(map);
            setQueryFeedback("Detección térmica consultada. La ficha se abrió sobre el mapa.");
            return;
          }
          if (mode === "coverage" && layerStateRef.current.landCover) {
            if (coverageStatusRef.current === "loading") { setQueryFeedback("La cobertura IDEAM todavía está cargando; intenta de nuevo en unos segundos."); return; }
            if (coverageStatusRef.current === "error") { setQueryFeedback("La cobertura IDEAM no está disponible en este momento."); return; }
            const feature = map.queryRenderedFeatures(point, { layers: LAND_COVER_LAYER_IDS })[0];
            if (!feature) { setQueryFeedback("No se encontró una clase de cobertura renderizada en el punto actual."); return; }
            new maplibregl.Popup({ offset: 8, closeButton: true }).setLngLat(lngLat).setDOMContent(landCoverPopup(feature)).addTo(map);
            setQueryFeedback("Cobertura IDEAM consultada. La ficha se abrió sobre el mapa.");
            return;
          }
          if (mode === "context") {
            const contextLayers = visibleContextLayerIds(layerStateRef.current);
            const features = contextLayers.length ? uniqueContextFeatures(map.queryRenderedFeatures(point, { layers: contextLayers })) : [];
            if (!features.length) { setQueryFeedback("No hay entidades de contexto visibles en el punto actual."); return; }
            contextSelectionPopup(features, lngLat).addTo(map);
            setQueryFeedback(features.length === 1 ? "1 coincidencia contextual consultada." : \`\${features.length} coincidencias contextuales; usa el selector de la ficha para cambiar de entidad.\`);
            return;
          }
          if (mode !== "territory" || !layerStateRef.current.boundaries) return;
          if (selectionRef.current.departmentCode !== "00") {
            const municipality = map.queryRenderedFeatures(point, { layers: ["dane-municipalities-fill"] })[0];
            const code = String(municipality?.properties.m ?? "");
            if (!code) { setQueryFeedback("No se encontró un municipio consultable en el punto actual."); return; }
            callbacksRef.current.onMunicipality(code); setQueryFeedback("Municipio seleccionado desde el mapa."); return;
          }
          const department = map.queryRenderedFeatures(point, { layers: ["dane-departments-fill"] })[0];
          const code = String(department?.properties.DPTO_CCDGO ?? "");
          if (!code) { setQueryFeedback("No se encontró un departamento consultable en el punto actual."); return; }
          callbacksRef.current.onDepartment(code); setQueryFeedback("Departamento seleccionado desde el mapa.");
        };
        map.on("click", (event) => { void queryAtPoint(event.point, event.lngLat); });
        centerQueryRef.current = () => { const center = map.getCenter(); void queryAtPoint(map.project(center), center); };`;
component = replaceOnce(component, oldClickBlock, newClickBlock, "consulta cartográfica unificada");

component = replaceOnce(
  component,
  '    return () => { mapRef.current?.remove(); mapRef.current = null; };',
  '    return () => { centerQueryRef.current = () => {}; mapRef.current?.remove(); mapRef.current = null; };',
  "cleanup consulta central",
);

const oldRender = `  const hasVisibleContext = layers.runap || layers.anm || layers.anla || layers.anh;
  return <div className="geovisor-map" aria-label={\`Geovisor interactivo con \${points.length.toLocaleString("es-CO")} detecciones térmicas\`}>
    <div ref={containerRef} className="geovisor-canvas" />{!ready && !mapError && <div className="geovisor-loading"><span /> Preparando capas geográficas…</div>}{mapError && <div className="geovisor-error" role="status">{mapError}</div>}
    <aside className="layer-control" aria-label="Control de capas"><div className="layer-control-title"><Layers3 size={15} /><strong>Capas visibles</strong></div>
      <label><input type="checkbox" checked={layers.hotspots} onChange={() => toggleLayer("hotspots")} /><span className="layer-symbol hotspot" /> Detecciones térmicas IDEAM</label>
      <label><input type="checkbox" checked={layers.boundaries} onChange={() => toggleLayer("boundaries")} /><span className="layer-symbol boundary" /> Límites DANE 2025</label>
      <label><input type="checkbox" checked={layers.landCover} onChange={() => toggleLayer("landCover")} /><span className="layer-symbol coverage" /> Coberturas IDEAM 2024</label>
      <label className="opacity-control"><span>Opacidad de coberturas</span><input type="range" min="0.15" max="0.85" step="0.05" value={landCoverOpacity} disabled={!layers.landCover} onChange={(e) => setLandCoverOpacity(Number(e.target.value))} /></label>
      <div className="layer-group-title">Contexto territorial</div>
      <label><input type="checkbox" checked={layers.runap} onChange={() => toggleLayer("runap")} /><span className="layer-symbol runap" /> Áreas protegidas RUNAP</label><label><input type="checkbox" checked={layers.anm} onChange={() => toggleLayer("anm")} /><span className="layer-symbol anm" /> Títulos mineros ANM</label><label><input type="checkbox" checked={layers.anla} onChange={() => toggleLayer("anla")} /><span className="layer-symbol anla" /> Proyectos ANLA</label><label><input type="checkbox" checked={layers.anh} onChange={() => toggleLayer("anh")} /><span className="layer-symbol anh" /> Áreas asignadas ANH</label>
      <div className="query-control"><span>Consulta con clic</span><div role="group" aria-label="Capa consultada al hacer clic"><button type="button" className={queryMode === "hotspot" ? "active" : ""} aria-pressed={queryMode === "hotspot"} disabled={!layers.hotspots} onClick={() => setQueryMode("hotspot")}>Detección</button><button type="button" className={queryMode === "territory" ? "active" : ""} aria-pressed={queryMode === "territory"} disabled={!layers.boundaries} onClick={() => setQueryMode("territory")}>Territorio</button><button type="button" className={queryMode === "coverage" ? "active" : ""} aria-pressed={queryMode === "coverage"} disabled={!layers.landCover} onClick={() => setQueryMode("coverage")}>Cobertura</button><button type="button" className={queryMode === "context" ? "active" : ""} aria-pressed={queryMode === "context"} disabled={!hasVisibleContext} onClick={() => setQueryMode("context")}>Contexto</button></div></div>
      <details><summary>Leyenda de coberturas</summary><div className="coverage-legend">{FAMILY_LEGEND.map(([label, color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div></details>
    </aside>
  </div>;`;

const newRender = `  const hasVisibleContext = layers.runap || layers.anm || layers.anla || layers.anh;
  const coverageStatusLabel = coverageStatus === "loading" ? "Cobertura IDEAM: cargando teselas remotas" : coverageStatus === "ready" ? "Cobertura IDEAM: lista para consulta" : "Cobertura IDEAM: no disponible";
  return <div className="geovisor-map" aria-label={\`Geovisor interactivo con \${points.length.toLocaleString("es-CO")} detecciones térmicas\`}>
    <div ref={containerRef} className="geovisor-canvas" />{!ready && !mapError && <div className="geovisor-loading"><span /> Preparando capas geográficas…</div>}{mapError && <div className="geovisor-error" role="status">{mapError}</div>}
    <aside className={\`layer-control \${panelOpen ? "open" : "collapsed"}\`} aria-label="Control de capas y consulta">
      <div className="layer-control-title"><span className="layer-control-heading"><Layers3 size={15} /><strong>Capas y consulta</strong></span><button type="button" className="layer-control-toggle" aria-expanded={panelOpen} aria-controls="geovisor-layer-panel" onClick={() => setPanelOpen((value) => !value)}>{panelOpen ? "Ocultar" : "Capas"}</button></div>
      {panelOpen && <div id="geovisor-layer-panel" className="layer-control-body">
        <label><input type="checkbox" checked={layers.hotspots} onChange={() => toggleLayer("hotspots")} /><span className="layer-symbol hotspot" /> Detecciones térmicas IDEAM</label>
        <label><input type="checkbox" checked={layers.boundaries} onChange={() => toggleLayer("boundaries")} /><span className="layer-symbol boundary" /> Límites DANE 2025</label>
        <label><input type="checkbox" checked={layers.landCover} onChange={() => toggleLayer("landCover")} /><span className="layer-symbol coverage" /> Coberturas IDEAM 2024</label>
        <div className={\`coverage-status \${coverageStatus}\`} role="status" aria-live="polite">{coverageStatusLabel}</div>
        <label className="opacity-control"><span>Opacidad de coberturas</span><input type="range" min="0.15" max="0.85" step="0.05" value={landCoverOpacity} disabled={!layers.landCover} onChange={(e) => setLandCoverOpacity(Number(e.target.value))} /></label>
        <div className="layer-group-title">Contexto territorial</div>
        <label><input type="checkbox" checked={layers.runap} onChange={() => toggleLayer("runap")} /><span className="layer-symbol runap" /> Áreas protegidas RUNAP</label><label><input type="checkbox" checked={layers.anm} onChange={() => toggleLayer("anm")} /><span className="layer-symbol anm" /> Títulos mineros ANM</label><label><input type="checkbox" checked={layers.anla} onChange={() => toggleLayer("anla")} /><span className="layer-symbol anla" /> Proyectos ANLA</label><label><input type="checkbox" checked={layers.anh} onChange={() => toggleLayer("anh")} /><span className="layer-symbol anh" /> Áreas asignadas ANH</label>
        <div className="query-control"><span>Consulta espacial</span><div role="group" aria-label="Capa consultada"><button type="button" className={queryMode === "hotspot" ? "active" : ""} aria-pressed={queryMode === "hotspot"} disabled={!layers.hotspots} onClick={() => setQueryMode("hotspot")}>Detección</button><button type="button" className={queryMode === "territory" ? "active" : ""} aria-pressed={queryMode === "territory"} disabled={!layers.boundaries} onClick={() => setQueryMode("territory")}>Territorio</button><button type="button" className={queryMode === "coverage" ? "active" : ""} aria-pressed={queryMode === "coverage"} disabled={!layers.landCover} onClick={() => setQueryMode("coverage")}>Cobertura</button><button type="button" className={queryMode === "context" ? "active" : ""} aria-pressed={queryMode === "context"} disabled={!hasVisibleContext} onClick={() => setQueryMode("context")}>Contexto</button></div></div>
        <button type="button" className="center-query-button" onClick={() => centerQueryRef.current()}>Consultar centro del mapa</button>
        <div className="query-feedback" role="status" aria-live="polite">{queryFeedback || "Con teclado: desplaza el mapa, elige el tipo de consulta y usa «Consultar centro del mapa»."}</div>
        <details><summary>Leyenda de detecciones</summary><div className="hotspot-legend"><span><i className="cluster-marker low" />1–99 detecciones</span><span><i className="cluster-marker medium" />100–999 detecciones</span><span><i className="cluster-marker high" />1.000 o más</span><small>El número, tamaño y color del cluster expresan cantidad de detecciones agrupadas; no intensidad ni severidad de un incendio.</small></div></details>
        {layers.anla && <details><summary>Leyenda ANLA</summary><div className="anla-legend"><span><i className="anla-evaluation" />En evaluación</span><span><i className="anla-licensed" />Licenciado</span><small>La situación jurídica se conserva en polígonos, líneas y puntos.</small></div></details>}
        <details><summary>Leyenda de coberturas</summary><div className="coverage-legend">{FAMILY_LEGEND.map(([label, color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div></details>
      </div>}
    </aside>
  </div>;`;
component = replaceOnce(component, oldRender, newRender, "panel cartográfico accesible");
writeFileSync(componentPath, component);

const basicPath = "components/dashboard-map.tsx";
const basic = `"use client";

import { useEffect, useMemo, useRef } from "react";

type Position = number[];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry };
export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };
export type PointRow = [number, number, number, number, number, number, number, number, number | null, number, number, number?, number?, number?, number?, number?, number?, number?, number?];

const WIDTH = 1000;
const HEIGHT = 650;
const PAD = 28;
const NATIONAL_AGGREGATION_THRESHOLD = 2500;
const NATIONAL_GRID_SIZE = 7;

function rings(geometry: Geometry): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates as Position[][];
  return (geometry.coordinates as Position[][][]).flat();
}
function featureBounds(features: Feature[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const feature of features) for (const ring of rings(feature.geometry)) for (const point of ring) {
    minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]); maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]);
  }
  return { minX, minY, maxX, maxY };
}
function projector(bounds: ReturnType<typeof featureBounds>) {
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.01), spanY = Math.max(bounds.maxY - bounds.minY, 0.01);
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (HEIGHT - PAD * 2) / spanY);
  const offsetX = (WIDTH - spanX * scale) / 2, offsetY = (HEIGHT - spanY * scale) / 2;
  return (longitude: number, latitude: number) => [offsetX + (longitude - bounds.minX) * scale, HEIGHT - offsetY - (latitude - bounds.minY) * scale] as const;
}
function geometryPath(geometry: Geometry, project: ReturnType<typeof projector>) {
  return rings(geometry).map((ring) => ring.map((point, index) => { const [x, y] = project(point[0], point[1]); return \`\${index ? "L" : "M"}\${x.toFixed(2)},\${y.toFixed(2)}\`; }).join(" ") + " Z").join(" ");
}
function featureLabel(feature: Feature, isDepartment: boolean, code: string) {
  const keys = isDepartment ? ["DPTO_CNMBR", "NOMBRE_DPT", "name", "nombre"] : ["MPIO_CNMBR", "MPIO_CCNCT", "name", "nombre"];
  for (const key of keys) { const value = String(feature.properties[key] ?? "").trim(); if (value) return value; }
  return code;
}

export function DashboardMap({ departments, municipalities, points, departmentCode, municipalityCode, onDepartment, onMunicipality }: {
  departments: FeatureCollection; municipalities: FeatureCollection; points: PointRow[]; departmentCode: string; municipalityCode: string;
  onDepartment: (code: string) => void; onMunicipality: (code: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const departmentFeatures = departments.features;
  const municipalityFeatures = useMemo(() => municipalities.features.filter((feature) => feature.properties.d === departmentCode), [municipalities.features, departmentCode]);
  const visibleFeatures = departmentCode === "00" ? departmentFeatures : municipalityFeatures;
  const focused = municipalityCode !== "00000" ? municipalityFeatures.filter((feature) => feature.properties.m === municipalityCode) : departmentCode !== "00" ? departmentFeatures.filter((feature) => feature.properties.DPTO_CCDGO === departmentCode) : departmentFeatures;
  const bounds = useMemo(() => featureBounds(focused.length ? focused : visibleFeatures), [focused, visibleFeatures]);
  const project = useMemo(() => projector(bounds), [bounds]);
  const usesNationalAggregation = departmentCode === "00" && points.length > NATIONAL_AGGREGATION_THRESHOLD;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext("2d"); if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height); context.scale(canvas.width / WIDTH, canvas.height / HEIGHT); context.fillStyle = "rgb(201, 58, 38)";
      if (usesNationalAggregation) {
        const grid = new Map<string, { x: number; y: number; count: number }>();
        for (const point of points) { const [x, y] = project(point[0], point[1]); const gx = Math.floor(x / NATIONAL_GRID_SIZE), gy = Math.floor(y / NATIONAL_GRID_SIZE), key = \`\${gx}:\${gy}\`; const cell = grid.get(key); if (cell) { cell.x += x; cell.y += y; cell.count += 1; } else grid.set(key, { x, y, count: 1 }); }
        for (const cell of grid.values()) { const x = cell.x / cell.count, y = cell.y / cell.count, radius = Math.min(6, 1.4 + Math.log2(cell.count + 1) * 0.78); context.globalAlpha = Math.min(0.76, 0.32 + Math.log10(cell.count + 1) * 0.18); context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); }
        context.globalAlpha = 1;
      } else {
        context.globalAlpha = points.length > 8000 ? 0.4 : 0.62; const radius = municipalityCode === "00000" ? 2.1 : 3.2;
        for (const point of points) { const [x, y] = project(point[0], point[1]); context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); }
        context.globalAlpha = 1;
      }
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(canvas); return () => observer.disconnect();
  }, [points, project, municipalityCode, usesNationalAggregation]);

  return <div className="real-map" role="group" data-visual-aggregation={usesNationalAggregation ? "grid" : "points"} aria-label={\`Mapa básico con \${points.length.toLocaleString("es-CO")} detecciones filtradas\`}>
    <p className="sr-only">Las detecciones son referencia visual en este modo. Los territorios sí pueden seleccionarse con clic, tecla Enter o barra espaciadora. Usa los filtros del dashboard para explorar los datos.</p>
    <svg viewBox={\`0 0 \${WIDTH} \${HEIGHT}\`} role="img" aria-label="Límites territoriales DANE 2025"><g>
      {visibleFeatures.map((feature) => { const isDepartment = departmentCode === "00", code = String(feature.properties[isDepartment ? "DPTO_CCDGO" : "m"] ?? ""), selected = !isDepartment && code === municipalityCode, name = featureLabel(feature, isDepartment, code); const activate = () => isDepartment ? onDepartment(code) : onMunicipality(code); return <path key={code} d={geometryPath(feature.geometry, project)} fillRule="evenodd" className={\`territory-shape\${selected ? " selected" : ""}\`} role="button" tabIndex={0} aria-label={\`Seleccionar \${isDepartment ? "departamento" : "municipio"}: \${name}\`} onClick={activate} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } }} />; })}
    </g></svg>
    <canvas ref={canvasRef} aria-hidden="true" />
  </div>;
}
`;
writeFileSync(basicPath, basic);

const pagePath = "app/page.tsx";
let page = readFileSync(pagePath, "utf8");
page = replaceOnce(
  page,
  '<div className="map-caption">Navega, acerca y activa capas. Haz clic en una detección, territorio, cobertura o capa de contexto para consultar sus atributos. Los indicadores y gráficos se recalculan con el periodo y los filtros seleccionados.</div>',
  '<div className="map-caption">{mapMode === "geovisor" ? "Navega y acerca el mapa, activa las capas y elige qué deseas consultar: detección, territorio, cobertura o contexto. También puedes desplazar el mapa con teclado y usar «Consultar centro del mapa»." : "Mapa básico: permite seleccionar departamentos y municipios con clic o teclado. Las detecciones son referencia visual y, a escala nacional, se agregan solo para evitar saturación; los conteos analíticos no cambian. Las fichas de detección, cobertura y contexto requieren el Geovisor."}</div>',
  "copy dependiente del modo de mapa",
);
writeFileSync(pagePath, page);

const cssPath = "app/globals.css";
let css = readFileSync(cssPath, "utf8");
const marker = "/* MB-09 cartografía, responsive y accesibilidad espacial */";
if (css.includes(marker)) throw new Error("El bloque CSS MB-09 ya existe.");
css += `\n\n${marker}\n.territory-shape:focus-visible { outline: none; stroke: #0e5e34; stroke-width: 3; fill: #9fc5a6; fill-opacity: .98; }\n.geovisor-map .maplibregl-ctrl-group button { width: 40px; height: 40px; }\n.layer-control { max-height: calc(100% - 20px); padding: 8px; display: flex; flex-direction: column; overflow: hidden; }\n.layer-control-title { margin-bottom: 5px; justify-content: space-between; gap: 8px; }\n.layer-control-heading { min-width: 0; display: flex; align-items: center; gap: 6px; }\n.layer-control-toggle { min-height: 36px; padding: 5px 9px; border: 1px solid #c7d2c9; border-radius: 6px; background: #f8faf8; color: #31513c; font-size: 9px; font-weight: 800; cursor: pointer; }\n.layer-control-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding-right: 2px; }\n.layer-control-body > label:not(.opacity-control) { min-height: 36px; display: flex; align-items: center; gap: 6px; font-size: 10px; cursor: pointer; }\n.layer-control-body input[type="checkbox"] { width: 18px; height: 18px; flex: 0 0 auto; }\n.coverage-status { margin: 2px 0 5px; padding: 5px 7px; border-radius: 5px; background: #f1f4f1; color: #607067; font-size: 8.5px; line-height: 1.3; }\n.coverage-status.ready { background: #edf6ef; color: #315b3e; }\n.coverage-status.error { background: #fff1ea; color: #81442f; }\n.query-control button { min-height: 34px; }\n.center-query-button { width: 100%; min-height: 38px; margin-top: 6px; padding: 6px 8px; border: 1px solid #9eb4a3; border-radius: 6px; background: #f3f8f4; color: #26513a; font-size: 9px; font-weight: 800; cursor: pointer; }\n.query-feedback { margin-top: 5px; padding: 5px 7px; border-left: 2px solid #9eb4a3; background: #f8faf8; color: #5d6c63; font-size: 8.5px; line-height: 1.35; }\n.hotspot-legend, .anla-legend { margin-top: 7px; display: grid; gap: 6px; }\n.hotspot-legend span, .anla-legend span { display: flex; align-items: center; gap: 7px; color: #5f6e65; font-size: 8.5px; }\n.hotspot-legend small, .anla-legend small { color: #69766e; font-size: 8px; line-height: 1.35; }\n.cluster-marker { display: inline-grid; place-items: center; flex: 0 0 auto; border: 1px solid white; border-radius: 50%; box-shadow: 0 0 0 1px #adbaaF; }\n.cluster-marker.low { width: 12px; height: 12px; background: #f39a53; }\n.cluster-marker.medium { width: 16px; height: 16px; background: #e56235; }\n.cluster-marker.high { width: 20px; height: 20px; background: #ba2f25; }\n.anla-legend i { width: 12px; height: 10px; display: inline-block; flex: 0 0 auto; border: 1px solid #ffffffcc; box-shadow: 0 0 0 1px #9daaa1; }\n.anla-evaluation { background: #22a6b3; }\n.anla-licensed { background: #2e69c9; }\n.layer-control.collapsed { width: auto; }\n.layer-control.collapsed .layer-control-title { margin-bottom: 0; }\n@media (max-width: 640px) {\n  .geovisor-map .maplibregl-ctrl-group button { width: 44px; height: 44px; }\n  .layer-control { width: min(280px, calc(100% - 20px)); max-height: calc(100% - 20px); }\n  .layer-control.collapsed { width: auto; padding: 4px; }\n  .layer-control.collapsed .layer-control-heading { display: none; }\n  .layer-control-toggle, .layer-control-body > label:not(.opacity-control), .query-control button, .center-query-button { min-height: 44px; }\n  .layer-control-body input[type="checkbox"] { width: 22px; height: 22px; }\n  .query-control > div { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n  .coverage-status, .query-feedback { font-size: 9px; }\n}\n`;
writeFileSync(cssPath, css);

const testPath = "tests/mb09-cartography-accessibility.test.mjs";
const test = `import assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\nimport test from "node:test";\n\nconst geovisor = readFileSync("components/public-detection-geovisor-map.tsx", "utf8");\nconst basic = readFileSync("components/dashboard-map.tsx", "utf8");\nconst page = readFileSync("app/page.tsx", "utf8");\nconst css = readFileSync("app/globals.css", "utf8");\n\ntest("MB-09 mantiene consulta cartográfica explícita y alternativa de teclado", () => {\n  assert.match(geovisor, /Consultar centro del mapa/);\n  assert.match(geovisor, /queryAtPoint/);\n  assert.match(geovisor, /role=\"status\" aria-live=\"polite\"/);\n  assert.doesNotMatch(geovisor, /map\.on\(\"click\", \"hotspot-clusters\"/);\n  assert.match(basic, /tabIndex=\{0\}/);\n  assert.match(basic, /event\.key === \"Enter\" \|\| event\.key === \" \"/);\n});\n\ntest("MB-09 documenta clusters, situación ANLA y carga remota IDEAM", () => {\n  assert.match(geovisor, /Leyenda de detecciones/);\n  assert.match(geovisor, /no intensidad ni severidad de un incendio/);\n  assert.match(geovisor, /Leyenda ANLA/);\n  assert.match(geovisor, /\"circle-color\": \[\"match\", \[\"get\", \"situacion\"\]/);\n  assert.match(geovisor, /coverageStatusRef/);\n  assert.match(geovisor, /Cobertura IDEAM: cargando teselas remotas/);\n});\n\ntest("MB-09 reduce saturación del mapa básico sin alterar conteos", () => {\n  assert.match(basic, /NATIONAL_AGGREGATION_THRESHOLD = 2500/);\n  assert.match(basic, /data-visual-aggregation=\{usesNationalAggregation \? \"grid\" : \"points\"\}/);\n  assert.match(page, /se agregan solo para evitar saturación; los conteos analíticos no cambian/);\n  assert.match(page, /Las fichas de detección, cobertura y contexto requieren el Geovisor/);\n});\n\ntest("MB-09 colapsa controles móviles y aumenta targets cartográficos", () => {\n  assert.match(geovisor, /panelOpen/);\n  assert.match(geovisor, /aria-expanded=\{panelOpen\}/);\n  assert.match(css, /\.geovisor-map \.maplibregl-ctrl-group button \{ width: 44px; height: 44px; \}/);\n  assert.match(css, /\.layer-control\.collapsed \.layer-control-heading \{ display: none; \}/);\n});\n`;
writeFileSync(testPath, test);

console.log("MB-09B finalización aplicada a geovisor, mapa básico, copy, CSS y pruebas.");
