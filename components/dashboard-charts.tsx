"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const numberFormat = new Intl.NumberFormat("es-CO");

type RankingDatum = { name: string; value: number };
type TrendDatum = { period: string; day: string; label: string; value: number };

function EmptyChart() {
  return <div className="chart-empty" role="status">No hay detecciones para los filtros seleccionados.</div>;
}

export function RankingChart({ data }: { data: RankingDatum[] }) {
  if (!data.length) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 26 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8ece8" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10, fill: "#46534a" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value) => numberFormat.format(Number(value))} cursor={{ fill: "#f4f7f4" }} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} />
        <Bar dataKey="value" name="Detecciones" fill="#d9462e" radius={[0, 5, 5, 0]} barSize={15} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: TrendDatum[] }) {
  if (!data.length || data.every((item) => item.value === 0)) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <AreaChart data={data} margin={{ left: -18, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f06432" stopOpacity="0.45" />
            <stop offset="1" stopColor="#f06432" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ece8" />
        <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#647068" }} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis tick={{ fontSize: 10, fill: "#647068" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value) => numberFormat.format(Number(value))} labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} contentStyle={{ borderRadius: 8, borderColor: "#dbe3dc", fontSize: 12 }} />
        <Area type="monotone" dataKey="value" name="Detecciones" stroke="#c73524" strokeWidth={2.5} fill="url(#trendFill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
