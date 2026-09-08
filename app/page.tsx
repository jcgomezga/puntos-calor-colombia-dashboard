"use client";

import { Activity, Building2, CalendarDays, ChevronDown, CircleAlert, Database, Flame, Fuel, Instagram, Layers3, Leaf, Linkedin, MapPinned, Pickaxe, Radio, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { PointRow } from "@/components/dashboard-map";
import { HISTORY_START_LABEL } from "@/lib/data-policy";
import dashboardJson from "@/public/data/dashboard.json";
import historyJson from "@/public/data/history.json";

type ProtectedRelation = "all" | "inside" | "outside";
type MiningRelation = "all" | "inside" | "outside";
type AnlaRelation = "all" | "inside" | "within1" | "between1and5" | "beyond5";
type AnlaLegalStatus = "all" | "evaluation" | "licensed";
type AnhRelation = "all" | "inside" | "within1" | "between1and5" | "beyond5";
type TrendGrouping = "day" | "month";
type MapMode = "geovisor" | "basic";
const UNASSIGNED_TERRITORY = "__unassigned_territory__";
const UNASSIGNED_LAND_COVER = "__unassigned_land_cover__";
type Territory = { code: string; name: string; countA: number; countB: number };
type Municipality = Territory & { departmentCode: string; areaKm2: number | null };
type LandCover = { code: string; label: string; level1: string; level1Code: string; level2: string; level3: string };
type DashboardData = {
  metadata: {
    generatedAtUtc: string; historyStartDate: string; lastObservationDate: string; totalRows: number; territorialStatus: Record<string, number>;
    protectedAreas?: { featureCount: number; insideRows: number; outsideRows: number; overlapRows: number };
    landCover?: { year: number; assignedRows: number; unassignedRows: number; catalogSize: number };
    miningTitles?: { featureCount: number; insideRows: number; outsideRows: number; overlapRows: number; intersectedTitles: number };
    anlaProjects?: { featureCount: number; usableGeometryCount: number; nullGeometryCount: number; insideRows: number; within1KmRows: number; between1And5KmRows: number; beyond5KmRows: number; withEvaluationRows: number; withLicensedRows: number; relatedFeatures: number };
    anhContracts?: { featureCount: number; assignedFeatureCount: number; excludedNonAssignedCount: number; usableAssignedGeometryCount: number; insideRows: number; within1KmRows: number; between1And5KmRows: number; beyond5KmRows: number; relatedAssignedAreas: number; sourceDate: string };
  };
  dates: string[]; sources: string[]; confidences: string[]; departments: Territory[]; municipalities: Municipality[]; landCovers?: LandCover[]; points: PointRow[];
};
type HistoryData = { metadata: { openMonth: string; closedMonths: string[]; totalRows: number; scenarioBRows: number } };

const dashboard = dashboardJson as unknown as DashboardData;
const history = historyJson as unknown as HistoryData;
const numberFormat = new Intl.NumberFormat("es-CO");
const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric", timeZone: "UTC" });
const colombiaDateTimeParts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Bogota" });
const shortMonths = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const LAND_COVER_FAMILY_NAMES: Record<string, string> = {
  "1": "Territorios artificializados",
  "2": "Áreas agrícolas",
  "3": "Bosques y áreas seminaturales",
  "4": "Áreas húmedas",
  "5": "Superficies de agua",
};

const RankingChart = dynamic(() => import("@/components/dashboard-charts").then((module) => module.RankingChart), {
  ssr: false,
  loading: () => <div className="chart-loading" aria-hidden="true">Preparando gráfico…</div>,
});
const TrendChart = dynamic(() => import("@/components/dashboard-charts").then((module) => module.TrendChart), {
  ssr: false,
  loading: () => <div className="chart-loading" aria-hidden="true">Preparando gráfico…</div>,
});

const MapWorkspace = dynamic(() => import("@/components/dashboard-map-workspace").then((module) => module.DashboardMapWorkspace), {
  ssr: false,
  loading: () => <div className="geovisor-loading"><span /> Preparando cartografía…</div>,
});

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Flame; label: string; value: string; detail: string }) {
  return <article className="metric-card"><div className="metric-icon"><Icon size={18} /></div><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></article>;
}
function labelDate(value: string) { return dateFormat.format(new Date(`${value}T12:00:00Z`)).replace(" de ", " "); }
function labelMonth(value: string) { return monthFormat.format(new Date(`${value}-15T12:00:00Z`)).replace(" de ", " "); }
function labelColombiaDateTime(value: string) {
  const parts = Object.fromEntries(colombiaDateTimeParts.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour), hour12 = hour % 12 || 12;
  return `${Number(parts.day)} ${shortMonths[Number(parts.month) - 1]} ${parts.year}, ${hour12}:${parts.minute} ${hour < 12 ? "a. m." : "p. m."}`;
}

export default function Home() {
  const [departmentCode, setDepartmentCode] = useState("00"), [municipalityCode, setMunicipalityCode] = useState("00000");
  const [startDate, setStartDate] = useState(dashboard.metadata.historyStartDate), [endDate, setEndDate] = useState(dashboard.metadata.lastObservationDate);
  const [protectedRelation, setProtectedRelation] = useState<ProtectedRelation>("all"), [miningRelation, setMiningRelation] = useState<MiningRelation>("all");
  const [anlaRelation, setAnlaRelation] = useState<AnlaRelation>("all"), [anlaLegalStatus, setAnlaLegalStatus] = useState<AnlaLegalStatus>("all"), [anhRelation, setAnhRelation] = useState<AnhRelation>("all");
  const [trendGrouping, setTrendGrouping] = useState<TrendGrouping>("day"), [mapMode, setMapMode] = useState<MapMode>("geovisor"), [landCoverLevel, setLandCoverLevel] = useState("all");
  const landCovers = useMemo(() => dashboard.landCovers ?? [], []);
  const landCoverLevels = useMemo(() => [...new Map(landCovers.map((item) => [item.level1Code, LAND_COVER_FAMILY_NAMES[item.level1Code] ?? item.level1 ?? item.level1Code])).entries()].sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true })), [landCovers]);
  const departmentIndex = useMemo(() => new Map(dashboard.departments.map((item, index) => [item.code, index])), []);
  const municipalityIndex = useMemo(() => new Map(dashboard.municipalities.map((item, index) => [item.code, index])), []);
  const startIndex = Math.max(0, dashboard.dates.indexOf(startDate)), rawEndIndex = dashboard.dates.indexOf(endDate), endIndex = rawEndIndex < 0 ? dashboard.dates.length - 1 : rawEndIndex;
  const selectedDepartmentIndex = departmentIndex.get(departmentCode), selectedMunicipalityIndex = municipalityIndex.get(municipalityCode);
  const municipalityOptions = useMemo(() => dashboard.municipalities.filter((item) => item.departmentCode === departmentCode), [departmentCode]);
  const dataGaps = useMemo(() => ({
    territory: dashboard.points.filter((point) => point[7] === 1 && point[2] < 0).length,
    coverage: dashboard.points.filter((point) => point[7] === 1 && ((point[12] ?? -1) < 0)).length,
  }), []);

  const visiblePoints = useMemo(() => dashboard.points.filter((point) => {
    if (point[7] !== 1) return false;
    if (point[4] < startIndex || point[4] > endIndex) return false;
    if (departmentCode === UNASSIGNED_TERRITORY && point[2] >= 0) return false;
    if (departmentCode !== UNASSIGNED_TERRITORY && selectedDepartmentIndex !== undefined && point[2] !== selectedDepartmentIndex) return false;
    if (selectedMunicipalityIndex !== undefined && point[3] !== selectedMunicipalityIndex) return false;
    if (protectedRelation === "inside" && point[11] !== 1) return false;
    if (protectedRelation === "outside" && point[11] === 1) return false;
    if (landCoverLevel === UNASSIGNED_LAND_COVER && (point[12] ?? -1) >= 0) return false;
    if (landCoverLevel !== "all" && landCoverLevel !== UNASSIGNED_LAND_COVER && (point[12] === undefined || point[12] < 0 || landCovers[point[12]]?.level1Code !== landCoverLevel)) return false;
    if (miningRelation === "inside" && point[13] !== 1) return false;
    if (miningRelation === "outside" && point[13] === 1) return false;
    if (anlaRelation === "inside" && point[14] !== 3) return false;
    if (anlaRelation === "within1" && point[14] !== 2) return false;
    if (anlaRelation === "between1and5" && point[14] !== 1) return false;
    if (anlaRelation === "beyond5" && point[14] !== 0) return false;
    if (anlaLegalStatus === "evaluation" && ((point[15] ?? 0) & 1) === 0) return false;
    if (anlaLegalStatus === "licensed" && ((point[15] ?? 0) & 2) === 0) return false;
    if (anhRelation === "inside" && point[16] !== 3) return false;
    if (anhRelation === "within1" && point[16] !== 2) return false;
    if (anhRelation === "between1and5" && point[16] !== 1) return false;
    if (anhRelation === "beyond5" && point[16] !== 0) return false;
    return true;
  }), [startIndex, endIndex, departmentCode, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, landCovers]);

  const metrics = useMemo(() => {
    const departments = new Set<number>(), municipalities = new Set<number>(), sources = new Set<number>(), covers = new Set<number>();
    for (const point of visiblePoints) { if (point[2] >= 0) departments.add(point[2]); if (point[3] >= 0) municipalities.add(point[3]); sources.add(point[6]); if ((point[12] ?? -1) >= 0) covers.add(point[12]!); }
    return { departments: departments.size, municipalities: municipalities.size, sources: sources.size, covers: covers.size,
      protected: visiblePoints.filter((p) => p[11] === 1).length, mining: visiblePoints.filter((p) => p[13] === 1).length,
      anla: visiblePoints.filter((p) => (p[14] ?? 0) > 0).length, anh: visiblePoints.filter((p) => (p[16] ?? 0) > 0).length };
  }, [visiblePoints]);
  const ranking = useMemo(() => {
    if (departmentCode === UNASSIGNED_TERRITORY) return visiblePoints.length ? [{ name: "Sin territorio asignado", value: visiblePoints.length }] : [];
    const byMunicipality = selectedDepartmentIndex !== undefined, counts = new Map<number, number>();
    for (const point of visiblePoints) { const index = byMunicipality ? point[3] : point[2]; if (index >= 0) counts.set(index, (counts.get(index) ?? 0) + 1); }
    const catalog = byMunicipality ? dashboard.municipalities : dashboard.departments;
    return [...counts.entries()].map(([index, value]) => ({ name: catalog[index].name, value })).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [visiblePoints, selectedDepartmentIndex, departmentCode]);
  const trend = useMemo(() => {
    const counts = new Map<string, number>(); for (const point of visiblePoints) { const date = dashboard.dates[point[4]], period = trendGrouping === "day" ? date : date.slice(0, 7); counts.set(period, (counts.get(period) ?? 0) + 1); }
    const periods = [...new Set(dashboard.dates.slice(startIndex, endIndex + 1).map((date) => trendGrouping === "day" ? date : date.slice(0, 7)))];
    return periods.map((period) => ({ period, day: trendGrouping === "day" ? labelDate(period).replace(/ 2026$/, "") : labelMonth(period), label: trendGrouping === "day" ? labelDate(period) : `${labelMonth(period)}${period === history.metadata.openMonth ? " · mes abierto" : ""}`, value: counts.get(period) ?? 0 }));
  }, [visiblePoints, startIndex, endIndex, trendGrouping]);

  const selectedDepartment = dashboard.departments.find((item) => item.code === departmentCode), selectedMunicipality = dashboard.municipalities.find((item) => item.code === municipalityCode);
  const title = departmentCode === UNASSIGNED_TERRITORY ? "Sin territorio asignado" : selectedMunicipality?.name ?? selectedDepartment?.name ?? "Colombia", generated = labelColombiaDateTime(dashboard.metadata.generatedAtUtc);
  const mapDepartmentCode = departmentCode === UNASSIGNED_TERRITORY ? "00" : departmentCode;
  const mapMunicipalityCode = departmentCode === UNASSIGNED_TERRITORY ? "00000" : municipalityCode;
  const rankingHeading = departmentCode === "00" ? "Departamentos con más detecciones" : departmentCode === UNASSIGNED_TERRITORY ? "Detecciones sin territorio asignado" : "Municipios con más detecciones";
  const rankingLabel = departmentCode === "00" ? "Ranking de departamentos con más detecciones" : departmentCode === UNASSIGNED_TERRITORY ? "Detecciones sin territorio asignado" : "Ranking de municipios con más detecciones";
  const reset = () => { setDepartmentCode("00"); setMunicipalityCode("00000"); setStartDate(dashboard.metadata.historyStartDate); setEndDate(dashboard.metadata.lastObservationDate); setProtectedRelation("all"); setLandCoverLevel("all"); setMiningRelation("all"); setAnlaRelation("all"); setAnlaLegalStatus("all"); setAnhRelation("all"); };

  return <main className="dashboard-shell">
    <header className="topbar"><div className="brand-block"><div className="brand-mark"><Flame size={21} /></div><div><p className="eyebrow">MONITOREO TERRITORIAL · COLOMBIA</p><h1>Análisis espacial de detecciones de calor en zonas con potencial uso extractivista</h1></div></div><div className="status-cluster"><span className="official-badge">DATOS OFICIALES PROCESADOS</span><span className="status-chip"><CalendarDays size={14} /> Histórico desde {HISTORY_START_LABEL}</span><span className="status-chip"><span className="pulse" /> Actualizado: {generated}</span></div></header>
    <nav className="social-links" aria-label="Redes sociales de Juan Carlos Gómez García">
      <a className="social-link instagram" href="https://www.instagram.com/juancgomezg_/" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Juan Carlos Gómez García" title="Instagram"><Instagram size={16} aria-hidden="true" /></a>
      <a className="social-link linkedin" href="https://www.linkedin.com/in/jcgomezga/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn de Juan Carlos Gómez García" title="LinkedIn"><Linkedin size={16} aria-hidden="true" /></a>
    </nav>
    <section className="notice" aria-label="Advertencia metodológica"><CircleAlert size={18} /><p><strong>Lectura responsable:</strong> cada punto representa una detección térmica satelital reportada por IDEAM. No confirma por sí sola un incendio, su extensión ni su causa. Los cruces territoriales expresan coincidencia o proximidad espacial, no causalidad. El portal presenta un <strong>universo operativo</strong> sometido a criterios de control de calidad; algunos registros pueden no tener asignación territorial o de cobertura y permanecen en el total general. <Link href="/metodologia" className="font-semibold text-[#6a452a] underline underline-offset-2">Ver metodología y alcance</Link>.</p></section>
    <section className="filterbar" aria-label="Filtros territoriales">
      <label><span>Desde</span><input type="date" min={dashboard.metadata.historyStartDate} max={endDate} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label><span>Hasta</span><input type="date" min={startDate} max={dashboard.metadata.lastObservationDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      <label><span>Departamento</span><div className="select-wrap"><select value={departmentCode} onChange={(e) => { setDepartmentCode(e.target.value); setMunicipalityCode("00000"); }}><option value="00">Todos los departamentos</option><option value={UNASSIGNED_TERRITORY}>Sin territorio asignado ({numberFormat.format(dataGaps.territory)})</option>{dashboard.departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Municipio</span><div className="select-wrap"><select value={municipalityCode} disabled={departmentCode === "00" || departmentCode === UNASSIGNED_TERRITORY} onChange={(e) => setMunicipalityCode(e.target.value)}><option value="00000">Todos los municipios</option>{municipalityOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Área protegida</span><div className="select-wrap"><select value={protectedRelation} onChange={(e) => setProtectedRelation(e.target.value as ProtectedRelation)}><option value="all">Todas las detecciones</option><option value="inside">Dentro de RUNAP</option><option value="outside">Fuera de RUNAP</option></select><ChevronDown size={16} /></div></label>
      <label><span>Cobertura 2024</span><div className="select-wrap"><select value={landCoverLevel} disabled={!landCovers.length} onChange={(e) => setLandCoverLevel(e.target.value)}><option value="all">Todas las coberturas</option><option value={UNASSIGNED_LAND_COVER}>Sin cobertura asignada ({numberFormat.format(dataGaps.coverage)})</option>{landCoverLevels.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Título minero</span><div className="select-wrap"><select value={miningRelation} disabled={!dashboard.metadata.miningTitles} onChange={(e) => setMiningRelation(e.target.value as MiningRelation)}><option value="all">Todas las detecciones</option><option value="inside">Dentro de título vigente</option><option value="outside">Fuera de título vigente</option></select><ChevronDown size={16} /></div></label>
      <label><span>Relación con proyecto ANLA</span><div className="select-wrap"><select value={anlaRelation} disabled={!dashboard.metadata.anlaProjects} onChange={(e) => setAnlaRelation(e.target.value as AnlaRelation)}><option value="all">Todas las detecciones</option><option value="inside">Dentro de área de proyecto</option><option value="within1">Hasta 1 km</option><option value="between1and5">Entre 1 y 5 km</option><option value="beyond5">A más de 5 km</option></select><ChevronDown size={16} /></div></label>
      <label><span>Situación ANLA</span><div className="select-wrap"><select value={anlaLegalStatus} disabled={!dashboard.metadata.anlaProjects} title="Las situaciones ANLA no son excluyentes: una detección puede relacionarse con varios proyectos en situaciones diferentes." onChange={(e) => setAnlaLegalStatus(e.target.value as AnlaLegalStatus)}><option value="all">Todas las situaciones</option><option value="evaluation">En evaluación</option><option value="licensed">Licenciados</option></select><ChevronDown size={16} /></div></label>
      <label><span>Área contractual ANH</span><div className="select-wrap"><select value={anhRelation} disabled={!dashboard.metadata.anhContracts} onChange={(e) => setAnhRelation(e.target.value as AnhRelation)}><option value="all">Todas las detecciones</option><option value="inside">Dentro de área asignada</option><option value="within1">Hasta 1 km</option><option value="between1and5">Entre 1 y 5 km</option><option value="beyond5">A más de 5 km</option></select><ChevronDown size={16} /></div></label>
      <button className="reset-button" onClick={reset}><RefreshCw size={16} /> Restablecer</button>
    </section>
    <section className="interpretation-strip" aria-label="Claves para interpretar y reconciliar los datos">
      <p><strong>Sin asignación:</strong> {numberFormat.format(dataGaps.territory)} detecciones del universo operativo no tienen territorio y {numberFormat.format(dataGaps.coverage)} no tienen cobertura; ambas categorías pueden aislarse desde los filtros.</p>
      <p><strong>Confianza:</strong> VIIRS usa categorías Baja/Nominal/Alta y MODIS usa 0–100 %. No son escalas intercambiables ni probabilidades de incendio.</p>
      <p><strong>Situación ANLA:</strong> es multietiqueta; una detección puede relacionarse con proyectos en evaluación y licenciados simultáneamente, por lo que los subtotales no deben sumarse.</p>
    </section>
    <section className="metrics-grid">
      <MetricCard icon={Flame} label="Detecciones visibles" value={numberFormat.format(visiblePoints.length)} detail={`${labelDate(startDate)}–${labelDate(endDate)}`} /><MetricCard icon={MapPinned} label="Departamentos" value={numberFormat.format(metrics.departments)} detail="Con al menos una detección asignada" /><MetricCard icon={Activity} label="Municipios" value={numberFormat.format(metrics.municipalities)} detail="Asignación oficial DANE 2025" /><MetricCard icon={Radio} label="Fuentes satelitales" value={numberFormat.format(metrics.sources)} detail="Universo operativo publicado" /><MetricCard icon={Leaf} label="Dentro de áreas protegidas" value={numberFormat.format(metrics.protected)} detail="Intersección espacial con RUNAP" /><MetricCard icon={Layers3} label="Coberturas detalladas" value={numberFormat.format(metrics.covers)} detail="IDEAM 2024 · escala 1:100.000" /><MetricCard icon={Pickaxe} label="Dentro de títulos mineros" value={numberFormat.format(metrics.mining)} detail="Intersección directa con títulos ANM" /><MetricCard icon={Building2} label="Relacionadas con proyectos ANLA" value={numberFormat.format(metrics.anla)} detail="Dentro o hasta 5 km · sin inferir causalidad" /><MetricCard icon={Fuel} label="Relacionadas con contratos ANH" value={numberFormat.format(metrics.anh)} detail="Áreas asignadas dentro o hasta 5 km" />
    </section>
    <section className="workspace-grid"><article className="panel map-panel"><div className="panel-heading"><div><p className="panel-kicker">DISTRIBUCIÓN ESPACIAL</p><h2>{title}</h2></div><div className="segmented" role="group" aria-label="Modo de mapa"><button className={mapMode === "geovisor" ? "active" : ""} aria-pressed={mapMode === "geovisor"} onClick={() => setMapMode("geovisor")}>Geovisor</button><button className={mapMode === "basic" ? "active" : ""} aria-pressed={mapMode === "basic"} onClick={() => setMapMode("basic")}>Mapa básico</button></div></div><div className="map-surface">
      <MapWorkspace mode={mapMode} points={visiblePoints} dates={dashboard.dates} sources={dashboard.sources} confidences={dashboard.confidences} departmentCode={mapDepartmentCode} municipalityCode={mapMunicipalityCode} onDepartment={(code) => { setDepartmentCode(code); setMunicipalityCode("00000"); }} onMunicipality={setMunicipalityCode} />
      <div className="map-caption">{mapMode === "geovisor" ? "Navega y acerca el mapa, activa las capas y elige qué deseas consultar: detección, territorio, cobertura o contexto. También puedes desplazar el mapa con teclado y usar «Consultar centro del mapa»." : "Mapa básico: permite seleccionar departamentos y municipios con clic o teclado. Las detecciones son referencia visual y, a escala nacional, se agregan solo para evitar saturación; los conteos analíticos no cambian. Las fichas de detección, cobertura y contexto requieren el Geovisor."}</div></div></article>
      <div className="side-stack"><article className="panel chart-panel"><div className="panel-heading compact"><div><p className="panel-kicker">CONCENTRACIÓN</p><h2>{rankingHeading}</h2></div></div><div className="chart-wrap"><RankingChart data={ranking} label={rankingLabel} /></div></article>
      <article className="panel chart-panel trend-panel"><div className="panel-heading compact"><div><p className="panel-kicker">EVOLUCIÓN TEMPORAL</p><h2>Detecciones por {trendGrouping === "day" ? "día" : "mes"}</h2></div><div className="trend-actions"><span className="open-period">{labelMonth(history.metadata.openMonth)} en curso</span><div className="trend-toggle" role="group" aria-label="Agrupación temporal"><button className={trendGrouping === "day" ? "active" : ""} aria-pressed={trendGrouping === "day"} onClick={() => setTrendGrouping("day")}>Días</button><button className={trendGrouping === "month" ? "active" : ""} aria-pressed={trendGrouping === "month"} onClick={() => setTrendGrouping("month")}>Meses</button></div></div></div><div className="trend-wrap"><TrendChart data={trend} label={`Serie temporal de detecciones por ${trendGrouping === "day" ? "día" : "mes"}`} /></div></article></div>
    </section>
    <section className="audit-strip"><div><Database size={18} /><span><strong>Fuentes</strong> IDEAM · DANE · RUNAP · ANM · ANLA · ANH</span></div><div><CalendarDays size={18} /><span><strong>Histórico acumulativo</strong> desde {HISTORY_START_LABEL}</span></div><div><ShieldCheck size={18} /><span><strong>Interpretación</strong> detecciones térmicas y relaciones espaciales; no equivalen automáticamente a incendios confirmados ni establecen causalidad.</span></div></section>
    <footer><p>Dashboard nacional en desarrollo · Datos actualizados automáticamente.</p><p><Link href="/metodologia" className="font-semibold text-[#425148] underline underline-offset-2">Metodología, fuentes y trazabilidad</Link>.</p></footer>
  </main>;
}
