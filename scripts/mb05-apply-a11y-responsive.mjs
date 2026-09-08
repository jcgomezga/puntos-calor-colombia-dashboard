import { readFileSync, writeFileSync } from "node:fs";

const pagePath = "app/page.tsx";
const cssPath = "app/globals.css";
let page = readFileSync(pagePath, "utf8");
let css = readFileSync(cssPath, "utf8");

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`No se encontró el fragmento esperado: ${label}`);
  const updated = source.replace(from, to);
  if (updated.includes(from)) throw new Error(`El fragmento aparece más de una vez: ${label}`);
  return updated;
}

page = replaceOnce(
  page,
  '<button className={mapMode === "geovisor" ? "active" : ""} onClick={() => setMapMode("geovisor")}>Geovisor</button><button className={mapMode === "basic" ? "active" : ""} onClick={() => setMapMode("basic")}>Mapa básico</button>',
  '<button className={mapMode === "geovisor" ? "active" : ""} aria-pressed={mapMode === "geovisor"} onClick={() => setMapMode("geovisor")}>Geovisor</button><button className={mapMode === "basic" ? "active" : ""} aria-pressed={mapMode === "basic"} onClick={() => setMapMode("basic")}>Mapa básico</button>',
  "aria-pressed del modo de mapa",
);
page = replaceOnce(
  page,
  '<button className={trendGrouping === "day" ? "active" : ""} onClick={() => setTrendGrouping("day")}>Días</button><button className={trendGrouping === "month" ? "active" : ""} onClick={() => setTrendGrouping("month")}>Meses</button>',
  '<button className={trendGrouping === "day" ? "active" : ""} aria-pressed={trendGrouping === "day"} onClick={() => setTrendGrouping("day")}>Días</button><button className={trendGrouping === "month" ? "active" : ""} aria-pressed={trendGrouping === "month"} onClick={() => setTrendGrouping("month")}>Meses</button>',
  "aria-pressed de agrupación temporal",
);
page = replaceOnce(
  page,
  '<RankingChart data={ranking} />',
  '<RankingChart data={ranking} label={`Ranking de ${departmentCode === "00" ? "departamentos" : "municipios"} con más detecciones`} />',
  "nombre accesible del ranking",
);
page = replaceOnce(
  page,
  '<TrendChart data={trend} />',
  '<TrendChart data={trend} label={`Serie temporal de detecciones por ${trendGrouping === "day" ? "día" : "mes"}`} />',
  "nombre accesible de la serie temporal",
);

css = replaceOnce(
  css,
  '.select-wrap select, .filterbar input { width: 100%; height: 37px; appearance: none; padding: 0 34px 0 11px; border: 1px solid #ced8d0; border-radius: 7px; background: #fbfcfb; color: #263129; font-size: 12px; outline: none; }',
  '.select-wrap select, .filterbar input { width: 100%; height: 44px; appearance: none; padding: 0 34px 0 11px; border: 1px solid #ced8d0; border-radius: 7px; background: #fbfcfb; color: #263129; font-size: 12px; outline: none; }',
  "altura de inputs y selects",
);
css = replaceOnce(
  css,
  '.select-wrap svg { position: absolute; top: 11px; right: 10px; pointer-events: none; color: #65736a; }',
  '.select-wrap svg { position: absolute; top: 14px; right: 10px; pointer-events: none; color: #65736a; }',
  "alineación del chevron",
);
css = replaceOnce(
  css,
  '.segmented { display: grid; grid-template-columns: 1fr 1fr; height: 37px; padding: 3px; border-radius: 8px; background: #edf1ed; }',
  '.segmented { display: grid; grid-template-columns: 1fr 1fr; min-height: 50px; padding: 3px; border-radius: 8px; background: #edf1ed; }',
  "contenedor segmentado",
);
css = replaceOnce(
  css,
  '.segmented button { border: 0; border-radius: 6px; background: transparent; color: #5a665f; font-size: 11px; font-weight: 700; }',
  '.segmented button { min-height: 44px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: #5a665f; font-size: 11px; font-weight: 700; }',
  "targets del segmentado",
);
css = replaceOnce(
  css,
  '.reset-button { height: 37px; padding: 0 13px; display: flex; align-items: center; gap: 7px; border: 1px solid #bfcac1; border-radius: 7px; background: white; color: #34443a; font-size: 11px; font-weight: 750; }',
  '.reset-button { min-height: 44px; padding: 0 13px; display: flex; align-items: center; gap: 7px; border: 1px solid #bfcac1; border-radius: 7px; background: white; color: #34443a; font-size: 11px; font-weight: 750; }',
  "target del botón restablecer",
);
css = replaceOnce(
  css,
  '.metric-card span { display: block; margin-top: 4px; color: #7a857e; font-size: 10px; }',
  '.metric-card span { display: block; margin-top: 4px; color: var(--muted); font-size: 10px; }',
  "contraste de detalle en métricas",
);
css = replaceOnce(
  css,
  '.trend-toggle button { min-width: 48px; padding: 5px 7px; border: 0; border-radius: 5px; background: transparent; color: #637068; font-size: 10px; font-weight: 750; }',
  '.trend-toggle button { min-width: 48px; min-height: 44px; padding: 5px 9px; border: 0; border-radius: 5px; background: transparent; color: #637068; font-size: 10px; font-weight: 750; }',
  "targets de agrupación temporal",
);
css = replaceOnce(
  css,
  '.chart-loading { color: #7a857e; }',
  '.chart-loading { color: var(--muted); }',
  "contraste del estado de carga",
);
css = replaceOnce(
  css,
  'footer { padding: 17px 2px 0; display: flex; justify-content: space-between; gap: 16px; color: #7a857e; font-size: 10px; }',
  'footer { padding: 17px 2px 0; display: flex; justify-content: space-between; gap: 16px; color: var(--muted); font-size: 10px; }',
  "contraste del pie de página",
);

const focusAnchor = '.reset-button { min-height: 44px; padding: 0 13px; display: flex; align-items: center; gap: 7px; border: 1px solid #bfcac1; border-radius: 7px; background: white; color: #34443a; font-size: 11px; font-weight: 750; }';
css = replaceOnce(
  css,
  focusAnchor,
  `${focusAnchor}\n.filterbar input:focus-visible, .filterbar select:focus-visible, .reset-button:focus-visible, .segmented button:focus-visible, .trend-toggle button:focus-visible, .notice a:focus-visible, footer a:focus-visible { outline: 3px solid #2f6844; outline-offset: 2px; }`,
  "foco visible de controles no cartográficos",
);

const chartAnchor = '.chart-empty, .chart-loading { width: 100%; height: 100%; display: grid; place-items: center; padding: 18px; color: #637068; font-size: 12px; line-height: 1.45; text-align: center; }';
css = replaceOnce(
  css,
  chartAnchor,
  `${chartAnchor}\n.chart-figure, .chart-visual { width: 100%; height: 100%; margin: 0; }\n.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }`,
  "alternativa textual oculta de gráficos",
);

const tabletAnchor = '@media (max-width: 980px) {\n  .filterbar { grid-template-columns: repeat(3, 1fr); }\n  .metrics-grid { grid-template-columns: repeat(2, 1fr); }\n  .workspace-grid { grid-template-columns: 1fr; }\n  .episode-workspace { grid-template-columns: 1fr; }\n  .side-stack { grid-template-columns: 1fr 1fr; grid-template-rows: none; }\n}';
css = replaceOnce(
  css,
  tabletAnchor,
  '@media (max-width: 980px) {\n  .filterbar { grid-template-columns: repeat(3, 1fr); }\n  .metrics-grid { grid-template-columns: repeat(2, 1fr); }\n  .workspace-grid { grid-template-columns: 1fr; }\n  .episode-workspace { grid-template-columns: 1fr; }\n  .side-stack { grid-template-columns: 1fr 1fr; grid-template-rows: none; }\n  .trend-panel .panel-heading { align-items: flex-start; flex-direction: column; }\n  .trend-actions { width: 100%; justify-content: space-between; }\n}',
  "cabecera de tendencia en tablet",
);
css = replaceOnce(
  css,
  '  .panel-heading { align-items: flex-start; }',
  '  .panel-heading { align-items: stretch; flex-direction: column; }\n  .segmented { width: 100%; }',
  "cabeceras móviles",
);
css = replaceOnce(
  css,
  '  .trend-actions { align-items: flex-end; flex-direction: column; }',
  '  .trend-actions { align-items: stretch; flex-direction: column; width: 100%; }\n  .trend-toggle { width: 100%; }',
  "controles temporales móviles",
);

writeFileSync(pagePath, page);
writeFileSync(cssPath, css);
console.log("MB-05: semántica, contraste, targets y responsive no cartográfico aplicados.");
