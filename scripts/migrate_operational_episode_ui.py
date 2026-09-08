#!/usr/bin/env python3
"""Ajuste reproducible de las fichas de consulta del geovisor operacional.

Corrige los atributos de Coberturas IDEAM contra el esquema oficial publicado y
amplía las fichas ANM/ANLA/ANH para aprovechar los atributos ya descargados y
publicados por la construcción enriquecida de PMTiles. No cambia datos ni reglas
espaciales.
"""

from pathlib import Path
import re

PATH = Path("components/operational-geovisor-map.tsx")
source = PATH.read_text(encoding="utf-8")
original = source

replacement = r'''function landCoverPopup(feature: MapGeoJSONFeature) {
  const properties = feature.properties as Record<string, unknown>;
  const symbol = Number(properties._symbol);
  const root = document.createElement("div");
  root.className = "geovisor-popup";
  const title = document.createElement("h3");
  title.textContent = "Cobertura de la Tierra 2024";
  const level1 = firstProperty(properties, ["nivel_1", "NIVEL_1"]);
  const level2 = firstProperty(properties, ["nivel_2", "NIVEL_2"]);
  const level3 = firstProperty(properties, ["nivel_3", "NIVEL_3"]);
  const level4 = firstProperty(properties, ["nivel_4", "NIVEL_4"]);
  const level5 = firstProperty(properties, ["nivel_5", "NIVEL_5"]);
  const level6 = firstProperty(properties, ["nivel_6", "NIVEL_6"]);
  const rendererLabel = LAND_COVER_CLASSES[symbol]?.[0] ?? "Clase sin identificar";
  const area = firstProperty(properties, ["area_ha", "AREA_HA"]);
  const department = firstProperty(properties, ["nom_dep", "NOM_DEP"]);
  const municipality = firstProperty(properties, ["nom_mun", "NOM_MUN"]);
  const authority = firstProperty(properties, ["nom_aua", "NOM_AUA"]);
  const period = firstProperty(properties, ["periodo", "PERIODO"]);
  root.append(title, popupRow("Clase cartográfica", rendererLabel));
  if (level1) root.append(popupRow("Nivel 1", level1));
  if (level2) root.append(popupRow("Nivel 2", level2));
  if (level3) root.append(popupRow("Nivel 3", level3));
  if (level4) root.append(popupRow("Nivel 4", level4));
  if (level5) root.append(popupRow("Nivel 5", level5));
  if (level6) root.append(popupRow("Nivel 6", level6));
  if (area && Number.isFinite(Number(area))) root.append(popupRow("Área del polígono", humanNumber(area, " ha")));
  if (department || municipality) root.append(popupRow("Territorio", [municipality, department].filter(Boolean).join(" · ")));
  if (authority) root.append(popupRow("Autoridad ambiental", authority));
  if (period) root.append(popupRow("Periodo", period));
  root.append(popupRow("Fuente", "IDEAM · Mapa Nacional de Coberturas de la Tierra 2024 · escala 1:100.000"));
  return root;
}

function contextPopup(feature: MapGeoJSONFeature) {
  const properties = feature.properties as Record<string, unknown>;
  const sourceLayer = feature.sourceLayer;
  const root = document.createElement("div");
  root.className = "geovisor-popup";
  root.style.maxHeight = "380px";
  root.style.overflowY = "auto";
  const title = document.createElement("h3");
  const rows: HTMLElement[] = [];
  const addIf = (label: string, value: unknown, suffix = "") => {
    const text = present(value);
    if (text) rows.push(popupRow(label, suffix ? `${text}${suffix}` : text));
  };
  if (sourceLayer === "runap") {
    title.textContent = "Ficha RUNAP";
    if (feature.id !== undefined && feature.id !== null) rows.push(popupRow("ID", String(feature.id)));
    addIf("Nombre", properties.nombre);
    addIf("Categoría", properties.categoria);
    addIf("Condición", properties.condicion);
    addIf("Administración", properties.organizacion);
    rows.push(popupRow("Lectura", "Coincidencia espacial; no implica causalidad"));
  } else if (sourceLayer === "anm") {
    title.textContent = "Ficha de título minero ANM";
    addIf("Expediente", properties.codigo);
    addIf("Titular / solicitante", properties.solicitante);
    addIf("Minerales", properties.minerales);
    addIf("Etapa", properties.etapa);
    addIf("Estado", properties.estado);
    addIf("Modalidad", properties.modalidad);
    addIf("Tipo de explotación", properties.tipo);
    addIf("Municipios", properties.municipios);
    addIf("Departamento", properties.departamento);
    if (properties.area_ha != null && Number.isFinite(Number(properties.area_ha))) rows.push(popupRow("Área", humanNumber(properties.area_ha, " ha")));
    addIf("Fecha de inscripción", properties.fecha_inscripcion);
    addIf("Fecha de terminación", properties.fecha_terminacion);
    rows.push(popupRow("Lectura", "Intersección espacial; no implica origen del fuego"));
  } else if (sourceLayer === "anla") {
    title.textContent = "Ficha de proyecto ANLA";
    addIf("Expediente", properties.expediente);
    addIf("Proyecto", properties.proyecto);
    addIf("Operador", properties.operador);
    addIf("Sector", properties.sector);
    addIf("Situación", properties.situacion === "evaluacion" ? "En evaluación" : "Licenciado");
    addIf("Estado", properties.estado);
    addIf("Geometría", properties.geometria);
    addIf("Acto administrativo", properties.acto_administrativo);
    addIf("Fecha del acto", properties.fecha_acto);
    addIf("Artículo", properties.articulo_acto);
    addIf("Contrato", properties.contrato);
    addIf("Tipo de infraestructura", properties.tipo_infraestructura);
    if (properties.area_ha != null && Number.isFinite(Number(properties.area_ha))) rows.push(popupRow("Área", humanNumber(properties.area_ha, " ha")));
    if (properties.longitud_m != null && Number.isFinite(Number(properties.longitud_m))) rows.push(popupRow("Longitud", humanNumber(properties.longitud_m, " m")));
    addIf("Descripción", properties.descripcion);
    addIf("Nomenclatura", properties.nomenclatura);
    addIf("Observación", properties.observacion);
    rows.push(popupRow("Lectura", "Coincidencia/proximidad espacial; no implica causalidad"));
  } else {
    title.textContent = "Ficha de área contractual ANH";
    addIf("ID contractual", properties.contrato_id);
    addIf("Contrato", properties.contrato);
    addIf("Área / bloque", properties.area);
    addIf("Operador", properties.operador);
    addIf("Operador abreviado", properties.operador_abrev);
    addIf("Estado", properties.estado);
    addIf("Clasificación", properties.clasificacion);
    addIf("Tipo de contrato", properties.tipo);
    addIf("Subtipo", properties.subtipo);
    addIf("Fecha de firma", properties.fecha_firma);
    addIf("Cuenca", properties.cuenca);
    if (properties.area_ha != null && Number.isFinite(Number(properties.area_ha))) rows.push(popupRow("Área", humanNumber(properties.area_ha, " ha")));
    addIf("Superficie", properties.superficie);
    addIf("Yacimiento", properties.yacimiento);
    addIf("Proceso", properties.proceso);
    addIf("Leyenda", properties.leyenda);
    addIf("ID GECOH", properties.id_gecoh);
    addIf("Minuta oficial", properties.url_minuta);
    rows.push(popupRow("Lectura", "Coincidencia/proximidad espacial; no implica causalidad"));
  }
  root.append(title, ...rows);
  return root;
}

function featureBounds'''

pattern = re.compile(r"function landCoverPopup\(feature: MapGeoJSONFeature\) \{.*?\nfunction featureBounds", re.S)
source, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise RuntimeError(f"bloque de fichas: se esperaba 1 coincidencia y se encontraron {count}")

if "confiabili" in source or "nom_dpto" in source or "nom_mpio" in source:
    raise RuntimeError("persisten nombres de campo no publicados por el esquema IDEAM 2024 consultado")
if source == original:
    raise RuntimeError("el ajuste de fichas no produjo cambios")

PATH.write_text(source, encoding="utf-8")
print("Fichas de consulta territorial enriquecidas.")
