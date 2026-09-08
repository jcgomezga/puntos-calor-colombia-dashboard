#!/usr/bin/env python3
"""Construye las teselas de contexto con atributos de consulta ampliados.

Reutiliza el motor geométrico y las salvaguardas de build_context_tiles.py, pero
publica un subconjunto de atributos oficiales útil para consulta sin duplicar en
cada tesela campos narrativos extensos. No altera las reglas espaciales ni el
universo de geometrías: RUNAP, ANM, ANLA y ANH conservan exactamente el mismo
alcance.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("context_tiles_base", ROOT / "scripts" / "build_context_tiles.py")
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("no fue posible cargar build_context_tiles.py")
BASE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BASE
SPEC.loader.exec_module(BASE)


def anm_features(data_dir: Path) -> Iterable[dict[str, object]]:
    collection = BASE.read_gzip_json(data_dir / "boundaries" / "anm_titles_join.geojson.gz")
    for feature in collection.get("features", []):
        properties = feature.get("properties", {})
        geometry = feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue
        yield BASE.geojson_feature(geometry, {
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
        }, properties.get("fid"))


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
            sector_code = BASE.clean(attributes.get("sector")).removesuffix(".0")
            yield BASE.geojson_feature(BASE.mapping(converted), {
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
                "area_ha": attributes.get("area_ha"),
                "longitud_m": attributes.get("longitud_m"),
                "tipo_infraestructura": BASE.clean(attributes.get("tipo_infra")),
            }, attributes.get("objectid") or attributes.get("globalid") or attributes.get("globalid_1"))


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
        yield BASE.geojson_feature(BASE.mapping(converted), {
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
        }, attributes.get("OBJECTID"))


BASE.anm_features = anm_features
BASE.anla_features = anla_features
BASE.anh_features = anh_features


if __name__ == "__main__":
    raise SystemExit(BASE.main())
