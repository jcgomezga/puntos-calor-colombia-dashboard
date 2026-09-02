#!/usr/bin/env python3
"""Construye resúmenes históricos diarios y mensuales para el dashboard."""

from __future__ import annotations

import argparse
import csv
import json
import os
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_PUBLIC_DIR = ROOT / "public" / "data"
METRICS = ("hotspots", "departments", "municipalities", "runap", "mining", "anlaWithin5", "anhWithin5")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def json_bytes(payload: object, pretty: bool = False) -> bytes:
    return (json.dumps(
        payload, ensure_ascii=False, indent=2 if pretty else None,
        separators=None if pretty else (",", ":"), sort_keys=pretty,
    ) + "\n").encode("utf-8")


def relation_flags(row: dict[str, str]) -> dict[str, bool]:
    return {
        "runap": row.get("en_area_protegida") == "true",
        "mining": row.get("en_titulo_minero") == "true",
        "anlaWithin5": row.get("anla_clase_minima") in {"dentro", "hasta_1_km", "entre_1_y_5_km"},
        "anhWithin5": row.get("anh_clase_minima") in {"dentro", "hasta_1_km", "entre_1_y_5_km"},
    }


def empty_bucket() -> dict[str, object]:
    return {
        "hotspots": 0, "departments": set(), "municipalities": set(),
        "runap": 0, "mining": 0, "anlaWithin5": 0, "anhWithin5": 0,
    }


def add_row(bucket: dict[str, object], row: dict[str, str]) -> None:
    bucket["hotspots"] = int(bucket["hotspots"]) + 1
    if row.get("dpto_codigo"):
        bucket["departments"].add(row["dpto_codigo"])
    if row.get("mpio_codigo"):
        bucket["municipalities"].add(row["mpio_codigo"])
    for metric, enabled in relation_flags(row).items():
        if enabled:
            bucket[metric] = int(bucket[metric]) + 1


def finalize_bucket(bucket: dict[str, object]) -> dict[str, int]:
    return {
        metric: len(bucket[metric]) if metric in {"departments", "municipalities"} else int(bucket[metric])
        for metric in METRICS
    }


def load_rows(data_dir: Path, history_start: str) -> list[dict[str, str]]:
    rows, seen = [], set()
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            for row in csv.DictReader(stream):
                hotspot_id = row.get("hotspot_id", "")
                if not hotspot_id or hotspot_id in seen:
                    raise RuntimeError(f"hotspot_id ausente o duplicado: {hotspot_id!r}")
                if row.get("fecha_local", "") < history_start:
                    raise RuntimeError(f"fila anterior al corte histórico: {row.get('fecha_local')}")
                seen.add(hotspot_id)
                rows.append(row)
    if not rows:
        raise RuntimeError("no existen hotspots territoriales")
    return sorted(rows, key=lambda row: (row["fecha_local"], row["hotspot_id"]))


def summarize(rows: list[dict[str, str]], period_key) -> dict[tuple[str, str], dict[str, object]]:
    buckets: dict[tuple[str, str], dict[str, object]] = defaultdict(empty_bucket)
    for row in rows:
        period = period_key(row["fecha_local"])
        add_row(buckets[(period, "A")], row)
        if row.get("escenario_b") == "true":
            add_row(buckets[(period, "B")], row)
    return dict(buckets)


def records(buckets: dict[tuple[str, str], dict[str, object]], open_month: str | None = None):
    output = []
    for (period, scenario), bucket in sorted(buckets.items()):
        item = {"period": period, "scenario": scenario, **finalize_bucket(bucket)}
        if open_month is not None:
            item["status"] = "open" if period == open_month else "closed"
        output.append(item)
    return output


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0])
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=path.parent) as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def build(data_dir: Path, public_dir: Path, history_start: str) -> dict[str, object]:
    rows = load_rows(data_dir, history_start)
    first_date, last_date = rows[0]["fecha_local"], rows[-1]["fecha_local"]
    open_month = last_date[:7]
    daily = records(summarize(rows, lambda value: value))
    monthly = records(summarize(rows, lambda value: value[:7]), open_month)
    total_a = sum(item["hotspots"] for item in daily if item["scenario"] == "A")
    total_b = sum(item["hotspots"] for item in daily if item["scenario"] == "B")
    if total_a != len(rows):
        raise RuntimeError(f"cierre histórico A fallido: {total_a} != {len(rows)}")
    expected_b = sum(row.get("escenario_b") == "true" for row in rows)
    if total_b != expected_b:
        raise RuntimeError(f"cierre histórico B fallido: {total_b} != {expected_b}")
    dashboard = json.loads((public_dir / "dashboard.json").read_text(encoding="utf-8"))
    if len(dashboard.get("points", [])) != len(rows):
        raise RuntimeError("el resumen histórico no cierra con dashboard.json")
    payload = {
        "metadata": {
            "generatedAtUtc": utc_now_iso(), "historyStartDate": history_start,
            "firstObservationDate": first_date, "lastObservationDate": last_date,
            "timezone": "America/Bogota", "totalRows": len(rows),
            "scenarioBRows": expected_b, "openMonth": open_month,
            "closedMonths": sorted({item["period"] for item in monthly if item["status"] == "closed"}),
        },
        "daily": daily, "monthly": monthly,
    }
    write_csv(data_dir / "summaries" / "historical_daily.csv", daily)
    write_csv(data_dir / "summaries" / "historical_monthly.csv", monthly)
    atomic_write(public_dir / "history.json", json_bytes(payload))
    report = {
        "finishedAtUtc": utc_now_iso(), "status": "completed", "totalRows": len(rows),
        "scenarioBRows": expected_b, "dailyRows": len(daily), "monthlyRows": len(monthly),
        "firstObservationDate": first_date, "lastObservationDate": last_date,
        "openMonth": open_month,
    }
    atomic_write(data_dir / "metadata" / "history_latest_run.json", json_bytes(report, pretty=True))
    return report


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    result.add_argument("--public-dir", default=str(DEFAULT_PUBLIC_DIR))
    result.add_argument("--history-start", default="2026-07-01")
    return result


if __name__ == "__main__":
    args = parser().parse_args()
    print(json.dumps(build(Path(args.data_dir), Path(args.public_dir), args.history_start), ensure_ascii=False, indent=2))
