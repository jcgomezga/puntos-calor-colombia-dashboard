"use client";

import { Activity, Building2, CalendarDays, ChevronDown, ChevronRight, CircleAlert, Database, Flame, Fuel, Layers3, Leaf, MapPinned, Network, Pickaxe, Radio, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardMap, type FeatureCollection, type PointRow } from "@/components/dashboard-map";
import { GeovisorMap } from "@/components/geovisor-map";
import { HISTORY_START_LABEL } from "@/lib/data-policy";
import dashboardJson from "@/public/data/dashboard.json";
import departmentGeoJson from "@/public/data/departments.json";
import historyJson from "@/public/data/history.json";
import municipalityGeoJson from "@/public/data/municipalities.json";

type ProtectedRelation = "all" | "inside" | "outside";
type MiningRelation = "all" | "inside" | "outside";
type AnlaRelation = "all" | "inside" | "within1" | "between1and5" | "beyond5";
type AnlaLegalStatus = "all" | "evaluation" | "licensed";
type AnhRelation = "all" | "inside" | "within1" | "between1and5" | "beyond5";
type TrendGrouping = "day" | "month";
type MapMode = "geovisor" | "basic";
type Territory = { code: string; name: string; countA: number; countB: number };
type Municipality = Territory & { departmentCode: string; areaKm2: number | null };
type LandCover = { code: string; label: string; level1: string; level1Code: string; level2: string; level3: string };
type Episode = { id: string; size: number; start: string; end: string; durationHours: number; longitude: number; latitude: number; chained: boolean; extentKm?: number; departments?: string[]; municipalities?: string[]; frpMeanMw?: number | null; frpMaxMw?: number | null };
type EpisodeChange = { type: string; previousId: string; currentId: string; overlap: number; previousSize: number; currentSize: number };
type DashboardData = {
  metadata: { generatedAtUtc: string; historyStartDate: string; lastObservationDate: string; totalRows: number; scenarioARows: number; scenarioBRows: number; territorialStatus: Record<string, number>; protectedAreas?: { featureCount: number; insideRows: number; outsideRows: number; overlapRows: number }; landCover?: { year: number; assignedRows: number; unassignedRows: number; catalogSize: number }; miningTitles?: { featureCount: number; insideRows: number; outsideRows: number; overlapRows: number; intersectedTitles: number }; anlaProjects?: { featureCount: number; usableGeometryCount: number; nullGeometryCount: number; insideRows: number; within1KmRows: number; between1And5KmRows: number; beyond5KmRows: number; withEvaluationRows: number; withLicensedRows: number; relatedFeatures: number }; anhContracts?: { featureCount: number; assignedFeatureCount: number; excludedNonAssignedCount: number; usableAssignedGeometryCount: number; insideRows: number; within1KmRows: number; between1And5KmRows: number; beyond5KmRows: number; relatedAssignedAreas: number; sourceDate: string }; episodes?: { methodVersion: string; scenario: string; spatialMeters: number; temporalHours: number; minimumMembers: number; episodeCount: number; episodeRows: number; pairCount: number; pairRows: number; isolatedRows: number; chainedEpisodeCount: number; chainedRows: number; lineageEventsThisRun: number; lineageCounts?: Record<string, number> } };
  dates: string[]; sources: string[]; departments: Territory[]; municipalities: Municipality[]; landCovers?: LandCover[]; episodes?: Episode[]; episodeChanges?: EpisodeChange[]; points: PointRow[];
};
type HistoryData = { metadata: { openMonth: string; closedMonths: string[]; totalRows: number; scenarioBRows: number } };

const dashboard = dashboardJson as unknown as DashboardData;
const history = historyJson as unknown as HistoryData;
const departmentsGeo = departmentGeoJson as unknown as FeatureCollection;
const municipalitiesGeo = municipalityGeoJson as unknown as FeatureCollection;
const numberFormat = new Intl.NumberFormat("es-CO");
const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric", timeZone: "UTC" });
const colombiaDateTimeParts = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  hourCycle: "h23", timeZone: "America/Bogota",
});
const shortMonths = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Flame; label: string; value: string; detail: string }) {
  return <article className="metric-card"><div className="metric-icon"><Icon size={18} /></div><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></article>;
}

function labelDate(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00Z`)).replace(" de ", " ");
}

function labelMonth(value: string) {
  return monthFormat.format(new Date(`${value}-15T12:00:00Z`)).replace(" de ", " ");
}

function labelColombiaDateTime(value: string) {
  const parts = Object.fromEntries(colombiaDateTimeParts.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour);
  const hour12 = hour % 12 || 12;
  return `${Number(parts.day)} ${shortMonths[Number(parts.month) - 1]} ${parts.year}, ${hour12}:${parts.minute} ${hour < 12 ? "a. m." : "p. m."}`;
}

export default function Home() {
  const [departmentCode, setDepartmentCode] = useState("00");
  const [municipalityCode, setMunicipalityCode] = useState("00000");
  const [startDate, setStartDate] = useState(dashboard.metadata.historyStartDate);
  const [endDate, setEndDate] = useState(dashboard.metadata.lastObservationDate);
  const [protectedRelation, setProtectedRelation] = useState<ProtectedRelation>("all");
  const [miningRelation, setMiningRelation] = useState<MiningRelation>("all");
  const [anlaRelation, setAnlaRelation] = useState<AnlaRelation>("all");
  const [anlaLegalStatus, setAnlaLegalStatus] = useState<AnlaLegalStatus>("all");
  const [anhRelation, setAnhRelation] = useState<AnhRelation>("all");
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState<number | null>(null);
  const [trendGrouping, setTrendGrouping] = useState<TrendGrouping>("day");
  const [mapMode, setMapMode] = useState<MapMode>("geovisor");
  const [landCoverLevel, setLandCoverLevel] = useState("all");
  const landCovers = useMemo(() => dashboard.landCovers ?? [], []);
  const landCoverLevels = useMemo(() => [...new Map(landCovers.map((item) => [item.level1Code, item.level1])).entries()].sort(), [landCovers]);

  const departmentIndex = useMemo(() => new Map(dashboard.departments.map((item, index) => [item.code, index])), []);
  const municipalityIndex = useMemo(() => new Map(dashboard.municipalities.map((item, index) => [item.code, index])), []);
  const startIndex = Math.max(0, dashboard.dates.indexOf(startDate));
  const rawEndIndex = dashboard.dates.indexOf(endDate);
  const endIndex = rawEndIndex < 0 ? dashboard.dates.length - 1 : rawEndIndex;
  const selectedDepartmentIndex = departmentIndex.get(departmentCode);
  const selectedMunicipalityIndex = municipalityIndex.get(municipalityCode);

  const municipalityOptions = useMemo(() => dashboard.municipalities.filter((item) => item.departmentCode === departmentCode), [departmentCode]);
  const visiblePoints = useMemo(() => dashboard.points.filter((point) => {
    if (point[7] !== 1) return false;
    if (point[4] < startIndex || point[4] > endIndex) return false;
    if (selectedDepartmentIndex !== undefined && point[2] !== selectedDepartmentIndex) return false;
    if (selectedMunicipalityIndex !== undefined && point[3] !== selectedMunicipalityIndex) return false;
    if (protectedRelation === "inside" && point[11] !== 1) return false;
    if (protectedRelation === "outside" && point[11] === 1) return false;
    if (landCoverLevel !== "all" && (point[12] === undefined || point[12] < 0 || landCovers[point[12]]?.level1Code !== landCoverLevel)) return false;
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
  }), [startIndex, endIndex, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, landCovers]);

  const metrics = useMemo(() => {
    const departments = new Set<number>(), municipalities = new Set<number>(), sources = new Set<number>();
    const episodes = new Set<number>(), protectedEpisodes = new Set<number>(), miningEpisodes = new Set<number>();
    const anlaEpisodes = new Set<number>(), anhEpisodes = new Set<number>();
    const covers = new Set<number>();
    for (const point of visiblePoints) {
      sources.add(point[6]);
      const episodeIndex = point[18] ?? -1;
      if (episodeIndex < 0) continue;
      episodes.add(episodeIndex);
      if (point[2] >= 0) departments.add(point[2]);
      if (point[3] >= 0) municipalities.add(point[3]);
      if ((point[12] ?? -1) >= 0) covers.add(point[12]!);
      if (point[11] === 1) protectedEpisodes.add(episodeIndex);
      if (point[13] === 1) miningEpisodes.add(episodeIndex);
      if ((point[14] ?? 0) > 0) anlaEpisodes.add(episodeIndex);
      if ((point[16] ?? 0) > 0) anhEpisodes.add(episodeIndex);
    }
    return {
      departments: departments.size,
      municipalities: municipalities.size,
      sources: sources.size,
      protected: protectedEpisodes.size,
      covers: covers.size,
      mining: miningEpisodes.size,
      anla: anlaEpisodes.size,
      anh: anhEpisodes.size,
      episodes: episodes.size,
    };
  }, [visiblePoints]);

  const episodeRanking = useMemo(() => {
    const counts = new Map<number, number>();
    for (const point of visiblePoints) if ((point[18] ?? -1) >= 0) counts.set(point[18]!, (counts.get(point[18]!) ?? 0) + 1);
    return [...counts.entries()].map(([index, visibleMembers]) => ({ index, visibleMembers, episode: dashboard.episodes?.[index] }))
      .filter((item): item is { index: number; visibleMembers: number; episode: Episode } => Boolean(item.episode))
      .sort((a, b) => b.visibleMembers - a.visibleMembers || b.episode.size - a.episode.size || a.episode.id.localeCompare(b.episode.id))
      .slice(0, 10);
  }, [visiblePoints]);
  const selectedEpisode = selectedEpisodeIndex === null ? null : dashboard.episodes?.[selectedEpisodeIndex] ?? null;
  const selectedEpisodeVisibleMembers = selectedEpisodeIndex === null ? 0 : visiblePoints.filter((point) => point[18] === selectedEpisodeIndex).length;
  const mapPoints = selectedEpisodeIndex === null ? visiblePoints : visiblePoints.filter((point) => point[18] === selectedEpisodeIndex);
  const basicEpisodePoints = useMemo(() => {
    const indexes = [...new Set(mapPoints.map((point) => point[18] ?? -1).filter((index) => index >= 0))];
    return indexes.flatMap((index) => {
      const episode = dashboard.episodes?.[index];
      return episode ? [[episode.longitude, episode.latitude, -1, -1, 0, 0, 0, 1, null, 0, 0] as PointRow] : [];
    });
  }, [mapPoints]);

  const ranking = useMemo(() => {
    const byMunicipality = departmentCode !== "00";
    const memberships = new Map<number, Set<number>>();
    for (const point of visiblePoints) {
      const episodeIndex = point[18] ?? -1;
      const territoryIndex = byMunicipality ? point[3] : point[2];
      if (episodeIndex < 0 || territoryIndex < 0) continue;
      if (!memberships.has(territoryIndex)) memberships.set(territoryIndex, new Set());
      memberships.get(territoryIndex)!.add(episodeIndex);
    }
    const catalog = byMunicipality ? dashboard.municipalities : dashboard.departments;
    return [...memberships.entries()].map(([index, episodes]) => ({ name: catalog[index].name, value: episodes.size })).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [visiblePoints, departmentCode]);

  const trend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const point of visiblePoints) {
      const date = dashboard.dates[point[4]];
      const period = trendGrouping === "day" ? date : date.slice(0, 7);
      counts.set(period, (counts.get(period) ?? 0) + 1);
    }
    const periods = [...new Set(dashboard.dates.slice(startIndex, endIndex + 1).map((date) => trendGrouping === "day" ? date : date.slice(0, 7)))];
    return periods.map((period) => ({
      period,
      day: trendGrouping === "day" ? labelDate(period).replace(/ 2026$/, "") : labelMonth(period),
      label: trendGrouping === "day" ? labelDate(period) : `${labelMonth(period)}${period === history.metadata.openMonth ? " · mes abierto" : ""}`,
      value: counts.get(period) ?? 0,
    }));
  }, [visiblePoints, startIndex, endIndex, trendGrouping]);

  const selectedDepartment = dashboard.departments.find((item) => item.code === departmentCode);
  const selectedMunicipality = dashboard.municipalities.find((item) => item.code === municipalityCode);
  const title = selectedMunicipality?.name ?? selectedDepartment?.name ?? "Colombia";
  const generated = labelColombiaDateTime(dashboard.metadata.generatedAtUtc);
  const reset = () => { setDepartmentCode("00"); setMunicipalityCode("00000"); setStartDate(dashboard.metadata.historyStartDate); setEndDate(dashboard.metadata.lastObservationDate); setProtectedRelation("all"); setLandCoverLevel("all"); setMiningRelation("all"); setAnlaRelation("all"); setAnlaLegalStatus("all"); setAnhRelation("all"); setSelectedEpisodeIndex(null); };

  return <main className="dashboard-shell">
    <header className="topbar">
      <div className="brand-block"><div className="brand-mark"><Flame size={21} /></div><div><p className="eyebrow">MONITOREO TERRITORIAL · COLOMBIA</p><h1>Episodios de detecciones térmicas</h1></div></div>
      <div className="status-cluster"><span className="official-badge">DATOS OFICIALES PROCESADOS</span><span className="status-chip"><CalendarDays size={14} /> Histórico desde {HISTORY_START_LABEL}</span><span className="status-chip"><span className="pulse" /> Actualizado: {generated}</span></div>
    </header>

    <section className="notice" aria-label="Advertencia metodológica"><CircleAlert size={18} /><p><strong>Qué significa un episodio:</strong> es una agrupación algorítmica de al menos 3 detecciones térmicas conectadas dentro de 1 km y 24 horas. Sirve para organizar señales satelitales; <strong>no confirma por sí sola un incendio, una superficie quemada ni una causa.</strong> La interfaz usa una única configuración operativa; la sensibilidad por composición instrumental se conserva en la metodología y el backend.</p></section>

    <section className="filterbar" aria-label="Filtros territoriales y metodológicos">
      <label><span>Desde</span><input type="date" min={dashboard.metadata.historyStartDate} max={endDate} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>Hasta</span><input type="date" min={startDate} max={dashboard.metadata.lastObservationDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <label><span>Departamento</span><div className="select-wrap"><select value={departmentCode} onChange={(event) => { setDepartmentCode(event.target.value); setMunicipalityCode("00000"); }}><option value="00">Todos los departamentos</option>{dashboard.departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Municipio</span><div className="select-wrap"><select value={municipalityCode} disabled={departmentCode === "00"} onChange={(event) => setMunicipalityCode(event.target.value)}><option value="00000">Todos los municipios</option>{municipalityOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Área protegida</span><div className="select-wrap"><select value={protectedRelation} onChange={(event) => setProtectedRelation(event.target.value as ProtectedRelation)}><option value="all">Sin filtro por RUNAP</option><option value="inside">Con miembro dentro de RUNAP</option><option value="outside">Sin miembro dentro de RUNAP</option></select><ChevronDown size={16} /></div></label>
      <label><span>Cobertura 2024</span><div className="select-wrap"><select value={landCoverLevel} disabled={!landCovers.length} onChange={(event) => setLandCoverLevel(event.target.value)}><option value="all">Todas las coberturas</option>{landCoverLevels.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Título minero</span><div className="select-wrap"><select value={miningRelation} disabled={!dashboard.metadata.miningTitles} onChange={(event) => setMiningRelation(event.target.value as MiningRelation)}><option value="all">Sin filtro por ANM</option><option value="inside">Con miembro dentro de título vigente</option><option value="outside">Sin miembro dentro de título vigente</option></select><ChevronDown size={16} /></div></label>
      <label><span>Relación con proyecto ANLA</span><div className="select-wrap"><select value={anlaRelation} disabled={!dashboard.metadata.anlaProjects} onChange={(event) => setAnlaRelation(event.target.value as AnlaRelation)}><option value="all">Sin filtro por ANLA</option><option value="inside">Con miembro dentro del proyecto</option><option value="within1">Con miembro hasta 1 km</option><option value="between1and5">Con miembro entre 1 y 5 km</option><option value="beyond5">Sin miembro dentro de 5 km</option></select><ChevronDown size={16} /></div></label>
      <label><span>Situación ANLA</span><div className="select-wrap"><select value={anlaLegalStatus} disabled={!dashboard.metadata.anlaProjects} onChange={(event) => setAnlaLegalStatus(event.target.value as AnlaLegalStatus)}><option value="all">Evaluación y licenciados</option><option value="evaluation">En evaluación</option><option value="licensed">Licenciados</option></select><ChevronDown size={16} /></div></label>
      <label><span>Área contractual ANH</span><div className="select-wrap"><select value={anhRelation} disabled={!dashboard.metadata.anhContracts} onChange={(event) => setAnhRelation(event.target.value as AnhRelation)}><option value="all">Sin filtro por ANH</option><option value="inside">Con miembro dentro de área asignada</option><option value="within1">Con miembro hasta 1 km</option><option value="between1and5">Con miembro entre 1 y 5 km</option><option value="beyond5">Sin miembro dentro de 5 km</option></select><ChevronDown size={16} /></div></label>
      <button className="reset-button" onClick={reset}><RefreshCw size={16} /> Restablecer</button>
    </section>

    <section className="metrics-grid">
      <MetricCard icon={Network} label="Episodios visibles" value={numberFormat.format(metrics.episodes)} detail={`1 km · 24 h · mínimo 3 · ${labelDate(startDate)}–${labelDate(endDate)}`} />
      <MetricCard icon={Flame} label="Detecciones individuales" value={numberFormat.format(visiblePoints.length)} detail={`${numberFormat.format(metrics.sources)} fuentes operativas · Suomi-NPP excluido`} />
      <MetricCard icon={MapPinned} label="Departamentos" value={numberFormat.format(metrics.departments)} detail="Con al menos un episodio visible" />
      <MetricCard icon={Activity} label="Municipios" value={numberFormat.format(metrics.municipalities)} detail="Con al menos un episodio · DANE 2025" />
      <MetricCard icon={Leaf} label="Episodios en áreas protegidas" value={numberFormat.format(metrics.protected)} detail="Al menos una detección miembro dentro de RUNAP" />
      <MetricCard icon={Layers3} label="Coberturas detalladas" value={numberFormat.format(metrics.covers)} detail="Coberturas de miembros · IDEAM 2024" />
      <MetricCard icon={Pickaxe} label="Episodios en títulos mineros" value={numberFormat.format(metrics.mining)} detail="Al menos una detección miembro dentro de ANM" />
      <MetricCard icon={Building2} label="Episodios relacionados con ANLA" value={numberFormat.format(metrics.anla)} detail="Al menos una detección miembro dentro o hasta 5 km" />
      <MetricCard icon={Fuel} label="Episodios relacionados con ANH" value={numberFormat.format(metrics.anh)} detail="Áreas asignadas · dentro o hasta 5 km" />
    </section>

    <section className="workspace-grid">
      <article className="panel map-panel"><div className="panel-heading"><div><p className="panel-kicker">DISTRIBUCIÓN ESPACIAL</p><h2>{title}</h2></div><div className="map-heading-actions"><span className="method-chip">1 km · 24 h · ≥3</span><div className="map-mode-toggle" role="group" aria-label="Modo del mapa"><button type="button" className={mapMode === "geovisor" ? "active" : ""} onClick={() => setMapMode("geovisor")}>Geovisor</button><button type="button" className={mapMode === "basic" ? "active" : ""} onClick={() => setMapMode("basic")}>Mapa básico</button></div></div></div><div className="map-surface">
        {mapMode === "geovisor" ? <GeovisorMap departments={departmentsGeo} municipalities={municipalitiesGeo} points={mapPoints} dates={dashboard.dates} sources={dashboard.sources} departmentCode={departmentCode} municipalityCode={municipalityCode} onDepartment={(code) => { setDepartmentCode(code); setMunicipalityCode("00000"); setSelectedEpisodeIndex(null); }} onMunicipality={(code) => { setMunicipalityCode(code); setSelectedEpisodeIndex(null); }} /> : <><DashboardMap departments={departmentsGeo} municipalities={municipalitiesGeo} points={basicEpisodePoints} departmentCode={departmentCode} municipalityCode={municipalityCode} onDepartment={(code) => { setDepartmentCode(code); setMunicipalityCode("00000"); setSelectedEpisodeIndex(null); }} onMunicipality={(code) => { setMunicipalityCode(code); setSelectedEpisodeIndex(null); }} /><div className="map-legend"><span><i className="dot-high" /> Episodio térmico</span><span><i className="area-swatch" /> Límite DANE 2025</span></div></>}
        <div className="map-caption">{mapMode === "geovisor" ? "Navega, acerca y activa capas. Consulta episodios, coberturas y contexto; activa las detecciones individuales cuando necesites inspeccionar los miembros de un episodio." : "Mapa de respaldo. Haz clic en un territorio para filtrarlo."} Los indicadores y gráficos se recalculan con el periodo y los filtros seleccionados.</div>
      </div></article>
      <div className="side-stack">
        <article className="panel chart-panel"><div className="panel-heading compact"><div><p className="panel-kicker">CONCENTRACIÓN</p><h2>{departmentCode === "00" ? "Departamentos" : "Municipios"} con más episodios</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><BarChart data={ranking} layout="vertical" margin={{ left: 8, right: 26 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8ece8" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10, fill: "#46534a" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => numberFormat.format(Number(value))} cursor={{ fill: "#f4f7f4" }} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} /><Bar dataKey="value" name="Episodios" fill="#d9462e" radius={[0, 5, 5, 0]} barSize={15} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></article>
        <article className="panel chart-panel trend-panel"><div className="panel-heading compact"><div><p className="panel-kicker">EVOLUCIÓN TEMPORAL</p><h2>Detecciones individuales por {trendGrouping === "day" ? "día" : "mes"}</h2></div><div className="trend-actions"><span className="open-period">{labelMonth(history.metadata.openMonth)} en curso</span><div className="trend-toggle" role="group" aria-label="Agrupación temporal"><button className={trendGrouping === "day" ? "active" : ""} onClick={() => setTrendGrouping("day")}>Días</button><button className={trendGrouping === "month" ? "active" : ""} onClick={() => setTrendGrouping("month")}>Meses</button></div></div></div><div className="trend-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><AreaChart data={trend} margin={{ left: -18, right: 12, top: 8 }}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f06432" stopOpacity="0.45" /><stop offset="1" stopColor="#f06432" stopOpacity="0.03" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ece8" /><XAxis dataKey="day" tick={{ fontSize: 9, fill: "#647068" }} axisLine={false} tickLine={false} minTickGap={28} /><YAxis tick={{ fontSize: 10, fill: "#647068" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => numberFormat.format(Number(value))} labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} /><Area type="monotone" dataKey="value" name="Detecciones individuales" stroke="#c73524" strokeWidth={2.5} fill="url(#trendFill)" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div></article>
      </div>
    </section>

    <section className="episode-workspace" aria-label="Explorador de episodios operacionales">
      <article className="panel episode-list-panel">
        <div className="panel-heading"><div><p className="panel-kicker">EXPLORACIÓN OPERATIVA</p><h2>Episodios con más detecciones miembro visibles</h2></div><span className="method-chip">1 km · 24 h · ≥3</span></div>
        <div className="episode-table" role="list">
          {episodeRanking.length ? episodeRanking.map(({ index, visibleMembers, episode }, position) => <button key={episode.id} type="button" role="listitem" className={selectedEpisodeIndex === index ? "selected" : ""} onClick={() => setSelectedEpisodeIndex(index)}>
            <span className="episode-rank">{position + 1}</span><span className="episode-name"><strong>{episode.id}</strong><small>{episode.municipalities?.slice(0, 2).join(" · ") || "Sin municipio asignado"}{(episode.municipalities?.length ?? 0) > 2 ? ` +${episode.municipalities!.length - 2}` : ""}</small></span><span className="episode-size"><strong>{numberFormat.format(visibleMembers)}</strong><small>visibles</small></span>{episode.chained && <span className="chain-badge">Encadenado</span>}<ChevronRight size={16} />
          </button>) : <p className="episode-empty">No hay episodios con los filtros seleccionados.</p>}
        </div>
      </article>
      <article className="panel episode-detail-panel">
        <div className="panel-heading"><div><p className="panel-kicker">DETALLE Y TRAZABILIDAD</p><h2>{selectedEpisode ? "Episodio seleccionado" : "Selecciona un episodio"}</h2></div>{selectedEpisode && <button className="clear-episode" type="button" onClick={() => setSelectedEpisodeIndex(null)} aria-label="Quitar selección de episodio"><X size={16} /> Quitar selección</button>}</div>
        {selectedEpisode ? <div className="episode-detail">
          <div className="episode-id-row"><Network size={19} /><strong>{selectedEpisode.id}</strong>{selectedEpisode.chained && <span className="chain-badge">Requiere revisión</span>}</div>
          <dl><div><dt>Detecciones visibles</dt><dd>{numberFormat.format(selectedEpisodeVisibleMembers)} de {numberFormat.format(selectedEpisode.size)}</dd></div><div><dt>Duración</dt><dd>{numberFormat.format(selectedEpisode.durationHours)} h</dd></div><div><dt>Extensión de caja</dt><dd>{selectedEpisode.extentKm == null ? "—" : `${numberFormat.format(selectedEpisode.extentKm)} km`}</dd></div><div><dt>FRP máxima</dt><dd>{selectedEpisode.frpMaxMw == null ? "—" : `${numberFormat.format(selectedEpisode.frpMaxMw)} MW`}</dd></div></dl>
          <p><strong>Periodo:</strong> {new Date(selectedEpisode.start).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })} – {new Date(selectedEpisode.end).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })}</p>
          <p><strong>Territorios:</strong> {selectedEpisode.departments?.join(", ") || "Sin departamento asignado"} · {selectedEpisode.municipalities?.join(", ") || "Sin municipio asignado"}</p>
          <p className="episode-map-note">El geovisor conserva este episodio como unidad principal. Activa «Detecciones individuales» para inspeccionar sus miembros; quita la selección para recuperar todos los episodios filtrados.</p>
        </div> : <div className="episode-placeholder"><Network size={28} /><p>Elige una fila para consultar duración, extensión, territorios y potencia radiativa, y aislar sus detecciones en el mapa.</p></div>}
        <div className="lineage-summary"><strong>Cambios en la última actualización</strong><span>{numberFormat.format(dashboard.metadata.episodes?.lineageEventsThisRun ?? 0)} eventos registrados</span><small>{Object.entries(dashboard.metadata.episodes?.lineageCounts ?? {}).map(([type, count]) => `${type}: ${numberFormat.format(count)}`).join(" · ") || "Sin cambios de identidad o membresía"}</small></div>
      </article>
    </section>

    <section className="audit-strip"><div><Database size={18} /><span><strong>Fuentes</strong> IDEAM · DANE · RUNAP · ANM · ANLA · ANH</span></div><div><CalendarDays size={18} /><span><strong>Histórico acumulativo</strong> desde {HISTORY_START_LABEL} · cobertura de contexto {dashboard.metadata.landCover?.year ?? 2024}</span></div><div><ShieldCheck size={18} /><span><strong>Cierre espacial</strong> {numberFormat.format(dashboard.metadata.protectedAreas?.insideRows ?? 0)} en RUNAP · {numberFormat.format(dashboard.metadata.miningTitles?.insideRows ?? 0)} en títulos · {numberFormat.format((dashboard.metadata.anlaProjects?.insideRows ?? 0) + (dashboard.metadata.anlaProjects?.within1KmRows ?? 0) + (dashboard.metadata.anlaProjects?.between1And5KmRows ?? 0))} relacionados con ANLA · {numberFormat.format((dashboard.metadata.anhContracts?.insideRows ?? 0) + (dashboard.metadata.anhContracts?.within1KmRows ?? 0) + (dashboard.metadata.anhContracts?.between1And5KmRows ?? 0))} relacionados con ANH</span></div></section>
    <footer><p>Dashboard nacional en desarrollo · Datos actualizados automáticamente.</p><p>Metodología, fuentes y trazabilidad disponibles en <code>/docs</code>.</p></footer>
  </main>;
}
