import { readFileSync, writeFileSync } from "node:fs";

const path = "app/page.tsx";
let source = readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`No se encontró: ${label}`);
  if (source.indexOf(from) !== source.lastIndexOf(from)) throw new Error(`Fragmento duplicado: ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  '[startIndex, endIndex, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, landCovers]);',
  '[startIndex, endIndex, departmentCode, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, landCovers]);',
  "dependencia departmentCode del filtro visible",
);

replaceOnce(
  '  const mapMunicipalityCode = departmentCode === UNASSIGNED_TERRITORY ? "00000" : municipalityCode;\n  const reset = () =>',
  '  const mapMunicipalityCode = departmentCode === UNASSIGNED_TERRITORY ? "00000" : municipalityCode;\n  const rankingHeading = departmentCode === "00" ? "Departamentos con más detecciones" : departmentCode === UNASSIGNED_TERRITORY ? "Detecciones sin territorio asignado" : "Municipios con más detecciones";\n  const rankingLabel = departmentCode === "00" ? "Ranking de departamentos con más detecciones" : departmentCode === UNASSIGNED_TERRITORY ? "Detecciones sin territorio asignado" : "Ranking de municipios con más detecciones";\n  const reset = () =>',
  "etiquetas de ranking",
);

replaceOnce(
  '<h2>{departmentCode === "00" ? "Departamentos" : "Municipios"} con más detecciones</h2>',
  '<h2>{rankingHeading}</h2>',
  "encabezado ranking",
);

replaceOnce(
  '<RankingChart data={ranking} label={`Ranking de ${departmentCode === "00" ? "departamentos" : "municipios"} con más detecciones`} />',
  '<RankingChart data={ranking} label={rankingLabel} />',
  "label accesible ranking",
);

writeFileSync(path, source);
console.log("MB-06: dependencia y etiquetas de ranking corregidas.");
