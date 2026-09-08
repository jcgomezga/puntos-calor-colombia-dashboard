import { readFileSync, writeFileSync } from "node:fs";

const pagePath = "app/page.tsx";
const cssPath = "app/globals.css";
let page = readFileSync(pagePath, "utf8");
let css = readFileSync(cssPath, "utf8");

const rechartsImport = 'import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";';
if (!page.includes(rechartsImport)) throw new Error("No se encontró el import Recharts esperado.");
page = page.replace(rechartsImport, 'import dynamic from "next/dynamic";');

const anchor = `const LAND_COVER_FAMILY_NAMES: Record<string, string> = {
  "1": "Territorios artificializados",
  "2": "Áreas agrícolas",
  "3": "Bosques y áreas seminaturales",
  "4": "Áreas húmedas",
  "5": "Superficies de agua",
};
`;
if (!page.includes(anchor)) throw new Error("No se encontró el ancla para los gráficos dinámicos.");
page = page.replace(anchor, `${anchor}
const RankingChart = dynamic(() => import("@/components/dashboard-charts").then((module) => module.RankingChart), {
  ssr: false,
  loading: () => <div className="chart-loading" aria-hidden="true">Preparando gráfico…</div>,
});
const TrendChart = dynamic(() => import("@/components/dashboard-charts").then((module) => module.TrendChart), {
  ssr: false,
  loading: () => <div className="chart-loading" aria-hidden="true">Preparando gráfico…</div>,
});
`);

const rankingPattern = /<ResponsiveContainer width="100%" height="100%" minWidth=\{0\} minHeight=\{0\}><BarChart[\s\S]*?<\/BarChart><\/ResponsiveContainer>/;
const trendPattern = /<ResponsiveContainer width="100%" height="100%" minWidth=\{0\} minHeight=\{0\}><AreaChart[\s\S]*?<\/AreaChart><\/ResponsiveContainer>/;
if (!rankingPattern.test(page)) throw new Error("No se encontró el gráfico de ranking esperado.");
if (!trendPattern.test(page)) throw new Error("No se encontró el gráfico temporal esperado.");
page = page.replace(rankingPattern, "<RankingChart data={ranking} />");
page = page.replace(trendPattern, "<TrendChart data={trend} />");

const chartCssAnchor = ".trend-wrap { height: 245px; padding: 10px 13px 12px 8px; }";
if (!css.includes(chartCssAnchor)) throw new Error("No se encontró el ancla CSS de gráficos.");
if (!css.includes(".chart-empty")) {
  css = css.replace(chartCssAnchor, `${chartCssAnchor}
.chart-empty, .chart-loading { width: 100%; height: 100%; display: grid; place-items: center; padding: 18px; color: #637068; font-size: 12px; line-height: 1.45; text-align: center; }
.chart-loading { color: #7a857e; }`);
}

writeFileSync(pagePath, page);
writeFileSync(cssPath, css);
console.log("MB-04: gráficos extraídos a chunk cliente y estados vacíos añadidos.");
