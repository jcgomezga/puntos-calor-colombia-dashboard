#!/usr/bin/env python3
"""Construye PMTiles liviano y un catálogo detallado para las fichas territoriales.

Los polígonos conservan en PMTiles solo atributos necesarios para identificación,
simbología y consulta inmediata. Los atributos extensos se guardan una sola vez
en ``public/data/context-details.json`` y se cargan de forma diferida al abrir
una ficha. Así se evitan duplicaciones de texto en múltiples teselas sin perder
información de consulta.

No altera las reglas espaciales ni el universo visual: RUNAP, ANM, ANLA y ANH
conservan exactamente el alcance definido por ``build_context_tiles.py``.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DETAILS_PATH = ROOT / "public" / "data" / "context-details.json"
SPEC = importlib.util.spec_from_file_location("context_tiles_base", ROOT / "scripts" / "build_context_tiles.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("no fue posible cargar build_context_tiles.py")
BASE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BASE
SPEC.loader.exec_module(BASE)
BASE_BUILD_TILES = BASE.build_tiles


def detail_key(source: str, value: object, prefix: object | None = None) -> str:
    clean_value = BASE.clean(value)
    if prefix is None:
        return f"{source}:{clean_value}"
    return f"{source}:{BASE.clean(prefix)}:{clean_value}"


def runap_features(data_dir: Path) -> Iterable[dict[str, object]]:
    collection = BASE.read_gzip_json(data_dir / "boundaries" / "runap_join.geojson.gz")
    for feature in collection.get("features", []):
        properties = feature.get("properties", {})
        geometry = feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue
        identifier = properties.get("ap_id")
        yield BASE.geojson_feature(geometry, {
            "detail_key": detail_key("runap", identifier),
            "nombre": BASE.clean(properties.get("ap_nombre")),
            "categoria": BASE.clean(properties.get("ap_categoria")),
        }, identifier)


def anm_features(data_dir: Path) -> Iterable[dict[str, object]]:
    collection = BASE.read_gzip_json(data_dir / "boundaries" / "anm_titles_join.geojson.gz")
    for feature in collection.get("features", []):
        properties = feature.get("properties", {})
        geometry = feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue
        identifier = properties.get("fid")
        yield BASE.geojson_feature(geometry, {
            "detail_key": detail_key("anm", identifier),
            "codigo": BASE.clean(properties.get("codigo_exp")),
            "estado": BASE.clean(properties.get("estado_exp")),
        }, identifier)


def anla_features(data_dir: Path, transformer) -> Iterable[dict[str, object]]:
    collection = BASE.read_gzip_json(data_dir / "boundaries" / "anla_projects_join.json.gz")
    layers = collection.get("layers", {})
    if not isinstance(layers, dict):
        return
    for raw_layer, features in layers.items():
        layer_id = int(raw_layer)
        legal_status, geometry_type = BASE.ANLA_CONFIG[layer_id]
        if not isinstance(features, list):
            continue
        for feature in features:
            attributes = feature.get("attributes", {})
            geometry = feature.get("geometry", {})
            if not isinstance(attributes, dict) or not isinstance(geometry, dict):
                continue
            projected = BASE.arcgis_shape(geometry_type, geometry)
            if projected is None or projected.is_empty:
                continue
            converted = BASE.transform(transformer.transform, projected)
            identifier = attributes.get("objectid") or attributes.get("globalid") or attributes.get("globalid_1")
            sector_code = BASE.clean(attributes.get("sector")).removesuffix(".0")
            yield BASE.geojson_feature(BASE.mapping(converted), {
                "detail_key": detail_key("anla", identifier, layer_id),
                "expediente": BASE.clean(attributes.get("expediente")),
                "situacion": legal_status,
                "sector": BASE.ANLA_SECTORS.get(sector_code, sector_code),
                "geometria": geometry_type,
            }, identifier)


def anh_features(data_dir: Path, transformer) -> Iterable[dict[str, object]]:
    collection = BASE.read_gzip_json(data_dir / "boundaries" / "anh_tierras_join.json.gz")
    for feature in collection.get("features", []):
        attributes = feature.get("attributes", {})
        geometry = feature.get("geometry", {})
        if not isinstance(attributes, dict) or not isinstance(geometry, dict):
            continue
        if BASE.clean(attributes.get("CLASIFICAC")) != "ASIGNADA":
            continue
        projected = BASE.arcgis_shape("poligono", geometry)
        if projected is None or projected.is_empty:
            continue
        converted = BASE.transform(transformer.transform, projected)
        identifier = attributes.get("OBJECTID")
        yield BASE.geojson_feature(BASE.mapping(converted), {
            "detail_key": detail_key("anh", identifier),
            "contrato": BASE.clean(attributes.get("CONTRATO_N")),
            "estado": BASE.clean(attributes.get("ESTAD_AREA")),
            "tipo": BASE.clean(attributes.get("TIPO_CONTR")),
        }, identifier)


def build_detail_catalog(data_dir: Path) -> dict[str, object]:
    records: dict[str, dict[str, object]] = {}

    runap = BASE.read_gzip_json(data_dir / "boundaries" / "runap_join.geojson.gz")
    for feature in runap.get("features", []):
        properties = feature.get("properties", {})
        if not isinstance(properties, dict):
            continue
        identifier = properties.get("ap_id")
        key = detail_key("runap", identifier)
        records[key] = {
            "source": "runap",
            "id": BASE.clean(identifier),
            "nombre": BASE.clean(properties.get("ap_nombre")),
            "categoria": BASE.clean(properties.get("ap_categoria")),
            "condicion": BASE.clean(properties.get("condicion")),
            "organizacion": BASE.clean(properties.get("organizacion")),
        }

    anm = BASE.read_gzip_json(data_dir / "boundaries" / "anm_titles_join.geojson.gz")
    for feature in anm.get("features", []):
        properties = feature.get("properties", {})
        if not isinstance(properties, dict):
            continue
        identifier = properties.get("fid")
        key = detail_key("anm", identifier)
        records[key] = {
            "source": "anm",
            "codigo": BASE.clean(properties.get("codigo_exp")),
            "solicitante": BASE.clean(properties.get("solicitante")),
            "minerales": BASE.clean(properties.get("minerales")),
            "etapa": BASE.clean(properties.get("etapa")),
            "estado": BASE.clean(properties.get("estado_exp")),
            "modalidad": BASE.clean(properties.get("modalidade")),
            "tipo": BASE.clean(properties.get("tipo_explo")),
            "municipios": BASE.clean(properties.get("municipios")),
            "departamento": BASE.clean(properties.get("departamento")),
            "area_ha": properties.get("area_ha"),
            "fecha_inscripcion": BASE.clean(properties.get("fecha_insc")),
            "fecha_terminacion": BASE.clean(properties.get("fecha_term")),
        }

    anla = BASE.read_gzip_json(data_dir / "boundaries" / "anla_projects_join.json.gz")
    layers = anla.get("layers", {})
    if isinstance(layers, dict):
        for raw_layer, features in layers.items():
            layer_id = int(raw_layer)
            legal_status, geometry_type = BASE.ANLA_CONFIG[layer_id]
            if not isinstance(features, list):
                continue
            for feature in features:
                attributes = feature.get("attributes", {})
                if not isinstance(attributes, dict):
                    continue
                identifier = attributes.get("objectid") or attributes.get("globalid") or attributes.get("globalid_1")
                key = detail_key("anla", identifier, layer_id)
                sector_code = BASE.clean(attributes.get("sector")).removesuffix(".0")
                records[key] = {
                    "source": "anla",
                    "expediente": BASE.clean(attributes.get("expediente")),
                    "proyecto": BASE.clean(attributes.get("proyecto")),
                    "operador": BASE.clean(attributes.get("operador")),
                    "sector": BASE.ANLA_SECTORS.get(sector_code, sector_code),
                    "situacion": legal_status,
                    "geometria": geometry_type,
                    "estado": BASE.clean(attributes.get("estado")),
                    "acto_administrativo": BASE.clean(attributes.get("num_act_ad")),
                    "fecha_acto": BASE.clean(attributes.get("fec_act_ad")),
                    "articulo_acto": BASE.clean(attributes.get("art_act_ad")),
                    "contrato": BASE.clean(attributes.get("contrato")),
                    "tipo_infraestructura": BASE.clean(attributes.get("tipo_infra")),
                    "area_ha": attributes.get("area_ha"),
                    "longitud_m": attributes.get("longitud_m"),
                    "descripcion": BASE.clean(attributes.get("descrip")),
                    "nomenclatura": BASE.clean(attributes.get("nomenclat")),
                    "observacion": BASE.clean(attributes.get("observ")),
                }

    anh = BASE.read_gzip_json(data_dir / "boundaries" / "anh_tierras_join.json.gz")
    for feature in anh.get("features", []):
        attributes = feature.get("attributes", {})
        if not isinstance(attributes, dict) or BASE.clean(attributes.get("CLASIFICAC")) != "ASIGNADA":
            continue
        identifier = attributes.get("OBJECTID")
        key = detail_key("anh", identifier)
        records[key] = {
            "source": "anh",
            "contrato_id": BASE.clean(attributes.get("CONTRAT_ID")),
            "contrato": BASE.clean(attributes.get("CONTRATO_N")),
            "area": BASE.clean(attributes.get("AREA_NOMBR")),
            "fecha_firma": BASE.clean(attributes.get("FECHA_FIRM")),
            "clasificacion": BASE.clean(attributes.get("CLASIFICAC")),
            "tipo": BASE.clean(attributes.get("TIPO_CONTR")),
            "estado": BASE.clean(attributes.get("ESTAD_AREA")),
            "subtipo": BASE.clean(attributes.get("SUBTIPO")),
            "operador": BASE.clean(attributes.get("OPERADOR")),
            "operador_abrev": BASE.clean(attributes.get("OPR_ABR")),
            "area_ha": attributes.get("AREA_HA"),
            "cuenca": BASE.clean(attributes.get("CUENCA_SED")),
            "superficie": BASE.clean(attributes.get("SUPERFICIE")),
            "yacimiento": BASE.clean(attributes.get("YACIMIENTO")),
            "proceso": BASE.clean(attributes.get("PROCESO")),
            "leyenda": BASE.clean(attributes.get("LEYENDA")),
            "url_minuta": BASE.clean(attributes.get("URL_MINUTA")),
            "id_gecoh": BASE.clean(attributes.get("ID_GECOH")),
        }

    catalog = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "recordCount": len(records),
        "records": records,
    }
    DETAILS_PATH.parent.mkdir(parents=True, exist_ok=True)
    DETAILS_PATH.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return catalog


def enriched_build_tiles(data_dir: Path, output: Path, metadata_path: Path, tippecanoe: str) -> dict[str, object]:
    metadata = BASE_BUILD_TILES(data_dir, output, metadata_path, tippecanoe)
    catalog = build_detail_catalog(data_dir)
    metadata["details"] = {
        "path": "context-details.json",
        "recordCount": catalog["recordCount"],
        "sizeBytes": DETAILS_PATH.stat().st_size,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return metadata


BASE.runap_features = runap_features
BASE.anm_features = anm_features
BASE.anla_features = anla_features
BASE.anh_features = anh_features
BASE.build_tiles = enriched_build_tiles


if __name__ == "__main__":
    raise SystemExit(BASE.main())
