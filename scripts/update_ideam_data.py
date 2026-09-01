#!/usr/bin/env python3
"""Ingesta reproducible de CSV diarios de puntos de calor del IDEAM.

No requiere dependencias externas. Descarga archivos diarios, aplica el corte
histórico antes de escribir salidas normalizadas, deduplica observaciones y
genera manifiestos auditables para el dashboard.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_CONFIG = ROOT / "config" / "data-policy.json"
DEFAULT_BASE_URL = "https://puntosdecalor.ideam.gov.co/archivos-csv"
FILE_PREFIX = "Puntos_de_calor_Colombia_"
FILE_PATTERN = re.compile(r"^Puntos_de_calor_Colombia_(\d{4}-\d{2}-\d{2})\.csv$")

NORMALIZED_FIELDS = [
    "hotspot_id",
    "fecha_hora_col",
    "fecha_hora_utc",
    "fecha_local",
    "latitud",
    "longitud",
    "fuente",
    "satelite",
    "sensor",
    "temperatura_c",
    "temperatura_alt_c",
    "frp_mw",
    "confianza",
    "captura",
    "scan_km",
    "track_km",
    "escenario_a",
    "escenario_b",
    "fuente_archivo",
    "fecha_descarga_utc",
]

SOURCE_MAP = {
    "MODIS-Aqua": ("MODIS", "Aqua"),
    "MODIS-Terra": ("MODIS", "Terra"),
    "VIIRS-NOAA-20": ("VIIRS", "NOAA-20"),
    "VIIRS-NOAA-21": ("VIIRS", "NOAA-21"),
    "VIIRS-Suomi-NPP": ("VIIRS", "Suomi-NPP"),
    "VIIRS": ("VIIRS", "No especificado"),
}

HEADER_ALIASES = {
    "fecha_utc5": {"fecha utc 5", "fecha utc-5"},
    "lat": {"lat", "latitud"},
    "lon": {"lon", "longitud"},
    "fuente": {"fuente", "source"},
    "temperatura": {"temperatura c"},
    "temperatura_alt": {"temperatura alt c"},
    "frp": {"radiacion termica mw", "frp", "frp mw"},
    "confianza": {"confianza"},
    "captura": {"captura dia noche", "captura diurnanocturna"},
    "scan": {"scan real pixel size km", "scan km"},
    "track": {"track real pixel size km", "track km"},
}


@dataclass(frozen=True)
class Policy:
    start_date: date
    timezone_name: str
    timezone: ZoneInfo
    inclusive: bool
    retain_raw_before_start: bool
    mode: str
    version: str


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def load_policy(path: Path = DEFAULT_CONFIG) -> Policy:
    raw = json.loads(path.read_text(encoding="utf-8"))
    start = date.fromisoformat(raw["history_start_date"])
    return Policy(
        start_date=start,
        timezone_name=raw["history_timezone"],
        timezone=ZoneInfo(raw["history_timezone"]),
        inclusive=bool(raw["history_start_inclusive"]),
        retain_raw_before_start=bool(raw["retain_raw_before_history_start"]),
        mode=raw["history_mode"],
        version=raw["policy_version"],
    )


def dates_between(start: date, end: date) -> Iterable[date]:
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def dates_for_mode(mode: str, as_of: date, policy: Policy) -> list[date]:
    if as_of < policy.start_date:
        return []
    if mode == "backfill":
        start = policy.start_date
    elif mode == "refresh":
        start = max(policy.start_date, as_of - timedelta(days=2))
    elif mode == "offline":
        return []
    else:
        raise ValueError(f"Modo desconocido: {mode}")
    return list(dates_between(start, as_of))


def daily_filename(day: date) -> str:
    return f"{FILE_PREFIX}{day.isoformat()}.csv"


def daily_url(base_url: str, day: date) -> str:
    return f"{base_url.rstrip('/')}/{daily_filename(day)}"


def raw_path(data_dir: Path, day: date) -> Path:
    return data_dir / "raw" / f"{day.year:04d}" / f"{day.month:02d}" / daily_filename(day)


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def atomic_write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(content)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def atomic_write_text(path: Path, content: str) -> None:
    atomic_write_bytes(path, content.encode("utf-8"))


def download_file_curl(url: str, timeout: int = 60, attempts: int = 3) -> tuple[bytes, dict[str, str]]:
    marker = b"\n__HTTP_STATUS__:"
    command = [
        "curl",
        "--location",
        "--silent",
        "--show-error",
        "--connect-timeout",
        str(min(timeout, 15)),
        "--max-time",
        str(timeout),
        "--retry",
        str(max(0, attempts - 1)),
        "--retry-all-errors",
        "--user-agent",
        "puntos-calor-colombia-dashboard/0.2 (+https://github.com/jcgomezga/puntos-calor-colombia-dashboard)",
        "--write-out",
        "\n__HTTP_STATUS__:%{http_code}",
        url,
    ]
    completed = subprocess.run(command, capture_output=True, check=False)
    content, separator, status_bytes = completed.stdout.rpartition(marker)
    status = int(status_bytes.decode("ascii")) if separator and status_bytes.isdigit() else 0
    if status == 404:
        raise HTTPError(url, 404, "Not Found", {}, None)
    if completed.returncode != 0 or status < 200 or status >= 300:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise URLError(f"curl={completed.returncode}, HTTP={status}: {detail}")
    if not content:
        raise ValueError("respuesta vacía")
    return content, {}


def download_file(
    url: str,
    timeout: int = 60,
    attempts: int = 3,
    transport: str = "auto",
) -> tuple[bytes, dict[str, str]]:
    if transport == "curl":
        return download_file_curl(url, timeout=timeout, attempts=attempts)
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        request = Request(
            url,
            headers={
                "User-Agent": "puntos-calor-colombia-dashboard/0.2 (+https://github.com/jcgomezga/puntos-calor-colombia-dashboard)",
                "Accept": "text/csv,text/plain;q=0.9,*/*;q=0.1",
            },
        )
        try:
            with urlopen(request, timeout=timeout) as response:
                content = response.read()
                if not content:
                    raise ValueError("respuesta vacía")
                return content, {key.lower(): value for key, value in response.headers.items()}
        except HTTPError as exc:
            if exc.code == 404:
                raise
            last_error = exc
        except (URLError, TimeoutError, ValueError) as exc:
            last_error = exc
        if attempt < attempts:
            time.sleep(attempt * 2)
    if transport == "auto" and isinstance(last_error, URLError) and "CERTIFICATE_VERIFY_FAILED" in str(last_error):
        return download_file_curl(url, timeout=timeout, attempts=attempts)
    if last_error is None:
        raise RuntimeError("descarga fallida sin detalle")
    raise last_error


def normalized_header(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lstrip("\ufeff"))
    value = "".join(character for character in value if not unicodedata.combining(character))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def resolve_headers(fieldnames: list[str] | None) -> dict[str, str]:
    if not fieldnames:
        raise ValueError("CSV sin encabezado")
    normalized = {normalized_header(name): name for name in fieldnames}
    resolved: dict[str, str] = {}
    for target, aliases in HEADER_ALIASES.items():
        match = next((normalized[alias] for alias in aliases if alias in normalized), None)
        if match:
            resolved[target] = match
    required = {"fecha_utc5", "lat", "lon", "fuente"}
    missing = sorted(required - set(resolved))
    if missing:
        raise ValueError(f"Encabezados obligatorios ausentes: {', '.join(missing)}")
    return resolved


def canonical_decimal(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = value.strip().replace(" ", "").replace(",", ".")
    if not cleaned:
        return ""
    try:
        number = Decimal(cleaned)
    except InvalidOperation as exc:
        raise ValueError(f"decimal inválido: {value!r}") from exc
    rendered = format(number.normalize(), "f")
    return "0" if rendered in {"-0", ""} else rendered


def parse_local_datetime(value: str, policy: Policy) -> datetime:
    cleaned = value.strip()
    formats = ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M")
    for date_format in formats:
        try:
            return datetime.strptime(cleaned, date_format).replace(tzinfo=policy.timezone)
        except ValueError:
            continue
    raise ValueError(f"fecha inválida: {value!r}")


def stable_hotspot_id(row: dict[str, str]) -> str:
    stable_fields = (
        row["fecha_hora_col"],
        row["latitud"],
        row["longitud"],
        row["fuente"],
        row["scan_km"],
        row["track_km"],
    )
    return hashlib.sha256("|".join(stable_fields).encode("utf-8")).hexdigest()[:24]


def normalize_row(
    source_row: dict[str, str],
    headers: dict[str, str],
    policy: Policy,
    source_file: str,
    downloaded_at: str,
) -> tuple[str, dict[str, str] | None]:
    when_local = parse_local_datetime(source_row.get(headers["fecha_utc5"], ""), policy)
    if when_local.date() < policy.start_date:
        return "cutoff", None

    latitude = canonical_decimal(source_row.get(headers["lat"]))
    longitude = canonical_decimal(source_row.get(headers["lon"]))
    lat_float = float(latitude)
    lon_float = float(longitude)
    if not (-5.0 <= lat_float <= 14.0 and -82.0 <= lon_float <= -66.0):
        raise ValueError(f"coordenada fuera del control Colombia: {latitude}, {longitude}")

    source = source_row.get(headers["fuente"], "").strip()
    if not source:
        raise ValueError("fuente vacía")
    sensor, satellite = SOURCE_MAP.get(source, ("No clasificado", source))

    def field(name: str) -> str:
        header = headers.get(name)
        return source_row.get(header, "").strip() if header else ""

    normalized = {
        "fecha_hora_col": when_local.isoformat(timespec="minutes"),
        "fecha_hora_utc": iso_utc(when_local),
        "fecha_local": when_local.date().isoformat(),
        "latitud": latitude,
        "longitud": longitude,
        "fuente": source,
        "satelite": satellite,
        "sensor": sensor,
        "temperatura_c": canonical_decimal(field("temperatura")),
        "temperatura_alt_c": canonical_decimal(field("temperatura_alt")),
        "frp_mw": canonical_decimal(field("frp")),
        "confianza": field("confianza"),
        "captura": field("captura").upper(),
        "scan_km": canonical_decimal(field("scan")),
        "track_km": canonical_decimal(field("track")),
        "escenario_a": "true",
        "escenario_b": "false" if source == "VIIRS-Suomi-NPP" else "true",
        "fuente_archivo": source_file,
        "fecha_descarga_utc": downloaded_at,
    }
    normalized["hotspot_id"] = stable_hotspot_id(normalized)
    return "valid", normalized


def file_date(path: Path) -> date:
    match = FILE_PATTERN.match(path.name)
    if not match:
        raise ValueError(f"nombre diario no reconocido: {path.name}")
    return date.fromisoformat(match.group(1))


def iter_raw_files(data_dir: Path, policy: Policy) -> list[Path]:
    candidates = sorted((data_dir / "raw").glob("*/*/Puntos_de_calor_Colombia_*.csv"))
    older = [path for path in candidates if file_date(path) < policy.start_date]
    if older and not policy.retain_raw_before_start:
        names = ", ".join(str(path.relative_to(data_dir)) for path in older[:3])
        raise RuntimeError(f"se encontraron archivos brutos anteriores al corte: {names}")
    return [path for path in candidates if file_date(path) >= policy.start_date]


def read_raw_file(path: Path, policy: Policy, downloaded_at: str) -> tuple[list[dict[str, str]], dict[str, int]]:
    counters = Counter(read=0, valid=0, rejected_cutoff=0, rejected_invalid=0)
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream, delimiter=";")
        headers = resolve_headers(reader.fieldnames)
        for source_row in reader:
            if not any((value or "").strip() for value in source_row.values()):
                continue
            counters["read"] += 1
            try:
                status, normalized = normalize_row(
                    source_row, headers, policy, path.name, downloaded_at
                )
            except (ValueError, TypeError):
                counters["rejected_invalid"] += 1
                continue
            if status == "cutoff":
                counters["rejected_cutoff"] += 1
                continue
            counters["valid"] += 1
            if normalized is not None:
                rows.append(normalized)
    return rows, dict(counters)


def write_monthly_files(data_dir: Path, rows: list[dict[str, str]]) -> list[dict[str, object]]:
    groups: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        groups.setdefault(row["fecha_local"][:7], []).append(row)
    outputs: list[dict[str, object]] = []
    for month, month_rows in sorted(groups.items()):
        month_rows.sort(key=lambda item: (item["fecha_hora_col"], item["hotspot_id"]))
        path = data_dir / "processed" / f"hotspots_{month}.csv"
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="", delete=False, dir=path.parent, prefix=f".{path.name}."
        ) as stream:
            writer = csv.DictWriter(stream, fieldnames=NORMALIZED_FIELDS)
            writer.writeheader()
            writer.writerows(month_rows)
            temp_name = stream.name
        os.replace(temp_name, path)
        content = path.read_bytes()
        outputs.append({
            "month": month,
            "path": str(path.relative_to(data_dir)),
            "rows": len(month_rows),
            "size_bytes": len(content),
            "sha256": sha256_bytes(content),
        })
    return outputs


def write_json(path: Path, payload: object) -> None:
    atomic_write_text(path, json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def append_run_log(path: Path, run: dict[str, object]) -> None:
    fields = [
        "run_id", "started_at_utc", "finished_at_utc", "mode", "as_of",
        "requested_files", "downloaded_files", "missing_files", "failed_files",
        "raw_files_processed", "rows_read", "rows_valid_before_dedup",
        "rows_unique", "rows_rejected_cutoff", "rows_rejected_invalid", "status",
    ]
    existing: list[dict[str, str]] = []
    if path.exists():
        with path.open("r", encoding="utf-8", newline="") as stream:
            existing = list(csv.DictReader(stream))
    current = {field: str(run.get(field, "")) for field in fields}
    if not any(row.get("run_id") == current["run_id"] for row in existing):
        existing.append(current)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=path.parent, prefix=f".{path.name}."
    ) as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(existing)
        temp_name = stream.name
    os.replace(temp_name, path)


def process_data(data_dir: Path, policy: Policy, manifest: dict[str, object], run_time: datetime) -> dict[str, object]:
    downloaded_by_name = {
        Path(entry["path"]).name: str(entry.get("downloaded_at_utc", iso_utc(run_time)))
        for entry in manifest.get("raw_files", [])
        if isinstance(entry, dict) and entry.get("path")
    }
    file_stats: dict[str, dict[str, int]] = {}
    deduplicated: dict[str, dict[str, str]] = {}
    total = Counter()
    raw_files = iter_raw_files(data_dir, policy)
    for path in raw_files:
        rows, counters = read_raw_file(
            path, policy, downloaded_by_name.get(path.name, iso_utc(run_time))
        )
        file_stats[path.name] = counters
        total.update(counters)
        for row in rows:
            deduplicated[row["hotspot_id"]] = row

    unique_rows = list(deduplicated.values())
    outputs = write_monthly_files(data_dir, unique_rows)
    source_counts = Counter(row["fuente"] for row in unique_rows)
    sensor_counts = Counter(row["sensor"] for row in unique_rows)
    dates = [row["fecha_hora_col"] for row in unique_rows]

    summary = {
        "generated_at_utc": iso_utc(run_time),
        "policy": {
            "history_start_date": policy.start_date.isoformat(),
            "timezone": policy.timezone_name,
            "inclusive": policy.inclusive,
            "history_mode": policy.mode,
            "policy_version": policy.version,
        },
        "raw_files": len(raw_files),
        "rows_read": total["read"],
        "rows_valid_before_dedup": total["valid"],
        "rows_unique": len(unique_rows),
        "duplicates_removed": total["valid"] - len(unique_rows),
        "rows_rejected_cutoff": total["rejected_cutoff"],
        "rows_rejected_invalid": total["rejected_invalid"],
        "first_observation_local": min(dates) if dates else None,
        "last_observation_local": max(dates) if dates else None,
        "scenario_a_rows": len(unique_rows),
        "scenario_b_rows": sum(row["escenario_b"] == "true" for row in unique_rows),
        "by_source": dict(sorted(source_counts.items())),
        "by_sensor": dict(sorted(sensor_counts.items())),
        "processed_files": outputs,
    }
    write_json(data_dir / "metadata" / "summary.json", summary)

    entries = manifest.get("raw_files", [])
    for entry in entries:
        if isinstance(entry, dict) and Path(str(entry.get("path", ""))).name in file_stats:
            entry.update(file_stats[Path(str(entry["path"])).name])
    manifest["generated_at_utc"] = iso_utc(run_time)
    manifest["policy"] = summary["policy"]
    manifest["raw_files"] = sorted(entries, key=lambda item: str(item.get("date", "")))
    manifest["processed_files"] = outputs
    write_json(data_dir / "metadata" / "manifest.json", manifest)
    return summary


def run(args: argparse.Namespace) -> int:
    policy = load_policy(Path(args.config))
    data_dir = Path(args.data_dir)
    as_of = date.fromisoformat(args.as_of) if args.as_of else datetime.now(policy.timezone).date()
    started = utc_now()
    run_id = started.strftime("%Y%m%dT%H%M%SZ")
    metadata_dir = data_dir / "metadata"
    manifest_path = metadata_dir / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {"raw_files": [], "processed_files": []}
    entries_by_date = {
        str(entry.get("date")): entry
        for entry in manifest.get("raw_files", [])
        if isinstance(entry, dict)
    }

    requested = dates_for_mode(args.mode, as_of, policy)
    downloaded = 0
    missing: list[str] = []
    failed: list[dict[str, str]] = []
    def fetch_day(day: date) -> tuple[date, str, bytes | None, dict[str, str], str | None]:
        url = daily_url(args.base_url, day)
        try:
            content, headers = download_file(
                url,
                timeout=args.timeout,
                attempts=args.attempts,
                transport=args.transport,
            )
        except HTTPError as exc:
            if exc.code == 404:
                return day, url, None, {}, "missing"
            return day, url, None, {}, f"HTTP {exc.code}"
        except Exception as exc:  # noqa: BLE001 - the run must record source failures
            return day, url, None, {}, f"{type(exc).__name__}: {exc}"
        return day, url, content, headers, None

    results: dict[date, tuple[str, bytes | None, dict[str, str], str | None]] = {}
    if requested:
        with ThreadPoolExecutor(max_workers=min(args.workers, len(requested))) as executor:
            futures = {executor.submit(fetch_day, day): day for day in requested}
            for future in as_completed(futures):
                day, url, content, headers, error = future.result()
                results[day] = (url, content, headers, error)

    for day in requested:
        url, content, headers, error = results[day]
        if error == "missing":
            missing.append(day.isoformat())
            continue
        if error:
            failed.append({"date": day.isoformat(), "error": error})
            continue
        if content is None:
            failed.append({"date": day.isoformat(), "error": "respuesta sin contenido"})
            continue
        path = raw_path(data_dir, day)
        atomic_write_bytes(path, content)
        downloaded += 1
        entries_by_date[day.isoformat()] = {
            "date": day.isoformat(),
            "path": str(path.relative_to(data_dir)),
            "url": url,
            "size_bytes": len(content),
            "sha256": sha256_bytes(content),
            "downloaded_at_utc": iso_utc(started),
            "last_modified": headers.get("last-modified"),
        }

    manifest["raw_files"] = list(entries_by_date.values())
    summary = process_data(data_dir, policy, manifest, started)
    if summary["raw_files"] == 0:
        status = "failed_no_data"
    elif failed:
        status = "completed_with_warnings"
    else:
        status = "completed"

    finished = utc_now()
    run_record = {
        "run_id": run_id,
        "started_at_utc": iso_utc(started),
        "finished_at_utc": iso_utc(finished),
        "mode": args.mode,
        "as_of": as_of.isoformat(),
        "history_start_date": policy.start_date.isoformat(),
        "requested_files": len(requested),
        "downloaded_files": downloaded,
        "missing_files": len(missing),
        "missing_dates": missing,
        "failed_files": len(failed),
        "failures": failed,
        "raw_files_processed": summary["raw_files"],
        "rows_read": summary["rows_read"],
        "rows_valid_before_dedup": summary["rows_valid_before_dedup"],
        "rows_unique": summary["rows_unique"],
        "rows_rejected_cutoff": summary["rows_rejected_cutoff"],
        "rows_rejected_invalid": summary["rows_rejected_invalid"],
        "status": status,
    }
    write_json(metadata_dir / "latest_run.json", run_record)
    append_run_log(metadata_dir / "run_log.csv", run_record)
    print(json.dumps(run_record, ensure_ascii=False, indent=2))
    return 1 if status == "failed_no_data" else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("backfill", "refresh", "offline"), default="refresh")
    parser.add_argument("--as-of", help="Fecha final local YYYY-MM-DD; por defecto hoy en Colombia")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--attempts", type=int, default=2)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--transport", choices=("auto", "urllib", "curl"), default="auto")
    return parser


if __name__ == "__main__":
    sys.exit(run(build_parser().parse_args()))
