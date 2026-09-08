import { readFileSync, writeFileSync } from "node:fs";

const pagePath = "app/page.tsx";
let page = readFileSync(pagePath, "utf8");

const replacements = [
  ['import { DashboardMap, type FeatureCollection, type PointRow } from "@/components/dashboard-map";', 'import type { PointRow } from "@/components/dashboard-map";'],
  ['import { GeovisorMap } from "@/components/geovisor-map";\n', ''],
  ['import departmentGeoJson from "@/public/data/departments.json";\n', ''],
  ['import municipalityGeoJson from "@/public/data/municipalities.json";\n', ''],
  ['const departmentsGeo = departmentGeoJson as unknown as FeatureCollection;\n', ''],
  ['const municipalitiesGeo = municipalityGeoJson as unknown as FeatureCollection;\n', ''],
];
for (const [from, to] of replacements) {
  if (!page.includes(from)) throw new Error(`No se encontró el fragmento esperado: ${from}`);
  page = page.replace(from, to);
}

const chartAnchor = `const TrendChart = dynamic(() => import("@/components/dashboard-charts").then((module) => module.TrendChart), {
  ssr: false,
  loading: () => <div className="chart-loading" aria-hidden="true">Preparando gráfico…</div>,
});
`;
if (!page.includes(chartAnchor)) throw new Error("No se encontró el ancla dinámica de gráficos.");
page = page.replace(chartAnchor, `${chartAnchor}
const MapWorkspace = dynamic(() => import("@/components/dashboard-map-workspace").then((module) => module.DashboardMapWorkspace), {
  ssr: false,
  loading: () => <div className="geovisor-loading"><span /> Preparando cartografía…</div>,
});
`);

const mapPattern = /\{mapMode === "geovisor" \? <GeovisorMap[\s\S]*?<\/DashboardMap>\}/;
const exactStart = '{mapMode === "geovisor" ? <GeovisorMap';
if (!page.includes(exactStart)) throw new Error("No se encontró el render cartográfico actual.");
const linePattern = /\{mapMode === "geovisor" \? <GeovisorMap[^\n]+/;
const match = page.match(linePattern);
if (!match) throw new Error("No se pudo aislar la línea cartográfica.");
page = page.replace(match[0], '<MapWorkspace mode={mapMode} points={visiblePoints} dates={dashboard.dates} sources={dashboard.sources} departmentCode={departmentCode} municipalityCode={municipalityCode} onDepartment={(code) => { setDepartmentCode(code); setMunicipalityCode("00000"); }} onMunicipality={setMunicipalityCode} />');

writeFileSync(pagePath, page);
console.log("MB-04: workspace cartográfico extraído del chunk principal.");
