"use client";

import { Activity, CalendarDays, ChevronDown, CircleAlert, Database, Flame, MapPinned, Radio, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardMap, type FeatureCollection, type PointRow } from "@/components/dashboard-map";
import { HISTORY_START_LABEL } from "@/lib/data-policy";
import dashboardJson from "@/public/data/dashboard.json";
import departmentGeoJson from "@/public/data/departments.json";
import municipalityGeoJson from "@/public/data/municipalities.json";

type Scenario = "A" | "B";
type Territory = { code: string; name: string; countA: number; countB: number };
type Municipality = Territory & { departmentCode: string; areaKm2: number | null };
type DashboardData = {
  metadata: { generatedAtUtc: string; historyStartDate: string; lastObservationDate: string; totalRows: number; scenarioARows: number; scenarioBRows: number; territorialStatus: Record<string, number> };
  dates: string[]; sources: string[]; departments: Territory[]; municipalities: Municipality[]; points: PointRow[];
};

const dashboard = dashboardJson as unknown as DashboardData;
const departmentsGeo = departmentGeoJson as unknown as FeatureCollection;
const municipalitiesGeo = municipalityGeoJson as unknown as FeatureCollection;
const numberFormat = new Intl.NumberFormat("es-CO");
const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Flame; label: string; value: string; detail: string }) {
  return <article className="metric-card"><div className="metric-icon"><Icon size={18} /></div><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></article>;
}

function labelDate(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00Z`)).replace(" de ", " ");
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>("B");
  const [departmentCode, setDepartmentCode] = useState("00");
  const [municipalityCode, setMunicipalityCode] = useState("00000");
  const [startDate, setStartDate] = useState(dashboard.metadata.historyStartDate);
  const [endDate, setEndDate] = useState(dashboard.metadata.lastObservationDate);

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
    return true;
  }), [scenario, startIndex, endIndex, selectedDepartmentIndex, selectedMunicipalityIndex]);

  const metrics = useMemo(() => {
    const departments = new Set<number>(), municipalities = new Set<number>(), sources = new Set<number>();
    for (const point of visiblePoints) {
      if (point[2] >= 0) departments.add(point[2]);
      if (point[3] >= 0) municipalities.add(point[3]);
      sources.add(point[6]);
    }
    return { departments: departments.size, municipalities: municipalities.size, sources: sources.size };
  }, [visiblePoints]);

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
    const counts = new Array(dashboard.dates.length).fill(0) as number[];
    for (const point of visiblePoints) counts[point[4]] += 1;
    return dashboard.dates.map((date, index) => ({ date, day: labelDate(date).replace(/ 2026$/, ""), value: counts[index] })).filter((_, index) => index >= startIndex && index <= endIndex);
  }, [visiblePoints, startIndex, endIndex]);

  const selectedDepartment = dashboard.departments.find((item) => item.code === departmentCode);
  const selectedMunicipality = dashboard.municipalities.find((item) => item.code === municipalityCode);
  const title = selectedMunicipality?.name ?? selectedDepartment?.name ?? "Colombia";
  const generated = new Date(dashboard.metadata.generatedAtUtc).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
  const reset = () => { setScenario("B"); setDepartmentCode("00"); setMunicipalityCode("00000"); setStartDate(dashboard.metadata.historyStartDate); setEndDate(dashboard.metadata.lastObservationDate); };

  return <main className="dashboard-shell">
    <header className="topbar">
      <div className="brand-block"><div className="brand-mark"><Flame size={21} /></div><div><p className="eyebrow">MONITOREO TERRITORIAL · COLOMBIA</p><h1>Detecciones de calor</h1></div></div>
      <div className="status-cluster"><span className="official-badge">DATOS OFICIALES PROCESADOS</span><span className="status-chip"><CalendarDays size={14} /> Histórico desde {HISTORY_START_LABEL}</span><span className="status-chip"><span className="pulse" /> Actualizado: {generated}</span></div>
    </header>

    <section className="notice" aria-label="Advertencia metodológica"><CircleAlert size={18} /><p><strong>Lectura responsable:</strong> una detección térmica satelital no confirma por sí sola un incendio, su extensión ni su causa. Fuente de puntos: IDEAM; asignación territorial: MGN 2025 del DANE.</p></section>

    <section className="filterbar" aria-label="Filtros territoriales y metodológicos">
      <label><span>Desde</span><input type="date" min={dashboard.metadata.historyStartDate} max={endDate} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>Hasta</span><input type="date" min={startDate} max={dashboard.metadata.lastObservationDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <label><span>Departamento</span><div className="select-wrap"><select value={departmentCode} onChange={(event) => { setDepartmentCode(event.target.value); setMunicipalityCode("00000"); }}><option value="00">Todos los departamentos</option>{dashboard.departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <label><span>Municipio</span><div className="select-wrap"><select value={municipalityCode} disabled={departmentCode === "00"} onChange={(event) => setMunicipalityCode(event.target.value)}><option value="00000">Todos los municipios</option>{municipalityOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <div className="scenario-field"><span>Escenario de sensores</span><div className="segmented" role="group" aria-label="Escenario de sensores"><button className={scenario === "A" ? "active" : ""} onClick={() => setScenario("A")}>A · todos</button><button className={scenario === "B" ? "active" : ""} onClick={() => setScenario("B")}>B · sin SNPP</button></div></div>
      <button className="reset-button" onClick={reset}><RefreshCw size={16} /> Restablecer</button>
    </section>

    <section className="metrics-grid">
      <MetricCard icon={Flame} label="Detecciones visibles" value={numberFormat.format(visiblePoints.length)} detail={`Escenario ${scenario} · ${labelDate(startDate)}–${labelDate(endDate)}`} />
      <MetricCard icon={MapPinned} label="Departamentos" value={numberFormat.format(metrics.departments)} detail="Con al menos una detección asignada" />
      <MetricCard icon={Activity} label="Municipios" value={numberFormat.format(metrics.municipalities)} detail="Asignación oficial DANE 2025" />
      <MetricCard icon={Radio} label="Fuentes satelitales" value={numberFormat.format(metrics.sources)} detail={scenario === "A" ? "MODIS y VIIRS disponibles" : "Suomi-NPP excluido"} />
    </section>

    <section className="workspace-grid">
      <article className="panel map-panel"><div className="panel-heading"><div><p className="panel-kicker">DISTRIBUCIÓN ESPACIAL</p><h2>{title}</h2></div><span className="method-chip">Escenario {scenario}</span></div><div className="map-surface">
        <DashboardMap departments={departmentsGeo} municipalities={municipalitiesGeo} points={visiblePoints} departmentCode={departmentCode} municipalityCode={municipalityCode} onDepartment={(code) => { setDepartmentCode(code); setMunicipalityCode("00000"); }} onMunicipality={setMunicipalityCode} />
        <div className="map-legend"><span><i className="dot-high" /> Detección IDEAM</span><span><i className="area-swatch" /> Límite DANE 2025</span></div><div className="map-caption">Haz clic en un territorio para filtrarlo. Los indicadores y gráficos se recalculan con el periodo y escenario seleccionados.</div>
      </div></article>
      <div className="side-stack">
        <article className="panel chart-panel"><div className="panel-heading compact"><div><p className="panel-kicker">CONCENTRACIÓN</p><h2>{departmentCode === "00" ? "Departamentos" : "Municipios"} con más detecciones</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><BarChart data={ranking} layout="vertical" margin={{ left: 8, right: 26 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8ece8" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10, fill: "#46534a" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => numberFormat.format(Number(value))} cursor={{ fill: "#f4f7f4" }} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} /><Bar dataKey="value" name="Detecciones" fill="#d9462e" radius={[0, 5, 5, 0]} barSize={15} /></BarChart></ResponsiveContainer></div></article>
        <article className="panel chart-panel trend-panel"><div className="panel-heading compact"><div><p className="panel-kicker">EVOLUCIÓN TEMPORAL</p><h2>Detecciones por fecha</h2></div></div><div className="trend-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><AreaChart data={trend} margin={{ left: -18, right: 12, top: 8 }}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f06432" stopOpacity="0.45" /><stop offset="1" stopColor="#f06432" stopOpacity="0.03" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ece8" /><XAxis dataKey="day" tick={{ fontSize: 9, fill: "#647068" }} axisLine={false} tickLine={false} minTickGap={28} /><YAxis tick={{ fontSize: 10, fill: "#647068" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => numberFormat.format(Number(value))} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? labelDate(payload[0].payload.date) : ""} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} /><Area type="monotone" dataKey="value" name="Detecciones" stroke="#c73524" strokeWidth={2.5} fill="url(#trendFill)" /></AreaChart></ResponsiveContainer></div></article>
      </div>
    </section>

    <section className="audit-strip"><div><Database size={18} /><span><strong>Fuente</strong> IDEAM · CSV diario nacional</span></div><div><CalendarDays size={18} /><span><strong>Histórico acumulativo</strong> desde {HISTORY_START_LABEL} · hora Colombia</span></div><div><ShieldCheck size={18} /><span><strong>Cierre territorial</strong> {numberFormat.format(dashboard.metadata.territorialStatus.asignado ?? 0)} asignadas · {numberFormat.format(dashboard.metadata.territorialStatus.sin_asignacion ?? 0)} sin intersección</span></div></section>
    <footer><p>Dashboard nacional en desarrollo · Datos actualizados automáticamente.</p><p>Metodología, fuentes y trazabilidad disponibles en <code>/docs</code>.</p></footer>
  </main>;
}
