const EPOCH_PATTERN = /^-?\d{10,13}(?:\.0+)?$/;
const ESRI_DATE_PATTERN = /^\/Date\((-?\d{10,13})(?:[+-]\d+)?\)\/$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/;
const SLASH_DATE_PATTERN = /^\d{1,2}[/-]\d{1,2}[/-]\d{4}(?:\s.*)?$/;

function clean(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text && text.toLowerCase() !== "null" ? text : "";
}

function plausibleDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= 1900 && year <= 2100;
}

function epochToIso(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  const milliseconds = Math.abs(numeric) < 100_000_000_000 ? numeric * 1_000 : numeric;
  const date = new Date(milliseconds);
  return plausibleDate(date) ? date.toISOString().slice(0, 10) : "";
}

/**
 * Normaliza fechas ArcGIS a YYYY-MM-DD sin interpretar formatos locales ambiguos.
 * Acepta epoch en segundos/milisegundos, /Date(...)/ e ISO 8601.
 * Si el valor no puede identificarse con seguridad, conserva el texto original.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeDateValue(value) {
  const text = clean(value);
  if (!text) return "";

  if (typeof value === "number" || EPOCH_PATTERN.test(text)) {
    return epochToIso(text) || text;
  }

  const esriMatch = text.match(ESRI_DATE_PATTERN);
  if (esriMatch) return epochToIso(esriMatch[1]) || text;

  const isoMatch = text.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
    return plausibleDate(date) ? date.toISOString().slice(0, 10) : text;
  }

  return text;
}

/**
 * Detecta valores que tienen forma de fecha para evitar exponerlos como un
 * atributo administrativo distinto (caso ESTADO_EXP de ANM auditado).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDateLikeValue(value) {
  const text = clean(value);
  if (!text) return false;
  return EPOCH_PATTERN.test(text)
    || ESRI_DATE_PATTERN.test(text)
    || ISO_DATE_PATTERN.test(text)
    || SLASH_DATE_PATTERN.test(text);
}

/**
 * Contrato de publicación de fichas territoriales. Conserva los atributos
 * originales salvo normalizaciones seguras de fechas y la supresión defensiva
 * de ESTADO_EXP de ANM cuando su contenido tiene forma de fecha.
 *
 * @param {string} detailKey
 * @param {Record<string, unknown> | null | undefined} detail
 * @returns {Record<string, unknown> | null}
 */
export function normalizeContextDetail(detailKey, detail) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const source = detailKey.split(":", 1)[0];
  const normalized = { ...detail };

  if (source === "anm") {
    if (isDateLikeValue(normalized.estado)) normalized.estado = "";
    if ("fecha_inscripcion" in normalized) normalized.fecha_inscripcion = normalizeDateValue(normalized.fecha_inscripcion);
    if ("fecha_terminacion" in normalized) normalized.fecha_terminacion = normalizeDateValue(normalized.fecha_terminacion);
  } else if (source === "anla") {
    if ("fecha_acto" in normalized) normalized.fecha_acto = normalizeDateValue(normalized.fecha_acto);
  } else if (source === "anh") {
    if ("fecha_firma" in normalized) normalized.fecha_firma = normalizeDateValue(normalized.fecha_firma);
  }

  return normalized;
}
