#!/usr/bin/env python3
"""Ajuste final de lenguaje de la interfaz operacional por episodios.

No modifica datos, episodios ni sensibilidad instrumental almacenada. Solo evita
reintroducir la comparación histórica en la interfaz pública y aclara que los
filtros territoriales/contextuales actúan sobre la exploración de episodios.
"""

from pathlib import Path

PATH = Path("app/page.tsx")
source = PATH.read_text(encoding="utf-8")
original = source


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    source = source.replace(old, new, 1)


replace_once(
    "La interfaz usa una única configuración operativa y conserva la sensibilidad histórica A/B en la metodología y el backend.",
    "La interfaz usa una única configuración operativa; la sensibilidad por composición instrumental se conserva en la metodología y el backend.",
    "advertencia sin A/B",
)
replace_once(
    '<option value="all">Todas las detecciones</option><option value="inside">Dentro de RUNAP</option><option value="outside">Fuera de RUNAP</option>',
    '<option value="all">Sin filtro por RUNAP</option><option value="inside">Con miembro dentro de RUNAP</option><option value="outside">Sin miembro dentro de RUNAP</option>',
    "filtro RUNAP",
)
replace_once(
    '<option value="all">Todas las detecciones</option><option value="inside">Dentro de título vigente</option><option value="outside">Fuera de título vigente</option>',
    '<option value="all">Sin filtro por ANM</option><option value="inside">Con miembro dentro de título vigente</option><option value="outside">Sin miembro dentro de título vigente</option>',
    "filtro ANM",
)
replace_once(
    '<option value="all">Todas las detecciones</option><option value="inside">Dentro de área de proyecto</option><option value="within1">Hasta 1 km</option><option value="between1and5">Entre 1 y 5 km</option><option value="beyond5">A más de 5 km</option>',
    '<option value="all">Sin filtro por ANLA</option><option value="inside">Con miembro dentro del proyecto</option><option value="within1">Con miembro hasta 1 km</option><option value="between1and5">Con miembro entre 1 y 5 km</option><option value="beyond5">Sin miembro dentro de 5 km</option>',
    "filtro ANLA",
)
replace_once(
    '<option value="all">Todas las detecciones</option><option value="inside">Dentro de área asignada</option><option value="within1">Hasta 1 km</option><option value="between1and5">Entre 1 y 5 km</option><option value="beyond5">A más de 5 km</option>',
    '<option value="all">Sin filtro por ANH</option><option value="inside">Con miembro dentro de área asignada</option><option value="within1">Con miembro hasta 1 km</option><option value="between1and5">Con miembro entre 1 y 5 km</option><option value="beyond5">Sin miembro dentro de 5 km</option>',
    "filtro ANH",
)
replace_once(
    '"Navega, acerca y activa capas. Haz clic en un territorio, una detección, una cobertura o una capa de contexto para consultar."',
    '"Navega, acerca y activa capas. Consulta episodios, coberturas y contexto; activa las detecciones individuales cuando necesites inspeccionar los miembros de un episodio."',
    "instrucción del geovisor",
)

if "sensibilidad histórica A/B" in source or "Escenario de sensores" in source or "setScenario" in source:
    raise RuntimeError("la interfaz todavía expone la comparación histórica de sensores")
if source == original:
    raise RuntimeError("el ajuste final no produjo cambios")

PATH.write_text(source, encoding="utf-8")
print("Lenguaje público de arquitectura operacional actualizado.")
