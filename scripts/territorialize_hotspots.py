#!/usr/bin/env python3
"""Territorializa hotspots con MGN 2025 y construye datos del dashboard."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import os
import subprocess
import tempfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Sequence
from urllib.parse import urlencode


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_PUBLIC_DIR = ROOT / "public" / "data"
DANE_SERVICE = (
    "https://geoportal.dane.gov.co/mparcgis/rest/services/"
    "MGN2025/Serv_CapasMGN_2025/FeatureServer"
)
MUNICIPAL_LAYER = 317
DEPARTMENT_LAYER = 319
JOIN_OFFSET = 0.00005
DISPLAY_OFFSET = 0.003
GRID_SIZE = 0.5
TERRITORIAL_FIELDS = [
    "dpto_codigo", "departamento", "mpio_codigo", "municipio",
    "asignacion_territorial", "metodo_asignacion_territorial",
]


@dataclass(frozen=True)
class PolygonRecord:
    code: str
    department_code: str
    department_name: str
    municipality_name: str
    area_km2: float | None
    geometry: dict[str, object]
    bbox: tuple[float, float, float, float]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


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
    options = {"ensure_ascii": False}
    if pretty:
        options.update(indent=2, sort_keys=True)
    else:
        options.update(separators=(",", ":"))
    return (json.dumps(payload, **options) + "\n").encode("utf-8")


def curl_json(url: str, params: dict[str, str], timeout: int = 120) -> object:
    command = [
        "curl", "--fail", "--location", "--silent", "--show-error",
        "--connect-timeout", "15", "--max-time", str(timeout),
        "--retry", "2", "--retry-all-errors",
        "--user-agent", "puntos-calor-colombia-dashboard/0.3",
        f"{url}?{urlencode(params)}",
    ]
    completed = subprocess.run(command, capture_output=True, check=False)
    if completed.returncode:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"curl={completed.returncode}: {detail}")
    payload = json.loads(completed.stdout)
    if isinstance(payload, dict) and payload.get("error"):
        raise RuntimeError(f"servicio DANE: {payload['error']}")
    return payload


def layer_url(layer: int, suffix: str = "") -> str:
    return f"{DANE_SERVICE}/{layer}{suffix}"


def object_ids(layer: int) -> list[int]:
    payload = curl_json(
        layer_url(layer, "/query"),
        {"where": "1=1", "returnIdsOnly": "true", "f": "json"},
    )
    if not isinstance(payload, dict) or not isinstance(payload.get("objectIds"), list):
        raise RuntimeError("DANE no devolvió OBJECTID")
    return sorted(int(value) for value in payload["objectIds"])


def chunks(values: Sequence[int], size: int) -> Iterator[list[int]]:
    for start in range(0, len(values), size):
        yield list(values[start:start + size])


def fetch_batch(layer: int, ids: list[int], fields: str, offset: float) -> list[dict[str, object]]:
    params = {
        "objectIds": ",".join(map(str, ids)),
        "outFields": fields,
        "returnGeometry": "true",
        "outSR": "4326",
        "maxAllowableOffset": str(offset),
        "geometryPrecision": "6",
        "f": "geojson",
    }
    try:
        payload = curl_json(layer_url(layer, "/query"), params)
    except RuntimeError:
        if len(ids) == 1:
            raise
        middle = len(ids) // 2
        return fetch_batch(layer, ids[:middle], fields, offset) + fetch_batch(
            layer, ids[middle:], fields, offset
        )
    if not isinstance(payload, dict) or not isinstance(payload.get("features"), list):
        raise RuntimeError("GeoJSON DANE inesperado")
    return payload["features"]


def download_layer(
    layer: int, fields: str, offset: float, batch_size: int, workers: int,
) -> tuple[dict[str, object], dict[str, object]]:
    metadata = curl_json(layer_url(layer), {"f": "json"})
    ids = object_ids(layer)
    batches = list(chunks(ids, batch_size))
    features: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=min(workers, len(batches))) as executor:
        futures = [executor.submit(fetch_batch, layer, batch, fields, offset) for batch in batches]
        for future in as_completed(futures):
            features.extend(future.result())
    features.sort(key=lambda feature: int(feature.get("id", 0)))
    if len(features) != len(ids):
        raise RuntimeError(f"cierre DANE fallido: {len(features)} geometrías para {len(ids)} IDs")
    audit = {
        "layer": layer,
        "name": metadata.get("name") if isinstance(metadata, dict) else None,
        "feature_count": len(features),
        "output_spatial_reference": 4326,
        "max_allowable_offset_degrees": offset,
        "service_item_id": metadata.get("serviceItemId") if isinstance(metadata, dict) else None,
        "url": layer_url(layer),
    }
    return {"type": "FeatureCollection", "features": features}, audit


def save_gzip(path: Path, payload: object) -> dict[str, object]:
    raw = json_bytes(payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as stream:
        temporary = Path(stream.name)
    try:
        with temporary.open("wb") as target:
            with gzip.GzipFile(fileobj=target, mode="wb", mtime=0) as compressed:
                compressed.write(raw)
        content = temporary.read_bytes()
        atomic_write(path, content)
    finally:
        temporary.unlink(missing_ok=True)
    return {
        "path": str(path), "uncompressed_bytes": len(raw),
        "compressed_bytes": len(content), "sha256": sha256(content),
    }


def load_gzip(path: Path) -> dict[str, object]:
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        payload = json.load(stream)
    if not isinstance(payload, dict):
        raise RuntimeError("GeoJSON municipal inválido")
    return payload


def rebuild_cached_metadata(
    boundary: Path, data_dir: Path, municipal: dict[str, object], generated: str,
) -> dict[str, object]:
    """Reconstruye la auditoría si una pausa dejó el caché sin su metadato."""
    layer_metadata = curl_json(layer_url(MUNICIPAL_LAYER), {"f": "json"})
    features = municipal.get("features", [])
    if not isinstance(features, list):
        raise RuntimeError("GeoJSON municipal sin catálogo de entidades")
    content = boundary.read_bytes()
    return {
        "downloaded_at_utc": generated,
        "municipalities": {
            "layer": MUNICIPAL_LAYER,
            "name": layer_metadata.get("name") if isinstance(layer_metadata, dict) else None,
            "feature_count": len(features),
            "output_spatial_reference": 4326,
            "max_allowable_offset_degrees": JOIN_OFFSET,
            "service_item_id": (
                layer_metadata.get("serviceItemId")
                if isinstance(layer_metadata, dict) else None
            ),
            "url": layer_url(MUNICIPAL_LAYER),
        },
        "archive": {
            "path": str(boundary.relative_to(data_dir)),
            "uncompressed_bytes": len(json_bytes(municipal)),
            "compressed_bytes": len(content),
            "sha256": sha256(content),
            "recovered_from_cache": True,
        },
    }


def coordinate_pairs(geometry: dict[str, object]) -> Iterator[tuple[float, float]]:
    coordinates = geometry.get("coordinates")
    polygons = [coordinates] if geometry.get("type") == "Polygon" else coordinates
    if not isinstance(polygons, list):
        return
    for polygon in polygons:
        if not isinstance(polygon, list):
            continue
        for ring in polygon:
            if not isinstance(ring, list):
                continue
            for point in ring:
                if isinstance(point, list) and len(point) >= 2:
                    yield float(point[0]), float(point[1])


def geometry_bbox(geometry: dict[str, object]) -> tuple[float, float, float, float]:
    points = list(coordinate_pairs(geometry))
    if not points:
        raise ValueError("geometría sin coordenadas")
    xs, ys = zip(*points)
    return min(xs), min(ys), max(xs), max(ys)


def polygon_records(collection: dict[str, object]) -> list[PolygonRecord]:
    records: list[PolygonRecord] = []
    seen: set[str] = set()
    for feature in collection.get("features", []):
        properties, geometry = feature.get("properties"), feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue
        code = str(properties.get("MPIO_CDPMP", "")).zfill(5)
        if code in seen or len(code) != 5:
            raise RuntimeError(f"código municipal inválido o duplicado: {code!r}")
        seen.add(code)
        area = properties.get("MPIO_NAREA")
        records.append(PolygonRecord(
            code=code,
            department_code=str(properties.get("DPTO_CCDGO", "")).zfill(2),
            department_name=str(properties.get("DPTO_CNMBRE", "")).strip().title(),
            municipality_name=str(properties.get("MPIO_CNMBRE", "")).strip().title(),
            area_km2=float(area) if area is not None else None,
            geometry=geometry,
            bbox=geometry_bbox(geometry),
        ))
    return sorted(records, key=lambda record: record.code)


def build_grid(records: list[PolygonRecord], size: float = GRID_SIZE) -> dict[tuple[int, int], list[int]]:
    index: dict[tuple[int, int], list[int]] = defaultdict(list)
    for position, record in enumerate(records):
        min_x, min_y, max_x, max_y = record.bbox
        for x in range(math.floor(min_x / size), math.floor(max_x / size) + 1):
            for y in range(math.floor(min_y / size), math.floor(max_y / size) + 1):
                index[(x, y)].append(position)
    return dict(index)


def point_on_segment(x: float, y: float, a: list[float], b: list[float], epsilon: float = 1e-10) -> bool:
    x1, y1, x2, y2 = float(a[0]), float(a[1]), float(b[0]), float(b[1])
    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    if abs(cross) > epsilon * max(1.0, abs(x2 - x1), abs(y2 - y1)):
        return False
    return min(x1, x2) - epsilon <= x <= max(x1, x2) + epsilon and min(y1, y2) - epsilon <= y <= max(y1, y2) + epsilon


def point_in_ring(x: float, y: float, ring: list[object]) -> int:
    """0 fuera, 1 dentro, 2 límite."""
    if len(ring) < 4 or not isinstance(ring[-1], list):
        return 0
    inside = False
    previous = ring[-1]
    for current in ring:
        if not isinstance(current, list):
            continue
        if point_on_segment(x, y, previous, current):
            return 2
        x1, y1 = float(previous[0]), float(previous[1])
        x2, y2 = float(current[0]), float(current[1])
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
        previous = current
    return 1 if inside else 0


def point_in_polygon(x: float, y: float, polygon: list[object]) -> int:
    if not polygon or not isinstance(polygon[0], list):
        return 0
    exterior = point_in_ring(x, y, polygon[0])
    if exterior != 1:
        return exterior
    for hole in polygon[1:]:
        if isinstance(hole, list):
            result = point_in_ring(x, y, hole)
            if result == 2:
                return 2
            if result == 1:
                return 0
    return 1


def point_in_geometry(x: float, y: float, geometry: dict[str, object]) -> int:
    coordinates = geometry.get("coordinates")
    if geometry.get("type") == "Polygon" and isinstance(coordinates, list):
        return point_in_polygon(x, y, coordinates)
    if geometry.get("type") == "MultiPolygon" and isinstance(coordinates, list):
        result = 0
        for polygon in coordinates:
            if isinstance(polygon, list):
                current = point_in_polygon(x, y, polygon)
                if current == 2:
                    return 2
                result = max(result, current)
        return result
    return 0


def assign_point(
    longitude: float, latitude: float, records: list[PolygonRecord],
    index: dict[tuple[int, int], list[int]], size: float = GRID_SIZE,
) -> tuple[str, PolygonRecord | None]:
    candidates = index.get((math.floor(longitude / size), math.floor(latitude / size)), [])
    inside: list[PolygonRecord] = []
    boundary = False
    for position in candidates:
        record = records[position]
        min_x, min_y, max_x, max_y = record.bbox
        if not (min_x <= longitude <= max_x and min_y <= latitude <= max_y):
            continue
        result = point_in_geometry(longitude, latitude, record.geometry)
        boundary = boundary or result == 2
        if result == 1:
            inside.append(record)
    if boundary:
        return "limite_revision", None
    if len(inside) == 1:
        return "asignado", inside[0]
    if len(inside) > 1:
        return "solapamiento_revision", None
    return "sin_asignacion", None


def exact_dane_assignment(
    longitude: float, latitude: float, records_by_code: dict[str, PolygonRecord],
) -> tuple[str, PolygonRecord | None]:
    """Confirma contra la geometría oficial completa los vacíos del caché simplificado."""
    payload = curl_json(
        layer_url(MUNICIPAL_LAYER, "/query"),
        {
            "geometry": f"{longitude},{latitude}",
            "geometryType": "esriGeometryPoint",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "MPIO_CDPMP",
            "returnGeometry": "false",
            "f": "json",
        },
    )
    features = payload.get("features", []) if isinstance(payload, dict) else []
    codes = {
        str(feature.get("attributes", {}).get("MPIO_CDPMP", "")).zfill(5)
        for feature in features if isinstance(feature, dict)
    }
    codes.discard("00000")
    if len(codes) == 1:
        record = records_by_code.get(next(iter(codes)))
        if record is None:
            raise RuntimeError(f"DANE devolvió un municipio fuera del catálogo: {codes}")
        return "asignado", record
    if len(codes) > 1:
        return "solapamiento_revision", None
    return "sin_asignacion", None


def distance_sq(point: list[float], start: list[float], end: list[float]) -> float:
    x, y, x1, y1, x2, y2 = *point, *start, *end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return (x - x1) ** 2 + (y - y1) ** 2
    ratio = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return (x - (x1 + ratio * dx)) ** 2 + (y - (y1 + ratio * dy)) ** 2


def simplify_line(points: list[list[float]], tolerance: float) -> list[list[float]]:
    if len(points) <= 2:
        return points
    distances = [distance_sq(points[i], points[0], points[-1]) for i in range(1, len(points) - 1)]
    if not distances or max(distances) <= tolerance * tolerance:
        return [points[0], points[-1]]
    split = distances.index(max(distances)) + 1
    return simplify_line(points[:split + 1], tolerance)[:-1] + simplify_line(points[split:], tolerance)


def simplify_ring(ring: list[object], tolerance: float) -> list[list[float]]:
    points = [[float(point[0]), float(point[1])] for point in ring if isinstance(point, list)]
    if len(points) < 4:
        return points
    if points[0] == points[-1]:
        points.pop()
    simplified = simplify_line(points + [points[0]], tolerance)
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return simplified if len(simplified) >= 4 else []


def simplify_geometry(geometry: dict[str, object], tolerance: float) -> dict[str, object]:
    coordinates = geometry.get("coordinates")
    if geometry.get("type") == "Polygon" and isinstance(coordinates, list):
        rings = [simplify_ring(ring, tolerance) for ring in coordinates if isinstance(ring, list)]
        return {"type": "Polygon", "coordinates": [ring for ring in rings if ring]}
    if geometry.get("type") == "MultiPolygon" and isinstance(coordinates, list):
        polygons = []
        for polygon in coordinates:
            if isinstance(polygon, list):
                rings = [simplify_ring(ring, tolerance) for ring in polygon if isinstance(ring, list)]
                if any(rings):
                    polygons.append([ring for ring in rings if ring])
        return {"type": "MultiPolygon", "coordinates": polygons}
    return geometry


def municipality_display(collection: dict[str, object]) -> dict[str, object]:
    features = []
    for feature in collection.get("features", []):
        properties, geometry = feature.get("properties"), feature.get("geometry")
        if isinstance(properties, dict) and isinstance(geometry, dict):
            features.append({
                "type": "Feature",
                "properties": {
                    "d": str(properties.get("DPTO_CCDGO", "")).zfill(2),
                    "m": str(properties.get("MPIO_CDPMP", "")).zfill(5),
                    "n": str(properties.get("MPIO_CNMBRE", "")).strip().title(),
                },
                "geometry": simplify_geometry(geometry, DISPLAY_OFFSET),
            })
    return {"type": "FeatureCollection", "features": features}


def territorialize(
    data_dir: Path, records: list[PolygonRecord], workers: int = 4,
) -> tuple[list[dict[str, str]], Counter, list[dict[str, object]]]:
    index = build_grid(records)
    records_by_code = {record.code: record for record in records}
    all_rows: list[dict[str, str]] = []
    statuses = Counter()
    outputs = []
    for source in sorted((data_dir / "processed").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            fields = list(reader.fieldnames or []) + TERRITORIAL_FIELDS
            pending_rows: list[tuple[dict[str, str], str, PolygonRecord | None]] = []
            for source_row in reader:
                status, territory = assign_point(
                    float(source_row["longitud"]), float(source_row["latitud"]), records, index
                )
                pending_rows.append((source_row, status, territory))
            unresolved = [
                (float(row["longitud"]), float(row["latitud"]))
                for row, status, _ in pending_rows if status == "sin_asignacion"
            ]
            exact_results: Iterator[tuple[str, PolygonRecord | None]] = iter(())
            if unresolved:
                with ThreadPoolExecutor(max_workers=min(workers, len(unresolved))) as executor:
                    exact_results = iter(list(executor.map(
                        lambda point: exact_dane_assignment(*point, records_by_code), unresolved
                    )))
            month_rows = []
            for source_row, status, territory in pending_rows:
                method = "cache_geometrico"
                if status == "sin_asignacion":
                    status, territory = next(exact_results)
                    method = (
                        "consulta_dane_exacta" if territory
                        else "consulta_dane_exacta_sin_interseccion"
                    )
                row = dict(source_row)
                row.update({
                    "dpto_codigo": territory.department_code if territory else "",
                    "departamento": territory.department_name if territory else "",
                    "mpio_codigo": territory.code if territory else "",
                    "municipio": territory.municipality_name if territory else "",
                    "asignacion_territorial": status,
                    "metodo_asignacion_territorial": method,
                })
                statuses[status] += 1
                month_rows.append(row)
                all_rows.append(row)
        destination = data_dir / "territorial" / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=destination.parent) as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            writer.writerows(month_rows)
            temporary = stream.name
        os.replace(temporary, destination)
        content = destination.read_bytes()
        outputs.append({
            "path": str(destination.relative_to(data_dir)), "rows": len(month_rows),
            "size_bytes": len(content), "sha256": sha256(content),
        })
    return all_rows, statuses, outputs


def build_dashboard(rows: list[dict[str, str]], records: list[PolygonRecord], generated: str, dane: dict[str, object]) -> dict[str, object]:
    department_names = {record.department_code: record.department_name for record in records}
    municipality_by_code = {record.code: record for record in records}
    department_codes = sorted(department_names)
    municipality_codes = sorted(municipality_by_code)
    dates = sorted({row["fecha_local"] for row in rows})
    sources = sorted({row["fuente"] for row in rows})
    confidences = sorted({row["confianza"] for row in rows})
    d_index = {value: i for i, value in enumerate(department_codes)}
    m_index = {value: i for i, value in enumerate(municipality_codes)}
    date_index = {value: i for i, value in enumerate(dates)}
    source_index = {value: i for i, value in enumerate(sources)}
    confidence_index = {value: i for i, value in enumerate(confidences)}
    department_a, department_b = Counter(), Counter()
    municipality_a, municipality_b = Counter(), Counter()
    statuses, points = Counter(), []
    for row in rows:
        statuses[row["asignacion_territorial"]] += 1
        if row["asignacion_territorial"] == "asignado":
            department_a[row["dpto_codigo"]] += 1
            municipality_a[row["mpio_codigo"]] += 1
            if row["escenario_b"] == "true":
                department_b[row["dpto_codigo"]] += 1
                municipality_b[row["mpio_codigo"]] += 1
        time_value = row["fecha_hora_col"].split("T", 1)[1][:5]
        hour, minute = map(int, time_value.split(":"))
        points.append([
            round(float(row["longitud"]), 5), round(float(row["latitud"]), 5),
            d_index.get(row["dpto_codigo"], -1), m_index.get(row["mpio_codigo"], -1),
            date_index[row["fecha_local"]], hour * 60 + minute,
            source_index[row["fuente"]], 1 if row["escenario_b"] == "true" else 0,
            round(float(row["frp_mw"]), 2) if row["frp_mw"] else None,
            confidence_index[row["confianza"]], 1 if row["captura"] == "D" else 0,
        ])
    departments = [{
        "code": code, "name": department_names[code],
        "countA": department_a[code], "countB": department_b[code],
        "municipalitiesA": sum(municipality_a[m] > 0 for m in municipality_codes if m.startswith(code)),
        "municipalitiesB": sum(municipality_b[m] > 0 for m in municipality_codes if m.startswith(code)),
    } for code in department_codes]
    municipalities = [{
        "code": code, "departmentCode": municipality_by_code[code].department_code,
        "name": municipality_by_code[code].municipality_name,
        "areaKm2": round(municipality_by_code[code].area_km2, 3) if municipality_by_code[code].area_km2 else None,
        "countA": municipality_a[code], "countB": municipality_b[code],
    } for code in municipality_codes]
    return {
        "metadata": {
            "generatedAtUtc": generated, "historyStartDate": min(dates),
            "lastObservationDate": max(dates), "timezone": "America/Bogota",
            "totalRows": len(rows), "scenarioARows": len(rows),
            "scenarioBRows": sum(row["escenario_b"] == "true" for row in rows),
            "territorialStatus": dict(sorted(statuses.items())), "dane": dane,
        },
        "dates": dates, "sources": sources, "confidences": confidences,
        "departments": departments, "municipalities": municipalities, "points": points,
        "pointSchema": [
            "longitude", "latitude", "departmentIndex", "municipalityIndex",
            "dateIndex", "minuteLocal", "sourceIndex", "scenarioB", "frpMw",
            "confidenceIndex", "dayCapture",
        ],
    }


def validate(payload: dict[str, object], expected: int) -> dict[str, int]:
    metadata = payload["metadata"]
    statuses = metadata["territorialStatus"]
    assigned = int(statuses.get("asignado", 0))
    checks = {
        "expected_rows": expected,
        "point_rows": len(payload["points"]),
        "status_rows": sum(int(value) for value in statuses.values()),
        "assigned_rows": assigned,
        "department_count_rows": sum(int(item["countA"]) for item in payload["departments"]),
        "municipality_count_rows": sum(int(item["countA"]) for item in payload["municipalities"]),
        "departments_catalog": len(payload["departments"]),
        "municipalities_catalog": len(payload["municipalities"]),
    }
    if checks["point_rows"] != expected or checks["status_rows"] != expected:
        raise RuntimeError(f"cierre nacional fallido: {checks}")
    if checks["department_count_rows"] != assigned or checks["municipality_count_rows"] != assigned:
        raise RuntimeError(f"cierre territorial fallido: {checks}")
    if checks["municipalities_catalog"] != 1122:
        raise RuntimeError(f"catálogo municipal inesperado: {checks}")
    return checks


def run(args: argparse.Namespace) -> int:
    data_dir, public_dir = Path(args.data_dir), Path(args.public_dir)
    boundary = data_dir / "boundaries" / "mgn2025_municipios_join.geojson.gz"
    metadata_path = data_dir / "boundaries" / "mgn2025_metadata.json"
    generated = utc_now_iso()
    if boundary.exists() and not args.refresh_boundaries:
        municipal = load_gzip(boundary)
        if metadata_path.exists():
            dane = json.loads(metadata_path.read_text(encoding="utf-8"))
        else:
            dane = rebuild_cached_metadata(boundary, data_dir, municipal, generated)
    else:
        municipal, municipal_audit = download_layer(
            MUNICIPAL_LAYER,
            "DPTO_CCDGO,MPIO_CDPMP,DPTO_CNMBRE,MPIO_CNMBRE,MPIO_NAREA,MPIO_NANO",
            JOIN_OFFSET, args.batch_size, args.workers,
        )
        archive = save_gzip(boundary, municipal)
        dane = {
            "downloaded_at_utc": generated, "municipalities": municipal_audit,
            "archive": {**archive, "path": str(boundary.relative_to(data_dir))},
        }
    if not (public_dir / "departments.json").exists() or args.refresh_boundaries:
        departments, department_audit = download_layer(
            DEPARTMENT_LAYER, "DPTO_CCDGO,DPTO_CNMBRE,DPTO_NAREA,DPTO_NANO",
            DISPLAY_OFFSET, 20, args.workers,
        )
        dane["departments"] = department_audit
        atomic_write(public_dir / "departments.json", json_bytes(departments))
    atomic_write(metadata_path, json_bytes(dane, pretty=True))
    records = polygon_records(municipal)
    if len(records) != 1122:
        raise RuntimeError(f"se esperaban 1122 municipios y se obtuvieron {len(records)}")
    rows, statuses, outputs = territorialize(data_dir, records, args.workers)
    if not rows:
        raise RuntimeError("no existen hotspots normalizados")
    atomic_write(public_dir / "municipalities.json", json_bytes(municipality_display(municipal)))
    payload = build_dashboard(rows, records, generated, dane)
    closure = validate(payload, len(rows))
    atomic_write(public_dir / "dashboard.json", json_bytes(payload))
    files = {}
    for name in ("dashboard.json", "departments.json", "municipalities.json"):
        content = (public_dir / name).read_bytes()
        files[name] = {"size_bytes": len(content), "sha256": sha256(content)}
    report = {
        "started_at_utc": generated, "finished_at_utc": utc_now_iso(),
        "status": "completed", "territorial_status": dict(statuses),
        "closure": closure, "territorial_outputs": outputs, "dashboard_files": files,
    }
    atomic_write(data_dir / "metadata" / "territorial_latest_run.json", json_bytes(report, pretty=True))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    result.add_argument("--public-dir", default=str(DEFAULT_PUBLIC_DIR))
    result.add_argument("--refresh-boundaries", action="store_true")
    result.add_argument("--batch-size", type=int, default=25)
    result.add_argument("--workers", type=int, default=4)
    return result


if __name__ == "__main__":
    raise SystemExit(run(parser().parse_args()))
