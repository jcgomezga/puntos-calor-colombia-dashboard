"use client";

import {
  Activity,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Database,
  Flame,
  MapPinned,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HISTORY_START_LABEL } from "@/lib/data-policy";

type Scenario = "A" | "B";

const departments = [
  { name: "Todos los departamentos", code: "00" },
  { name: "Tolima", code: "73" },
  { name: "Meta", code: "50" },
  { name: "Caquetá", code: "18" },
  { name: "Antioquia", code: "05" },
  { name: "Guaviare", code: "95" },
  { name: "Vichada", code: "99" },
];

const municipalities: Record<string, string[]> = {
  "00": ["Todos los municipios"],
  "73": ["Todos los municipios", "Armero (Guayabal)", "Ibagué", "San Luis"],
  "50": ["Todos los municipios", "Puerto Gaitán", "La Macarena", "Villavicencio"],
  "18": ["Todos los municipios", "San Vicente del Caguán", "Cartagena del Chairá"],
  "05": ["Todos los municipios", "Caucasia", "Turbo", "Yondó"],
  "95": ["Todos los municipios", "San José del Guaviare", "Calamar"],
  "99": ["Todos los municipios", "Cumaribo", "Puerto Carreño"],
};

const rankings = [
  { name: "Tolima", valueA: 632, valueB: 486 },
  { name: "Meta", valueA: 548, valueB: 374 },
  { name: "Caquetá", valueA: 443, valueB: 318 },
  { name: "Antioquia", valueA: 391, valueB: 282 },
  { name: "Guaviare", valueA: 337, valueB: 248 },
  { name: "Vichada", valueA: 284, valueB: 196 },
];

const trend = [
  { day: "01 ago", valueA: 126, valueB: 83 },
  { day: "05 ago", valueA: 178, valueB: 112 },
  { day: "09 ago", valueA: 246, valueB: 169 },
  { day: "13 ago", valueA: 371, valueB: 258 },
  { day: "17 ago", valueA: 214, valueB: 151 },
  { day: "21 ago", valueA: 284, valueB: 197 },
  { day: "26 ago", valueA: 165, valueB: 109 },
];

const demoPoints = [
  [46, 30, 6], [51, 34, 4], [55, 39, 5], [58, 45, 7], [54, 50, 4],
  [48, 56, 5], [43, 60, 7], [49, 65, 4], [57, 69, 5], [61, 74, 7],
  [55, 80, 4], [47, 75, 6], [39, 66, 4], [36, 57, 5], [41, 48, 4],
  [44, 41, 3], [64, 59, 4], [68, 64, 5], [63, 83, 4], [31, 45, 3],
];

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon"><Icon size={18} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>("B");
  const [department, setDepartment] = useState("00");
  const [municipality, setMunicipality] = useState("Todos los municipios");

  const rankData = useMemo(
    () => rankings.map((item) => ({ name: item.name, value: scenario === "A" ? item.valueA : item.valueB })),
    [scenario],
  );
  const trendData = useMemo(
    () => trend.map((item) => ({ day: item.day, value: scenario === "A" ? item.valueA : item.valueB })),
    [scenario],
  );
  const multiplier = scenario === "A" ? 1 : 0.71;
  const selectedDepartment = departments.find((item) => item.code === department)?.name ?? "Colombia";

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark"><Flame size={21} /></div>
          <div>
            <p className="eyebrow">MONITOREO TERRITORIAL · COLOMBIA</p>
            <h1>Detecciones de calor</h1>
          </div>
        </div>
        <div className="status-cluster">
          <span className="demo-badge">PROTOTIPO · DATOS DEMOSTRATIVOS</span>
          <span className="status-chip"><CalendarDays size={14} /> Histórico desde {HISTORY_START_LABEL}</span>
          <span className="status-chip"><span className="pulse" /> Última carga simulada: 30 ago 2026</span>
        </div>
      </header>

      <section className="notice" aria-label="Advertencia metodológica">
        <CircleAlert size={18} />
        <p><strong>Lectura responsable:</strong> una detección térmica no confirma por sí sola un incendio ni su causa. Las cifras de esta fase son demostrativas y sirven para validar la interfaz.</p>
      </section>

      <section className="filterbar" aria-label="Filtros territoriales y metodológicos">
        <label>
          <span>Departamento</span>
          <div className="select-wrap">
            <select value={department} onChange={(event) => { setDepartment(event.target.value); setMunicipality("Todos los municipios"); }}>
              {departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </label>
        <label>
          <span>Municipio</span>
          <div className="select-wrap">
            <select value={municipality} onChange={(event) => setMunicipality(event.target.value)}>
              {(municipalities[department] ?? municipalities["00"]).map((name) => <option key={name}>{name}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
        </label>
        <div className="scenario-field">
          <span>Escenario de sensores</span>
          <div className="segmented" role="group" aria-label="Escenario de sensores">
            <button className={scenario === "A" ? "active" : ""} onClick={() => setScenario("A")}>A · todos</button>
            <button className={scenario === "B" ? "active" : ""} onClick={() => setScenario("B")}>B · sin SNPP</button>
          </div>
        </div>
        <button className="reset-button" onClick={() => { setDepartment("00"); setMunicipality("Todos los municipios"); setScenario("B"); }}>
          <RefreshCw size={16} /> Restablecer
        </button>
      </section>

      <section className="metrics-grid">
        <MetricCard icon={Flame} label="Hotspots visibles" value={Math.round(2564 * multiplier).toLocaleString("es-CO")} detail={`Escenario ${scenario} · periodo activo`} />
        <MetricCard icon={MapPinned} label="Departamentos" value={scenario === "A" ? "31" : "29"} detail="Con al menos una detección" />
        <MetricCard icon={Activity} label="Municipios" value={Math.round(384 * multiplier).toLocaleString("es-CO")} detail="Asignación DANE proyectada" />
        <MetricCard icon={Radio} label="Sensores" value={scenario === "A" ? "4" : "3"} detail={scenario === "A" ? "MODIS + VIIRS" : "SNPP excluido"} />
      </section>

      <section className="workspace-grid">
        <article className="panel map-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">DISTRIBUCIÓN ESPACIAL</p><h2>{municipality !== "Todos los municipios" ? municipality : selectedDepartment}</h2></div>
            <span className="method-chip">Escenario {scenario}</span>
          </div>
          <div className="map-surface" role="img" aria-label="Vista demostrativa de detecciones térmicas en Colombia">
            <svg viewBox="0 0 100 112" aria-hidden="true">
              <defs>
                <linearGradient id="countryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#dce9dd" />
                  <stop offset="1" stopColor="#c5dccb" />
                </linearGradient>
                <filter id="glow"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <path className="country" d="M39 5 L50 9 58 18 63 25 69 28 66 37 71 44 66 50 70 61 66 70 67 81 61 91 57 106 50 101 46 90 39 83 37 72 30 62 32 53 27 44 31 35 27 25 34 18 Z" />
              <path className="dept-line" d="M34 18 L58 18 M30 34 L66 37 M31 52 L68 54 M37 72 L66 70 M45 90 L62 89 M49 9 L45 101 M34 36 L57 106 M61 26 L38 83" />
              {demoPoints.slice(0, scenario === "A" ? 20 : 15).map(([x, y, r], index) => (
                <g key={`${x}-${y}`} filter="url(#glow)">
                  <circle cx={x} cy={y} r={r / 2.2} fill="#df3f25" opacity="0.22" />
                  <circle cx={x} cy={y} r={Math.max(0.8, r / 5)} fill={index % 3 === 0 ? "#a92319" : "#f15a24"} stroke="#fff6ed" strokeWidth="0.35" />
                </g>
              ))}
            </svg>
            <div className="map-legend">
              <span><i className="dot-high" /> Detección demostrativa</span>
              <span><i className="area-swatch" /> Límite de referencia</span>
            </div>
            <div className="map-caption">La cartografía DANE y los datos oficiales IDEAM se incorporan en las fases 2 y 3.</div>
          </div>
        </article>

        <div className="side-stack">
          <article className="panel chart-panel">
            <div className="panel-heading compact"><div><p className="panel-kicker">CONCENTRACIÓN</p><h2>Departamentos con más detecciones</h2></div></div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={rankData} layout="vertical" margin={{ left: 8, right: 26 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8ece8" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11, fill: "#46534a" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f4f7f4" }} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} />
                  <Bar dataKey="value" fill="#d9462e" radius={[0, 5, 5, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel chart-panel trend-panel">
            <div className="panel-heading compact"><div><p className="panel-kicker">EVOLUCIÓN TEMPORAL</p><h2>Detecciones por fecha</h2></div></div>
            <div className="trend-wrap">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={trendData} margin={{ left: -22, right: 12, top: 8 }}>
                  <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f06432" stopOpacity="0.45" /><stop offset="1" stopColor="#f06432" stopOpacity="0.03" /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ece8" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#647068" }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: "#647068" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#c73524" strokeWidth={2.5} fill="url(#trendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      </section>

      <section className="audit-strip">
        <div><Database size={18} /><span><strong>Fuente prevista</strong> IDEAM · CSV diario</span></div>
        <div><CalendarDays size={18} /><span><strong>Histórico acumulativo</strong> desde {HISTORY_START_LABEL} · hora Colombia</span></div>
        <div><ShieldCheck size={18} /><span><strong>Control</strong> deduplicación, integridad y cierre territorial</span></div>
      </section>

      <footer>
        <p>Prototipo técnico nacional · Las cifras visibles no son resultados oficiales.</p>
        <p>Metodología, fuentes y trazabilidad disponibles en <code>/docs</code>.</p>
      </footer>
    </main>
  );
}
