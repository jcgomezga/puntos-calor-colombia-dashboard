"use client";

import { Activity, Building2, CalendarDays, ChevronDown, ChevronRight, CircleAlert, Database, Flame, Fuel, Layers3, Leaf, MapPinned, Network, Pickaxe, Radio, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardMap, type FeatureCollection, type PointRow } from "@/components/dashboard-map";
import { HISTORY_START_LABEL } from "@/lib/data-policy";
import dashboardJson from "@/public/data/dashboard.json";
import departmentGeoJson from "@/public/data/departments.json";
import historyJson from "@/public/data/history.json";
import municipalityGeoJson from "@/public/data/municipalities.json";

type Scenario = "A" | "B";
type ProtectedRelation = "all" | "inside" | "outside";
type MiningRelation = "all" | "inside" | "outside";
type AnlaRelation = "all" | "inside" | "within1" | "between1and5" | "beyond5";
type AnlaLegalStatus = "all" | "evaluation" | "licensed";
type AnhRelation = "all" | "inside" | "within1" | "between1and5" | "beyond5";
type EpisodeRelation = "all" | "episode" | "pair" | "isolated" | "chained";
type TrendGrouping = "day" | "month";
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

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Flame; label: string; value: string; detail: string }) {
  return <article className="metric-card"><div className="metric-icon"><Icon size={18} /></div><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></article>;
}

function labelDate(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00Z`)).replace(" de ", " ");
}

function labelMonth(value: string) {
  return monthFormat.format(new Date(`${value}-15T12:00:00Z`)).replace(" de ", " ");
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>("B");
  const [departmentCode, setDepartmentCode] = useState("00");
  const [municipalityCode, setMunicipalityCode] = useState("00000");
  const [startDate, setStartDate] = useState(dashboard.metadata.historyStartDate);
  const [endDate, setEndDate] = useState(dashboard.metadata.lastObservationDate);
  const [protectedRelation, setProtectedRelation] = useState<ProtectedRelation>("all");
  const [miningRelation, setMiningRelation] = useState<MiningRelation>("all");
  const [anlaRelation, setAnlaRelation] = useState<AnlaRelation>("all");
  const [anlaLegalStatus, setAnlaLegalStatus] = useState<AnlaLegalStatus>("all");
  const [anhRelation, setAnhRelation] = useState<AnhRelation>("all");
  const [episodeRelation, setEpisodeRelation] = useState<EpisodeRelation>("all");
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState<number | null>(null);
  const [trendGrouping, setTrendGrouping] = useState<TrendGrouping>("day");
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
    if (scenario === "B" && point[7] !== 1) return false;
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
    if (episodeRelation === "episode" && point[17] !== 2 && point[17] !== 3) return false;
    if (episodeRelation === "pair" && point[17] !== 1) return false;
    if (episodeRelation === "isolated" && point[17] !== 0) return false;
    if (episodeRelation === "chained" && point[17] !== 3) return false;
    return true;
  }), [scenario, startIndex, endIndex, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, episodeRelation, landCovers]);

  const metrics = useMemo(() => {
    const departments = new Set<number>(), municipalities = new Set<number>(), sources = new Set<number>();
    for (const point of visiblePoints) {
      if (point[2] >= 0) departments.add(point[2]);
      if (point[3] >= 0) municipalities.add(point[3]);
      sources.add(point[6]);
    }
    const covers = new Set(visiblePoints.map((point) => point[12]).filter((index) => index !== undefined && index >= 0));
    const episodes = new Set(visiblePoints.map((point) => point[18]).filter((index) => index !== undefined && index >= 0));
    return { departments: departments.size, municipalities: municipalities.size, sources: sources.size, protected: visiblePoints.filter((point) => point[11] === 1).length, covers: covers.size, mining: visiblePoints.filter((point) => point[13] === 1).length, anla: visiblePoints.filter((point) => (point[14] ?? 0) > 0).length, anh: visiblePoints.filter((point) => (point[16] ?? 0) > 0).length, episodes: episodes.size };
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

  const ranking = useMemo(() => {
    const byMunicipality = departmentCode !== "00";
    const counts = new Map<number, number>();
    for (const point of visiblePoints) {
      const index = byMunicipality ? point[3] : point[2];
      if (index >= 0) counts.set(index, (counts.get(index) ?? 0) + 1);
    }
    const catalog = byMunicipality ? dashboard.municipalities : dashboard.departments;
    return [...counts.entries()].map(([index, value]) => ({ name: catalog[index].name, value })).sort((a, b) => b.value - a.value).slice(0, 7);
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
  const generated = new Date(dashboard.metadata.generatedAtUtc).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
  const reset = () => { setScenario("B"); setDepartmentCode("00"); setMunicipalityCode("00000"); setStartDate(dashboard.metadata.historyStartDate); setEndDate(dashboard.metadata.lastObservationDate); setProtectedRelation("all"); setLandCoverLevel("all"); setMiningRelation("all"); setAnlaRelation("all"); setAnlaLegalStatus("all"); setAnhRelation("all"); setEpisodeRelation("all"); setSelectedEpisodeIndex(null); };

  return <main className="dashboard-shell">
    <header className="topbar">
      <div className="brand-block"><div className="brand-mark"><Flame size={21} /></div><div><p className="eyebrow">MONITOREO TERRITORIAL · COLOMBIA</p><h1>Detecciones de calor</h1></div></div>
      <div className="status-cluster"><span className="official-badge">DATOS OFICIALES PROCESADOS</span><span className="status-chip"><CalendarDays size={14} /> Histórico desde {HISTORY_START_LABEL}</span><span className="status-chip"><span className="pulse" /> Actualizado: {generated}</span></div>
    </header>

    <section className="notice" aria-label="Advertencia metodológica"><CircleAlert size={18} /><p><strong>Lectura responsable:</strong> una detección térmica satelital ni una agrupación espacio-temporal confirman por sí solas un incendio, su extensión o su causa. Fuente de puntos: IDEAM; asignación territorial: MGN 2025 del DANE.</p></section>

    <section className="filterbar" aria-label="Filtros territoriales y metodológicos">
      <label><span>Desde</span><input type="date" min={dashboard.metadata.historyStartDate} max={endDate} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>Hasta</span><input type="date" min={startDate} max={dashboard.metadata.lastObservationDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <label><span>Departamento</span><div className="select-wrap"><select value={departmentCode} onChange={(event) => { setDepartmentCode(event.target.value); setMunicipalityCode("00000"); }}><option value="00">Todos los departamentos</option>{dashboard.departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Municipio</span><div className="select-wrap"><select value={municipalityCode} disabled={departmentCode === "00"} onChange={(event) => setMunicipalityCode(event.target.value)}><option value="00000">Todos los municipios</option>{municipalityOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Área protegida</span><div className="select-wrap"><select value={protectedRelation} onChange={(event) => setProtectedRelation(event.target.value as ProtectedRelation)}><option value="all">Todas las detecciones</option><option value="inside">Dentro de RUNAP</option><option value="outside">Fuera de RUNAP</option></select><ChevronDown size={16} /></div></label>
      <label><span>Cobertura 2024</span><div className="select-wrap"><select value={landCoverLevel} disabled={!landCovers.length} onChange={(event) => setLandCoverLevel(event.target.value)}><option value="all">Todas las coberturas</option>{landCoverLevels.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Título minero</span><div className="select-wrap"><select value={miningRelation} disabled={!dashboard.metadata.miningTitles} onChange={(event) => setMiningRelation(event.target.value as MiningRelation)}><option value="all">Todas las detecciones</option><option value="inside">Dentro de título vigente</option><option value="outside">Fuera de título vigente</option></select><ChevronDown size={16} /></div></label>
      <label><span>Relación con proyecto ANLA</span><div className="select-wrap"><select value={anlaRelation} disabled={!dashboard.metadata.anlaProjects} onChange={(event) => setAnlaRelation(event.target.value as AnlaRelation)}><option value="all">Todas las detecciones</option><option value="inside">Dentro de área de proyecto</option><option value="within1">Hasta 1 km</option><option value="between1and5">Entre 1 y 5 km</option><option value="beyond5">A más de 5 km</option></select><ChevronDown size={16} /></div></label>
      <label><span>Situación ANLA</span><div className="select-wrap"><select value={anlaLegalStatus} disabled={!dashboard.metadata.anlaProjects} onChange={(event) => setAnlaLegalStatus(event.target.value as AnlaLegalStatus)}><option value="all">Evaluación y licenciados</option><option value="evaluation">En evaluación</option><option value="licensed">Licenciados</option></select><ChevronDown size={16} /></div></label>
      <label><span>Área contractual ANH</span><div className="select-wrap"><select value={anhRelation} disabled={!dashboard.metadata.anhContracts} onChange={(event) => setAnhRelation(event.target.value as AnhRelation)}><option value="all">Todas las detecciones</option><option value="inside">Dentro de área asignada</option><option value="within1">Hasta 1 km</option><option value="between1and5">Entre 1 y 5 km</option><option value="beyond5">A más de 5 km</option></select><ChevronDown size={16} /></div></label>
      <label><span>Agrupación térmica</span><div className="select-wrap"><select value={episodeRelation} disabled={!dashboard.metadata.episodes} onChange={(event) => setEpisodeRelation(event.target.value as EpisodeRelation)}><option value="all">Todas las detecciones</option><option value="episode">Episodio preliminar (≥3)</option><option value="pair">Asociación de 2</option><option value="isolated">Detección aislada</option><option value="chained">Episodio encadenado</option></select><ChevronDown size={16} /></div></label>
      <div className="scenario-field"><span>Escenario de sensores</span><div className="segmented" role="group" aria-label="Escenario de sensores"><button className={scenario === "A" ? "active" : ""} onClick={() => setScenario("A")}>A · todos</button><button className={scenario === "B" ? "active" : ""} onClick={() => setScenario("B")}>B · sin SNPP</button></div></div>
      <button className="reset-button" onClick={reset}><RefreshCw size={16} /> Restablecer</button>
    </section>

    <section className="metrics-grid">
      <MetricCard icon={Flame} label="Detecciones visibles" value={numberFormat.format(visiblePoints.length)} detail={`Escenario ${scenario} · ${labelDate(startDate)}–${labelDate(endDate)}`} />
      <MetricCard icon={MapPinned} label="Departamentos" value={numberFormat.format(metrics.departments)} detail="Con al menos una detección asignada" />
      <MetricCard icon={Activity} label="Municipios" value={numberFormat.format(metrics.municipalities)} detail="Asignación oficial DANE 2025" />
      <MetricCard icon={Radio} label="Fuentes satelitales" value={numberFormat.format(metrics.sources)} detail={scenario === "A" ? "MODIS y VIIRS disponibles" : "Suomi-NPP excluido"} />
      <MetricCard icon={Leaf} label="Dentro de áreas protegidas" value={numberFormat.format(metrics.protected)} detail="Intersección espacial con RUNAP" />
      <MetricCard icon={Layers3} label="Coberturas detalladas" value={numberFormat.format(metrics.covers)} detail="IDEAM 2024 · escala 1:100.000" />
      <MetricCard icon={Pickaxe} label="Dentro de títulos mineros" value={numberFormat.format(metrics.mining)} detail="Intersección directa con títulos ANM" />
      <MetricCard icon={Building2} label="Relacionadas con proyectos ANLA" value={numberFormat.format(metrics.anla)} detail="Dentro o hasta 5 km · sin inferir causalidad" />
      <MetricCard icon={Fuel} label="Relacionadas con contratos ANH" value={numberFormat.format(metrics.anh)} detail="Áreas asignadas dentro o hasta 5 km" />
      <MetricCard icon={Network} label="Episodios preliminares" value={numberFormat.format(metrics.episodes)} detail="Escenario B · 1 km · 24 h · mínimo 3" />
    </section>

    <section className="workspace-grid">
      <article className="panel map-panel"><div className="panel-heading"><div><p className="panel-kicker">DISTRIBUCIÓN ESPACIAL</p><h2>{title}</h2></div><span className="method-chip">Escenario {scenario}</span></div><div className="map-surface">
        <DashboardMap departments={departmentsGeo} municipalities={municipalitiesGeo} points={mapPoints} departmentCode={departmentCode} municipalityCode={municipalityCode} onDepartment={(code) => { setDepartmentCode(code); setMunicipalityCode("00000"); setSelectedEpisodeIndex(null); }} onMunicipality={(code) => { setMunicipalityCode(code); setSelectedEpisodeIndex(null); }} />
        <div className="map-legend"><span><i className="dot-high" /> Detección IDEAM</span><span><i className="area-swatch" /> Límite DANE 2025</span></div><div className="map-caption">Haz clic en un territorio para filtrarlo. Los indicadores y gráficos se recalculan con el periodo y escenario seleccionados.</div>
      </div></article>
      <div className="side-stack">
        <article className="panel chart-panel"><div className="panel-heading compact"><div><p className="panel-kicker">CONCENTRACIÓN</p><h2>{departmentCode === "00" ? "Departamentos" : "Municipios"} con más detecciones</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><BarChart data={ranking} layout="vertical" margin={{ left: 8, right: 26 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8ece8" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10, fill: "#46534a" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => numberFormat.format(Number(value))} cursor={{ fill: "#f4f7f4" }} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} /><Bar dataKey="value" name="Detecciones" fill="#d9462e" radius={[0, 5, 5, 0]} barSize={15} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></article>
        <article className="panel chart-panel trend-panel"><div className="panel-heading compact"><div><p className="panel-kicker">EVOLUCIÓN TEMPORAL</p><h2>Detecciones por {trendGrouping === "day" ? "día" : "mes"}</h2></div><div className="trend-actions"><span className="open-period">{labelMonth(history.metadata.openMonth)} en curso</span><div className="trend-toggle" role="group" aria-label="Agrupación temporal"><button className={trendGrouping === "day" ? "active" : ""} onClick={() => setTrendGrouping("day")}>Días</button><button className={trendGrouping === "month" ? "active" : ""} onClick={() => setTrendGrouping("month")}>Meses</button></div></div></div><div className="trend-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><AreaChart data={trend} margin={{ left: -18, right: 12, top: 8 }}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f06432" stopOpacity="0.45" /><stop offset="1" stopColor="#f06432" stopOpacity="0.03" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ece8" /><XAxis dataKey="day" tick={{ fontSize: 9, fill: "#647068" }} axisLine={false} tickLine={false} minTickGap={28} /><YAxis tick={{ fontSize: 10, fill: "#647068" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => numberFormat.format(Number(value))} labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} /><Area type="monotone" dataKey="value" name="Detecciones" stroke="#c73524" strokeWidth={2.5} fill="url(#trendFill)" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div></article>
      </div>
    </section>

    <section className="episode-workspace" aria-label="Explorador de episodios preliminares">
      <article className="panel episode-list-panel">
        <div className="panel-heading"><div><p className="panel-kicker">EXPLORACIÓN OPERATIVA</p><h2>Episodios con más detecciones visibles</h2></div><span className="method-chip">B · 1 km · 24 h</span></div>
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
          <p className="episode-map-note">El mapa muestra únicamente los miembros visibles de este episodio. Quita la selección para recuperar todas las detecciones filtradas.</p>
        </div> : <div className="episode-placeholder"><Network size={28} /><p>Elige una fila para consultar duración, extensión, territorios y potencia radiativa, y aislar sus detecciones en el mapa.</p></div>}
        <div className="lineage-summary"><strong>Cambios en la última actualización</strong><span>{numberFormat.format(dashboard.metadata.episodes?.lineageEventsThisRun ?? 0)} eventos registrados</span><small>{Object.entries(dashboard.metadata.episodes?.lineageCounts ?? {}).map(([type, count]) => `${type}: ${numberFormat.format(count)}`).join(" · ") || "Sin cambios de identidad o membresía"}</small></div>
      </article>
    </section>

    <section className="audit-strip"><div><Database size={18} /><span><strong>Fuentes</strong> IDEAM · DANE · RUNAP · ANM · ANLA · ANH</span></div><div><CalendarDays size={18} /><span><strong>Histórico acumulativo</strong> desde {HISTORY_START_LABEL} · cobertura de contexto {dashboard.metadata.landCover?.year ?? 2024}</span></div><div><ShieldCheck size={18} /><span><strong>Cierre espacial</strong> {numberFormat.format(dashboard.metadata.protectedAreas?.insideRows ?? 0)} en RUNAP · {numberFormat.format(dashboard.metadata.miningTitles?.insideRows ?? 0)} en títulos · {numberFormat.format((dashboard.metadata.anlaProjects?.insideRows ?? 0) + (dashboard.metadata.anlaProjects?.within1KmRows ?? 0) + (dashboard.metadata.anlaProjects?.between1And5KmRows ?? 0))} relacionados con ANLA · {numberFormat.format((dashboard.metadata.anhContracts?.insideRows ?? 0) + (dashboard.metadata.anhContracts?.within1KmRows ?? 0) + (dashboard.metadata.anhContracts?.between1And5KmRows ?? 0))} relacionados con ANH</span></div></section>
    <footer><p>Dashboard nacional en desarrollo · Datos actualizados automáticamente.</p><p>Metodología, fuentes y trazabilidad disponibles en <code>/docs</code>.</p></footer>
  </main>;
}
