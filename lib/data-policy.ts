import dataPolicy from "@/config/data-policy.json";

const [historyYear, historyMonth, historyDay] = dataPolicy.history_start_date
  .split("-")
  .map(Number);

export const HISTORY_START_DATE = dataPolicy.history_start_date;
export const HISTORY_TIMEZONE = dataPolicy.history_timezone;
export const HISTORY_START_LABEL = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: HISTORY_TIMEZONE,
}).format(new Date(Date.UTC(historyYear, historyMonth - 1, historyDay, 12)));

export const DATA_POLICY = dataPolicy;
