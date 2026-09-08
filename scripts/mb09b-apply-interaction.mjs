import { readFileSync, writeFileSync } from "node:fs";

const componentPath = "components/public-detection-geovisor-map.tsx";
const cssPath = "app/globals.css";
let component = readFileSync(componentPath, "utf8");
let css = readFileSync(cssPath, "utf8");

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`No se encontró el fragmento esperado: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`El fragmento aparece más de una vez: ${label}`);
  return source.replace(from, to);
}

component = replaceOnce(component,
  'type QueryMode = "territory" | "coverage" | "context";',
  'type QueryMode = "hotspot" | "territory" | "coverage" | "context";',
  "tipo QueryMode",
);
component = replaceOnce(component,
  'const queryModeRef = useRef<QueryMode>("territory"), layerStateRef = useRef<LayerState>(INITIAL_LAYERS);',
  'const queryModeRef = useRef<QueryMode>("hotspot"), layerStateRef = useRef<LayerState>(INITIAL_LAYERS);',
  "modo inicial ref",
);
component = replaceOnce(component,
  'const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS), [queryMode, setQueryMode] = useState<QueryMode>("territory");',
  'const [layers, setLayers] = useState<LayerState>(INITIAL_LAYERS), [queryMode, setQueryMode] = useState<QueryMode>("hotspot");',
  "modo inicial state",
);

const helpers = `function contextFeatureIdentity(feature: MapGeoJSONFeature) {
  const p = feature.properties as Record<string, unknown>;
  const detailKey = present(p.detail_key);
  if (detailKey) return \`${"${feature.sourceLayer ?? \"contexto\"}"}:detail:${"${detailKey}"}\`;
  if (feature.id !== null && feature.id !== undefined) return \`${"${feature.sourceLayer ?? \"contexto\"}"}:id:${"${String(feature.id)}"}\`;
  const fallback = firstProperty(p, ["codigo", "expediente", "contrato_id", "contrato", "nombre", "proyecto", "area", "solicitante"]);
  return \`${"${feature.sourceLayer ?? \"contexto\"}"}:fallback:${"${fallback || JSON.stringify(p)}"}\`;
}
function uniqueContextFeatures(features: MapGeoJSONFeature[]) {
  const seen = new Set<string>();
  return features.filter((feature) => { const key = contextFeatureIdentity(feature); if (seen.has(key)) return false; seen.add(key); return true; });
}
function contextFeatureLabel(feature: MapGeoJSONFeature) {
  const p = feature.properties as Record<string, unknown>;
  const source = (feature.sourceLayer || "contexto").toUpperCase();
  const label = feature.sourceLayer === "runap" ? firstProperty(p, ["nombre", "categoria"]) :
    feature.sourceLayer === "anm" ? firstProperty(p, ["codigo", "solicitante"]) :
    feature.sourceLayer === "anla" ? firstProperty(p, ["expediente", "proyecto"]) :
    feature.sourceLayer === "anh" ? firstProperty(p, ["contrato", "area", "contrato_id"]) : "";
  return label ? \`${"${source}"} · ${"${label}"}\` : source;
}
function contextSelectionPopup(features: MapGeoJSONFeature[], lngLat: maplibregl.LngLatLike) {
  const root = document.createElement("div"); root.className = "geovisor-context-selection";
  const heading = document.createElement("div"); heading.className = "context-match-heading";
  const strong = document.createElement("strong"); strong.textContent = features.length === 1 ? "1 coincidencia contextual" : \`${"${features.length}"} coincidencias contextuales\`;
  const note = document.createElement("span"); note.textContent = "Selecciona la entidad para consultar su ficha.";
  heading.append(strong, note); root.append(heading);
  const detailHost = document.createElement("div"); detailHost.className = "context-match-detail";
  const popup = new maplibregl.Popup({ offset: 8, closeButton: true }).setLngLat(lngLat).setDOMContent(root);
  let requestVersion = 0;
  const renderFeature = (feature: MapGeoJSONFeature) => {
    const version = ++requestVersion;
    const detailKey = present((feature.properties as Record<string, unknown>).detail_key);
    detailHost.replaceChildren(contextPopup(feature, null, detailKey ? "loading" : "ready"));
    if (!detailKey) return;
    void loadContextDetail(detailKey).then((details) => {
      if (version === requestVersion && popup.isOpen()) detailHost.replaceChildren(contextPopup(feature, details, "ready"));
    }).catch(() => {
      if (version === requestVersion && popup.isOpen()) detailHost.replaceChildren(contextPopup(feature, null, "error"));
    });
  };
  if (features.length > 1) {
    const label = document.createElement("label"); label.className = "context-match-selector"; label.textContent = "Entidad coincidente";
    const select = document.createElement("select"); select.setAttribute("aria-label", "Entidad contextual coincidente");
    features.forEach((feature, index) => { const option = document.createElement("option"); option.value = String(index); option.textContent = contextFeatureLabel(feature); select.append(option); });
    select.addEventListener("change", () => renderFeature(features[Number(select.value)] ?? features[0]));
    label.append(select); root.append(label);
  }
  root.append(detailHost); renderFeature(features[0]);
  return popup;
}
`;
component = replaceOnce(component,
  'function geometryCoordinates(feature: FeatureCollection["features"][number]): number[][][] {',
  `${helpers}\nfunction geometryCoordinates(feature: FeatureCollection["features"][number]): number[][][] {`,
  "helpers de coincidencias contextuales",
);

const oldHandlers = `        map.on("click", "hotspot-clusters", async (event) => { const cluster = event.features?.[0]; if (!cluster || cluster.geometry.type !== "Point") return; const source = map.getSource("hotspots") as GeoJSONSource; const zoom = await source.getClusterExpansionZoom(Number(cluster.properties.cluster_id)); map.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom }); });
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
          if (queryModeRef.current !== "territory" || !layerStateRef.current.boundaries) return;`;
const newHandlers = `        map.on("click", "hotspot-clusters", async (event) => { if (queryModeRef.current !== "hotspot") return; const cluster = event.features?.[0]; if (!cluster || cluster.geometry.type !== "Point") return; const source = map.getSource("hotspots") as GeoJSONSource; const zoom = await source.getClusterExpansionZoom(Number(cluster.properties.cluster_id)); map.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom }); });
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
          if (queryModeRef.current !== "territory" || !layerStateRef.current.boundaries) return;`;
component = replaceOnce(component, oldHandlers, newHandlers, "prioridad de clic y selección contextual");

component = replaceOnce(component,
  '    if (queryMode === "context" && !next.runap && !next.anm && !next.anla && !next.anh) setQueryMode("territory");\n    if (queryMode === "coverage" && !next.landCover) setQueryMode("territory");',
  '    if (queryMode === "context" && !next.runap && !next.anm && !next.anla && !next.anh) setQueryMode("hotspot");\n    if (queryMode === "coverage" && !next.landCover) setQueryMode("hotspot");\n    if (queryMode === "territory" && !next.boundaries) setQueryMode("hotspot");\n    if (queryMode === "hotspot" && !next.hotspots) setQueryMode(next.boundaries ? "territory" : next.landCover ? "coverage" : "context");',
  "fallbacks de modo de consulta",
);

const oldQuery = '<div className="query-control"><span>Consulta con clic</span><div role="group" aria-label="Capa consultada al hacer clic"><button type="button" className={queryMode === "territory" ? "active" : ""} disabled={!layers.boundaries} onClick={() => setQueryMode("territory")}>Territorio</button><button type="button" className={queryMode === "coverage" ? "active" : ""} disabled={!layers.landCover} onClick={() => setQueryMode("coverage")}>Cobertura</button><button type="button" className={queryMode === "context" ? "active" : ""} disabled={!hasVisibleContext} onClick={() => setQueryMode("context")}>Contexto</button></div></div>';
const newQuery = '<div className="query-control"><span>Consulta con clic</span><div role="group" aria-label="Capa consultada al hacer clic"><button type="button" className={queryMode === "hotspot" ? "active" : ""} aria-pressed={queryMode === "hotspot"} disabled={!layers.hotspots} onClick={() => setQueryMode("hotspot")}>Detección</button><button type="button" className={queryMode === "territory" ? "active" : ""} aria-pressed={queryMode === "territory"} disabled={!layers.boundaries} onClick={() => setQueryMode("territory")}>Territorio</button><button type="button" className={queryMode === "coverage" ? "active" : ""} aria-pressed={queryMode === "coverage"} disabled={!layers.landCover} onClick={() => setQueryMode("coverage")}>Cobertura</button><button type="button" className={queryMode === "context" ? "active" : ""} aria-pressed={queryMode === "context"} disabled={!hasVisibleContext} onClick={() => setQueryMode("context")}>Contexto</button></div></div>';
component = replaceOnce(component, oldQuery, newQuery, "controles explícitos de consulta");

css = replaceOnce(css,
  '.query-control > div { display: grid; grid-template-columns: repeat(3, 1fr); padding: 2px; border-radius: 6px; background: #edf1ed; }',
  '.query-control > div { display: grid; grid-template-columns: repeat(2, 1fr); padding: 2px; border-radius: 6px; background: #edf1ed; }',
  "grid de modos de consulta",
);
const popupAnchor = '.geovisor-popup strong { max-width: 180px; color: #28372e; text-align: right; }';
css = replaceOnce(css, popupAnchor, `${popupAnchor}\n.geovisor-context-selection { min-width: 250px; max-width: 340px; display: grid; gap: 8px; }\n.context-match-heading { display: grid; gap: 2px; color: #425148; font-size: 10px; }\n.context-match-heading strong { color: #244632; font-size: 11px; }\n.context-match-selector { display: grid; gap: 4px; color: #526158; font-size: 9px; font-weight: 700; }\n.context-match-selector select { width: 100%; min-height: 36px; padding: 5px 8px; border: 1px solid #c7d2c9; border-radius: 6px; background: white; color: #26372d; font-size: 10px; }`, "estilo selector contextual");

writeFileSync(componentPath, component);
writeFileSync(cssPath, css);
console.log("MB-09B interacción: prioridad por modo y coincidencias múltiples aplicadas.");
