import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`No se encontró: ${label}`);
  if (source.indexOf(from) !== source.lastIndexOf(from)) throw new Error(`Fragmento duplicado: ${label}`);
  return source.replace(from, to);
}

const pagePath = "app/page.tsx";
const mapPath = "components/public-detection-geovisor-map.tsx";
const cssPath = "app/globals.css";
let page = readFileSync(pagePath, "utf8");
let map = readFileSync(mapPath, "utf8");
let css = readFileSync(cssPath, "utf8");

page = replaceOnce(
  page,
  'type MapMode = "geovisor" | "basic";\ntype Territory =',
  'type MapMode = "geovisor" | "basic";\nconst UNASSIGNED_TERRITORY = "__unassigned_territory__";\nconst UNASSIGNED_LAND_COVER = "__unassigned_land_cover__";\ntype Territory =',
  "constantes de no asignación",
);
page = replaceOnce(
  page,
  '  dates: string[]; sources: string[]; departments: Territory[]; municipalities: Municipality[]; landCovers?: LandCover[]; points: PointRow[];',
  '  dates: string[]; sources: string[]; confidences: string[]; departments: Territory[]; municipalities: Municipality[]; landCovers?: LandCover[]; points: PointRow[];',
  "catálogo de confianza",
);
page = replaceOnce(
  page,
  '  const selectedDepartmentIndex = departmentIndex.get(departmentCode), selectedMunicipalityIndex = municipalityIndex.get(municipalityCode);\n  const municipalityOptions = useMemo(() => dashboard.municipalities.filter((item) => item.departmentCode === departmentCode), [departmentCode]);',
  '  const selectedDepartmentIndex = departmentIndex.get(departmentCode), selectedMunicipalityIndex = municipalityIndex.get(municipalityCode);\n  const municipalityOptions = useMemo(() => dashboard.municipalities.filter((item) => item.departmentCode === departmentCode), [departmentCode]);\n  const dataGaps = useMemo(() => ({\n    territory: dashboard.points.filter((point) => point[7] === 1 && point[2] < 0).length,\n    coverage: dashboard.points.filter((point) => point[7] === 1 && ((point[12] ?? -1) < 0)).length,\n  }), []);',
  "conteos de reconciliación",
);
page = replaceOnce(
  page,
  '    if (selectedDepartmentIndex !== undefined && point[2] !== selectedDepartmentIndex) return false;\n    if (selectedMunicipalityIndex !== undefined && point[3] !== selectedMunicipalityIndex) return false;',
  '    if (departmentCode === UNASSIGNED_TERRITORY && point[2] >= 0) return false;\n    if (departmentCode !== UNASSIGNED_TERRITORY && selectedDepartmentIndex !== undefined && point[2] !== selectedDepartmentIndex) return false;\n    if (selectedMunicipalityIndex !== undefined && point[3] !== selectedMunicipalityIndex) return false;',
  "filtro de territorio sin asignación",
);
page = replaceOnce(
  page,
  '    if (landCoverLevel !== "all" && (point[12] === undefined || point[12] < 0 || landCovers[point[12]]?.level1Code !== landCoverLevel)) return false;',
  '    if (landCoverLevel === UNASSIGNED_LAND_COVER && (point[12] ?? -1) >= 0) return false;\n    if (landCoverLevel !== "all" && landCoverLevel !== UNASSIGNED_LAND_COVER && (point[12] === undefined || point[12] < 0 || landCovers[point[12]]?.level1Code !== landCoverLevel)) return false;',
  "filtro de cobertura sin asignación",
);
page = replaceOnce(
  page,
  '    const byMunicipality = departmentCode !== "00", counts = new Map<number, number>();',
  '    if (departmentCode === UNASSIGNED_TERRITORY) return visiblePoints.length ? [{ name: "Sin territorio asignado", value: visiblePoints.length }] : [];\n    const byMunicipality = selectedDepartmentIndex !== undefined, counts = new Map<number, number>();',
  "ranking de no asignados",
);
page = replaceOnce(
  page,
  '  }, [visiblePoints, departmentCode]);',
  '  }, [visiblePoints, selectedDepartmentIndex, departmentCode]);',
  "dependencias de ranking",
);
page = replaceOnce(
  page,
  '  const selectedDepartment = dashboard.departments.find((item) => item.code === departmentCode), selectedMunicipality = dashboard.municipalities.find((item) => item.code === municipalityCode);\n  const title = selectedMunicipality?.name ?? selectedDepartment?.name ?? "Colombia", generated = labelColombiaDateTime(dashboard.metadata.generatedAtUtc);',
  '  const selectedDepartment = dashboard.departments.find((item) => item.code === departmentCode), selectedMunicipality = dashboard.municipalities.find((item) => item.code === municipalityCode);\n  const title = departmentCode === UNASSIGNED_TERRITORY ? "Sin territorio asignado" : selectedMunicipality?.name ?? selectedDepartment?.name ?? "Colombia", generated = labelColombiaDateTime(dashboard.metadata.generatedAtUtc);\n  const mapDepartmentCode = departmentCode === UNASSIGNED_TERRITORY ? "00" : departmentCode;\n  const mapMunicipalityCode = departmentCode === UNASSIGNED_TERRITORY ? "00000" : municipalityCode;',
  "título y estado cartográfico seguro",
);
page = replaceOnce(
  page,
  '<select value={departmentCode} onChange={(e) => { setDepartmentCode(e.target.value); setMunicipalityCode("00000"); }}><option value="00">Todos los departamentos</option>{dashboard.departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>',
  '<select value={departmentCode} onChange={(e) => { setDepartmentCode(e.target.value); setMunicipalityCode("00000"); }}><option value="00">Todos los departamentos</option><option value={UNASSIGNED_TERRITORY}>Sin territorio asignado ({numberFormat.format(dataGaps.territory)})</option>{dashboard.departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>',
  "opción sin territorio",
);
page = replaceOnce(
  page,
  '<select value={municipalityCode} disabled={departmentCode === "00"} onChange={(e) => setMunicipalityCode(e.target.value)}>',
  '<select value={municipalityCode} disabled={departmentCode === "00" || departmentCode === UNASSIGNED_TERRITORY} onChange={(e) => setMunicipalityCode(e.target.value)}>',
  "municipio deshabilitado para no asignados",
);
page = replaceOnce(
  page,
  '<select value={landCoverLevel} disabled={!landCovers.length} onChange={(e) => setLandCoverLevel(e.target.value)}><option value="all">Todas las coberturas</option>{landCoverLevels.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select>',
  '<select value={landCoverLevel} disabled={!landCovers.length} onChange={(e) => setLandCoverLevel(e.target.value)}><option value="all">Todas las coberturas</option><option value={UNASSIGNED_LAND_COVER}>Sin cobertura asignada ({numberFormat.format(dataGaps.coverage)})</option>{landCoverLevels.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select>',
  "opción sin cobertura",
);
page = replaceOnce(
  page,
  '      <button className="reset-button" onClick={reset}><RefreshCw size={16} /> Restablecer</button>\n    </section>\n    <section className="metrics-grid">',
  '      <button className="reset-button" onClick={reset}><RefreshCw size={16} /> Restablecer</button>\n    </section>\n    <section className="interpretation-strip" aria-label="Claves para interpretar y reconciliar los datos">\n      <p><strong>Sin asignación:</strong> {numberFormat.format(dataGaps.territory)} detecciones del universo operativo no tienen territorio y {numberFormat.format(dataGaps.coverage)} no tienen cobertura; ambas categorías pueden aislarse desde los filtros.</p>\n      <p><strong>Confianza:</strong> VIIRS usa categorías Baja/Nominal/Alta y MODIS usa 0–100 %. No son escalas intercambiables ni probabilidades de incendio.</p>\n      <p><strong>Situación ANLA:</strong> es multietiqueta; una detección puede relacionarse con proyectos en evaluación y licenciados simultáneamente, por lo que los subtotales no deben sumarse.</p>\n    </section>\n    <section className="metrics-grid">',
  "franja de interpretabilidad",
);
page = replaceOnce(
  page,
  '<MapWorkspace mode={mapMode} points={visiblePoints} dates={dashboard.dates} sources={dashboard.sources} departmentCode={departmentCode} municipalityCode={municipalityCode}',
  '<MapWorkspace mode={mapMode} points={visiblePoints} dates={dashboard.dates} sources={dashboard.sources} confidences={dashboard.confidences} departmentCode={mapDepartmentCode} municipalityCode={mapMunicipalityCode}',
  "propagación de confianza y código cartográfico",
);

map = replaceOnce(
  map,
  'function hotspotGeoJson(points: PointRow[], dates: string[], sources: string[]): GeoJSON.FeatureCollection<GeoJSON.Point> {',
  'function confidenceScaleLabel(source: unknown) {\n  const name = present(source);\n  if (name.startsWith("VIIRS")) return "Categoría VIIRS (Baja/Nominal/Alta)";\n  if (name.startsWith("MODIS")) return "MODIS (0–100 %)";\n  return "Escala propia del producto";\n}\nfunction hotspotGeoJson(points: PointRow[], dates: string[], sources: string[], confidences: string[]): GeoJSON.FeatureCollection<GeoJSON.Point> {',
  "escala de confianza por sensor",
);
map = replaceOnce(
  map,
  '      frp: point[8], confidence: point[9], protected: point[11] === 1, mining: point[13] === 1,',
  '      frp: point[8], confidence: confidences[point[9]] ?? "Sin dato", protected: point[11] === 1, mining: point[13] === 1,',
  "decodificación del confidenceIndex",
);
map = replaceOnce(
  map,
  '    popupRow("FRP", p.frp == null ? "Sin dato" : humanNumber(p.frp, " MW")), popupRow("Confianza", humanNumber(p.confidence)),\n    popupRow("RUNAP", p.protected ? "Dentro" : "Fuera"),',
  '    popupRow("FRP", p.frp == null ? "Sin dato" : humanNumber(p.frp, " MW")), popupRow("Confianza", present(p.confidence) || "Sin dato"),\n    popupRow("Escala de confianza", confidenceScaleLabel(p.source)), popupRow("Lectura", "Indicador del producto; no es probabilidad de incendio ni escala comparable entre sensores"),\n    popupRow("RUNAP", p.protected ? "Dentro" : "Fuera"),',
  "popup de confianza",
);
map = replaceOnce(
  map,
  'export function PublicDetectionGeovisorMap({ departments, municipalities, departmentNames, municipalityNames, points, dates, sources, departmentCode, municipalityCode, onDepartment, onMunicipality }: {\n  departments: FeatureCollection; municipalities: FeatureCollection; departmentNames: TerritoryNames; municipalityNames: TerritoryNames;\n  points: PointRow[]; dates: string[]; sources: string[]; departmentCode: string; municipalityCode: string; onDepartment: (code: string) => void; onMunicipality: (code: string) => void;',
  'export function PublicDetectionGeovisorMap({ departments, municipalities, departmentNames, municipalityNames, points, dates, sources, confidences, departmentCode, municipalityCode, onDepartment, onMunicipality }: {\n  departments: FeatureCollection; municipalities: FeatureCollection; departmentNames: TerritoryNames; municipalityNames: TerritoryNames;\n  points: PointRow[]; dates: string[]; sources: string[]; confidences: string[]; departmentCode: string; municipalityCode: string; onDepartment: (code: string) => void; onMunicipality: (code: string) => void;',
  "prop de confidences",
);
map = replaceOnce(
  map,
  '  const hotspotData = useMemo(() => hotspotGeoJson(points, dates, sources), [points, dates, sources]);',
  '  const hotspotData = useMemo(() => hotspotGeoJson(points, dates, sources, confidences), [points, dates, sources, confidences]);',
  "memo de hotspots",
);

css = replaceOnce(
  css,
  '.filterbar input:focus-visible, .filterbar select:focus-visible, .reset-button:focus-visible, .segmented button:focus-visible, .trend-toggle button:focus-visible, .notice a:focus-visible, footer a:focus-visible { outline: 3px solid #2f6844; outline-offset: 2px; }\n.metrics-grid { margin-top: 14px;',
  '.filterbar input:focus-visible, .filterbar select:focus-visible, .reset-button:focus-visible, .segmented button:focus-visible, .trend-toggle button:focus-visible, .notice a:focus-visible, footer a:focus-visible { outline: 3px solid #2f6844; outline-offset: 2px; }\n.interpretation-strip { margin-top: 10px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }\n.interpretation-strip p { margin: 0; padding: 9px 11px; border: 1px solid #d9e2db; border-radius: 8px; background: #f8faf8; color: #526158; font-size: 10.5px; line-height: 1.45; }\n.interpretation-strip strong { color: #2d4736; }\n.metrics-grid { margin-top: 14px;',
  "estilos de interpretación",
);
css = replaceOnce(
  css,
  '@media (max-width: 980px) {\n  .filterbar { grid-template-columns: repeat(3, 1fr); }',
  '@media (max-width: 980px) {\n  .filterbar { grid-template-columns: repeat(3, 1fr); }\n  .interpretation-strip { grid-template-columns: 1fr; }',
  "responsive de interpretación",
);

writeFileSync(pagePath, page);
writeFileSync(mapPath, map);
writeFileSync(cssPath, css);
console.log("MB-06 aplicado: no asignados, confianza decodificada y ANLA multietiqueta.");
