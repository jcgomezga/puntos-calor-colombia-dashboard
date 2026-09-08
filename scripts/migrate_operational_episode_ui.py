#!/usr/bin/env python3
"""Ajusta los filtros de contexto para que operen sobre episodios completos.

La interfaz tiene como unidad principal el episodio. Por tanto, RUNAP, coberturas,
ANM, ANLA y ANH se evalúan sobre el conjunto de detecciones miembro de cada
episodio dentro del periodo/territorio seleccionado. Los filtros de dominios
independientes no exigen que una misma detección satisfaga todos a la vez.
"""

from pathlib import Path
import re

PATH = Path("app/page.tsx")
source = PATH.read_text(encoding="utf-8")
original = source

replacement = r'''  const municipalityOptions = useMemo(() => dashboard.municipalities.filter((item) => item.departmentCode === departmentCode), [departmentCode]);
  const basePoints = useMemo(() => dashboard.points.filter((point) => {
    if (point[7] !== 1) return false;
    if (point[4] < startIndex || point[4] > endIndex) return false;
    if (selectedDepartmentIndex !== undefined && point[2] !== selectedDepartmentIndex) return false;
    if (selectedMunicipalityIndex !== undefined && point[3] !== selectedMunicipalityIndex) return false;
    return true;
  }), [startIndex, endIndex, selectedDepartmentIndex, selectedMunicipalityIndex]);

  const episodeFilterActive = protectedRelation !== "all" || landCoverLevel !== "all" || miningRelation !== "all" || anlaRelation !== "all" || anlaLegalStatus !== "all" || anhRelation !== "all";
  const qualifyingEpisodeIndexes = useMemo(() => {
    const members = new Map<number, PointRow[]>();
    for (const point of basePoints) {
      const episodeIndex = point[18] ?? -1;
      if (episodeIndex < 0) continue;
      if (!members.has(episodeIndex)) members.set(episodeIndex, []);
      members.get(episodeIndex)!.push(point);
    }
    const qualifies = new Set<number>();
    for (const [episodeIndex, episodeMembers] of members) {
      const has = (predicate: (point: PointRow) => boolean) => episodeMembers.some(predicate);
      const lacks = (predicate: (point: PointRow) => boolean) => !has(predicate);
      if (protectedRelation === "inside" && !has((point) => point[11] === 1)) continue;
      if (protectedRelation === "outside" && !lacks((point) => point[11] === 1)) continue;
      if (landCoverLevel !== "all" && !has((point) => point[12] !== undefined && point[12] >= 0 && landCovers[point[12]]?.level1Code === landCoverLevel)) continue;
      if (miningRelation === "inside" && !has((point) => point[13] === 1)) continue;
      if (miningRelation === "outside" && !lacks((point) => point[13] === 1)) continue;
      if (anlaRelation === "inside" && !has((point) => point[14] === 3)) continue;
      if (anlaRelation === "within1" && !has((point) => point[14] === 2)) continue;
      if (anlaRelation === "between1and5" && !has((point) => point[14] === 1)) continue;
      if (anlaRelation === "beyond5" && !lacks((point) => (point[14] ?? 0) > 0)) continue;
      if (anlaLegalStatus === "evaluation" && !has((point) => ((point[15] ?? 0) & 1) !== 0)) continue;
      if (anlaLegalStatus === "licensed" && !has((point) => ((point[15] ?? 0) & 2) !== 0)) continue;
      if (anhRelation === "inside" && !has((point) => point[16] === 3)) continue;
      if (anhRelation === "within1" && !has((point) => point[16] === 2)) continue;
      if (anhRelation === "between1and5" && !has((point) => point[16] === 1)) continue;
      if (anhRelation === "beyond5" && !lacks((point) => (point[16] ?? 0) > 0)) continue;
      qualifies.add(episodeIndex);
    }
    return qualifies;
  }, [basePoints, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, landCovers]);

  const visiblePoints = useMemo(() => {
    if (!episodeFilterActive) return basePoints;
    return basePoints.filter((point) => qualifyingEpisodeIndexes.has(point[18] ?? -1));
  }, [basePoints, episodeFilterActive, qualifyingEpisodeIndexes]);'''

pattern = re.compile(
    r'  const municipalityOptions = useMemo\(\(\) => dashboard\.municipalities\.filter\(\(item\) => item\.departmentCode === departmentCode\), \[departmentCode\]\);\n'
    r'  const visiblePoints = useMemo\(\(\) => dashboard\.points\.filter\(\(point\) => \{.*?\n'
    r'  \}\), \[startIndex, endIndex, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, landCovers\]\);',
    re.S,
)
source, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise RuntimeError(f"bloque de filtros: se esperaba 1 coincidencia y se encontraron {count}")

if 'protectedRelation === "inside" && point[11]' in source:
    raise RuntimeError("persistió el filtro RUNAP a nivel de detección")
if 'episodeFilterActive' not in source or 'qualifyingEpisodeIndexes' not in source:
    raise RuntimeError("no se instaló la evaluación a nivel de episodio")
if source == original:
    raise RuntimeError("el ajuste de filtros no produjo cambios")

PATH.write_text(source, encoding="utf-8")
print("Filtros de contexto migrados a semántica de episodio.")
