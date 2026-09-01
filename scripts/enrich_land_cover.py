#!/usr/bin/env python3
"""Asigna cobertura IDEAM 2024 a los hotspots mediante consultas espaciales incrementales."""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import sys
import tempfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_PUBLIC_DIR = ROOT / "public" / "data"
LAND_COVER_LAYER = (
    "https://visualizador.ideam.gov.co/gisserver/rest/services/"
    "Estado_Cobertura_Tierra/MapServer/10"
)
SOURCE_YEAR = 2024
OUT_FIELDS = (
    "codigo,leyenda,nivel_1,nivel_2,nivel_3,nivel_4,nivel_5,nivel_6,"
    "confiabili,insumo,apoyo,cod_dane_mpio"
)
MAPPING_FIELDS = [
    "hotspot_id", "cobertura_estado", "cobertura_codigo", "cobertura_leyenda",
    "cobertura_nivel_1", "cobertura_nivel_2", "cobertura_nivel_3",
    "cobertura_nivel_4", "cobertura_nivel_5", "cobertura_nivel_6",
    "cobertura_confiabilidad", "cobertura_insumo", "cobertura_apoyo",
]


def load_helpers():
    path = ROOT / "scripts" / "territorialize_hotspots.py"
    spec = importlib.util.spec_from_file_location("landcover_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("no fue posible cargar el motor geométrico")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


HELPERS = load_helpers()


@dataclass(frozen=True)
class CoverPolygon:
    values: dict[str, str]
    geometry: dict[str, object]
    bbox: tuple[float, float, float, float]


def chunks(values, size):
    for start in range(0, len(values), size):
        yield values[start:start + size]


def clean(value: object) -> str:
    return "" if value is None else str(value).strip()


def mapping_from_properties(properties: dict[str, object], status: str) -> dict[str, str]:
    return {
        "cobertura_estado": status,
        "cobertura_codigo": clean(properties.get("codigo")),
        "cobertura_leyenda": clean(properties.get("leyenda")),
        "cobertura_nivel_1": clean(properties.get("nivel_1")),
        "cobertura_nivel_2": clean(properties.get("nivel_2")),
        "cobertura_nivel_3": clean(properties.get("nivel_3")),
        "cobertura_nivel_4": clean(properties.get("nivel_4")),
        "cobertura_nivel_5": clean(properties.get("nivel_5")),
        "cobertura_nivel_6": clean(properties.get("nivel_6")),
        "cobertura_confiabilidad": clean(properties.get("confiabili")),
        "cobertura_insumo": clean(properties.get("insumo")),
        "cobertura_apoyo": clean(properties.get("apoyo")),
    }


def query_features(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    points = [[float(row["longitud"]), float(row["latitud"])] for row in rows]
    payload = HELPERS.curl_json(f"{LAND_COVER_LAYER}/query", {
        "where": "1=1", "geometry": json.dumps({
            "points": points, "spatialReference": {"wkid": 4326},
        }, separators=(",", ":")),
        "geometryType": "esriGeometryMultipoint", "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects", "outFields": OUT_FIELDS,
        "returnGeometry": "true", "outSR": "4326", "geometryPrecision": "6",
        "returnZ": "false", "f": "geojson",
    }, timeout=180)
    features = payload.get("features", []) if isinstance(payload, dict) else []
    if not isinstance(features, list):
        raise RuntimeError("respuesta GeoJSON de coberturas inválida")
    return features


def cover_polygons(features: list[dict[str, object]]) -> list[CoverPolygon]:
    records = []
    for feature in features:
        properties, geometry = feature.get("properties"), feature.get("geometry")
        if isinstance(properties, dict) and isinstance(geometry, dict):
            records.append(CoverPolygon(
                {key: clean(value) for key, value in properties.items()},
                geometry, HELPERS.geometry_bbox(geometry),
            ))
    return records


def match_point(row: dict[str, str], records: list[CoverPolygon]):
    longitude, latitude = float(row["longitud"]), float(row["latitud"])
    matches = []
    for record in records:
        min_x, min_y, max_x, max_y = record.bbox
        if min_x <= longitude <= max_x and min_y <= latitude <= max_y:
            if HELPERS.point_in_geometry(longitude, latitude, record.geometry) in (1, 2):
                matches.append(record)
    matches.sort(key=lambda item: (item.values.get("codigo", ""), item.values.get("leyenda", "")))
    return matches


def query_exact(row: dict[str, str]) -> dict[str, str]:
    payload = HELPERS.curl_json(f"{LAND_COVER_LAYER}/query", {
        "where": "1=1", "geometry": f'{row["longitud"]},{row["latitud"]}',
        "geometryType": "esriGeometryPoint", "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects", "outFields": OUT_FIELDS,
        "returnGeometry": "false", "f": "json",
    }, timeout=90)
    features = payload.get("features", []) if isinstance(payload, dict) else []
    attributes = [feature.get("attributes", {}) for feature in features if isinstance(feature, dict)]
    attributes = [item for item in attributes if isinstance(item, dict)]
    attributes.sort(key=lambda item: (clean(item.get("codigo")), clean(item.get("leyenda"))))
    if not attributes:
        return mapping_from_properties({}, "sin_cobertura")
    return mapping_from_properties(attributes[0], "asignado_exacta" if len(attributes) == 1 else "solapamiento_exacta")


def process_batch(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    records = cover_polygons(query_features(rows))
    result, unresolved = {}, []
    for row in rows:
        matches = match_point(row, records)
        if matches:
            status = "asignado" if len(matches) == 1 else "solapamiento"
            result[row["hotspot_id"]] = mapping_from_properties(matches[0].values, status)
        else:
            unresolved.append(row)
    for row in unresolved:
        result[row["hotspot_id"]] = query_exact(row)
    return result


def load_territorial_rows(data_dir: Path) -> list[dict[str, str]]:
    rows = []
    for path in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with path.open(encoding="utf-8", newline="") as stream:
            rows.extend(csv.DictReader(stream))
    return rows


def load_mapping(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8", newline="") as stream:
        return {row["hotspot_id"]: row for row in csv.DictReader(stream)}


def atomic_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=path.parent) as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def update_mapping(rows, mapping, batch_size, workers):
    missing = [row for row in rows if row["hotspot_id"] not in mapping]
    grouped = defaultdict(list)
    for row in missing:
        grouped[row.get("mpio_codigo") or "sin_municipio"].append(row)
    batches = [batch for code in sorted(grouped) for batch in chunks(grouped[code], batch_size)]
    if batches:
        with ThreadPoolExecutor(max_workers=min(workers, len(batches))) as executor:
            futures = [executor.submit(process_batch, batch) for batch in batches]
            for future in as_completed(futures):
                mapping.update(future.result())
    return len(missing), len(batches)


def enrich_csv_files(data_dir: Path, mapping: dict[str, dict[str, str]]) -> Counter:
    statuses = Counter()
    for path in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with path.open(encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            fields = [field for field in (reader.fieldnames or []) if field not in MAPPING_FIELDS[1:]] + MAPPING_FIELDS[1:]
            output = []
            for source_row in reader:
                row = {key: value for key, value in source_row.items() if key not in MAPPING_FIELDS[1:]}
                values = mapping[row["hotspot_id"]]
                row.update({key: values.get(key, "") for key in MAPPING_FIELDS[1:]})
                statuses[row["cobertura_estado"]] += 1
                output.append(row)
        atomic_csv(path, fields, output)
    return statuses


def level_code(value: str) -> str:
    return value.split(".", 1)[0].strip() if value else ""


def update_dashboard(public_dir: Path, rows, mapping, statuses, audit):
    path = public_dir / "dashboard.json"
    dashboard = json.loads(path.read_text(encoding="utf-8"))
    catalog_values = sorted({
        (item["cobertura_codigo"], item["cobertura_leyenda"], item["cobertura_nivel_1"], item["cobertura_nivel_2"], item["cobertura_nivel_3"])
        for item in mapping.values() if item.get("cobertura_codigo")
    })
    catalog = [{
        "code": code, "label": label, "level1": level1, "level1Code": level_code(level1),
        "level2": level2, "level3": level3,
    } for code, label, level1, level2, level3 in catalog_values]
    indexes = {(item["code"], item["label"]): index for index, item in enumerate(catalog)}
    if len(rows) != len(dashboard["points"]):
        raise RuntimeError("el orden territorial no cierra con dashboard.json")
    for point, row in zip(dashboard["points"], rows, strict=True):
        while len(point) > 12:
            point.pop()
        values = mapping[row["hotspot_id"]]
        point.append(indexes.get((values.get("cobertura_codigo", ""), values.get("cobertura_leyenda", "")), -1))
    dashboard["pointSchema"] = dashboard["pointSchema"][:12] + ["landCoverIndex"]
    dashboard["landCovers"] = catalog
    dashboard["metadata"]["landCover"] = {
        **audit, "status": dict(sorted(statuses.items())),
        "assignedRows": sum(value for key, value in statuses.items() if key != "sin_cobertura"),
        "unassignedRows": statuses["sin_cobertura"], "catalogSize": len(catalog),
    }
    if sum(statuses.values()) != len(rows):
        raise RuntimeError("cierre de coberturas fallido")
    HELPERS.atomic_write(path, HELPERS.json_bytes(dashboard))
    return dashboard


def run(args: argparse.Namespace) -> int:
    data_dir, public_dir = Path(args.data_dir), Path(args.public_dir)
    rows = load_territorial_rows(data_dir)
    if not rows:
        raise RuntimeError("no existen hotspots territorializados")
    mapping_path = data_dir / "landcover" / "hotspot_landcover.csv"
    mapping = {} if args.refresh_all else load_mapping(mapping_path)
    missing, batches = update_mapping(rows, mapping, args.batch_size, args.workers)
    active_ids = {row["hotspot_id"] for row in rows}
    mapping = {key: value for key, value in mapping.items() if key in active_ids}
    atomic_csv(mapping_path, MAPPING_FIELDS, [
        {"hotspot_id": key, **{field: value.get(field, "") for field in MAPPING_FIELDS[1:]}}
        for key, value in sorted(mapping.items())
    ])
    statuses = enrich_csv_files(data_dir, mapping)
    audit = {
        "source": "Mapa nacional de coberturas de la tierra",
        "authority": "IDEAM", "year": SOURCE_YEAR, "scale": "1:100.000",
        "methodology": "CORINE Land Cover adaptada para Colombia",
        "url": LAND_COVER_LAYER, "queriedAtUtc": HELPERS.utc_now_iso(),
    }
    dashboard = update_dashboard(public_dir, rows, mapping, statuses, audit)
    report = {
        "status": "completed", "finishedAtUtc": HELPERS.utc_now_iso(),
        "dashboardRows": len(dashboard["points"]), "newRowsQueried": missing,
        "queryBatches": batches, "relations": dict(statuses), "source": audit,
    }
    HELPERS.atomic_write(data_dir / "metadata" / "land_cover_latest_run.json", HELPERS.json_bytes(report, pretty=True))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    result.add_argument("--public-dir", default=str(DEFAULT_PUBLIC_DIR))
    result.add_argument("--refresh-all", action="store_true")
    result.add_argument("--batch-size", type=int, default=100)
    result.add_argument("--workers", type=int, default=6)
    return result


if __name__ == "__main__":
    raise SystemExit(run(parser().parse_args()))
