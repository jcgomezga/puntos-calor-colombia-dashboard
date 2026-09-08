#!/usr/bin/env python3
"""Migración única y verificable de la interfaz pública hacia episodios operacionales.

No altera dashboard.json ni la sensibilidad A/B almacenada. Solo cambia la interfaz
para usar B como universo público y priorizar episodios 1 km / 24 h / >=3.
"""

from pathlib import Path
import re

PATH = Path("app/page.tsx")
source = PATH.read_text(encoding="utf-8")
original = source


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    source = source.replace(old, new, 1)


replace_once('type Scenario = "A" | "B";\n', '', "tipo Scenario")
replace_once('type EpisodeRelation = "all" | "episode" | "pair" | "isolated" | "chained";\n', '', "tipo EpisodeRelation")
replace_once('  const [scenario, setScenario] = useState<Scenario>("B");\n', '', "estado scenario")
replace_once('  const [episodeRelation, setEpisodeRelation] = useState<EpisodeRelation>("all");\n', '', "estado episodeRelation")
replace_once('    if (scenario === "B" && point[7] !== 1) return false;\n', '    if (point[7] !== 1) return false;\n', "filtro operacional B")
for line in [
    '    if (episodeRelation === "episode" && point[17] !== 2 && point[17] !== 3) return false;\n',
    '    if (episodeRelation === "pair" && point[17] !== 1) return false;\n',
    '    if (episodeRelation === "isolated" && point[17] !== 0) return false;\n',
    '    if (episodeRelation === "chained" && point[17] !== 3) return false;\n',
]:
    replace_once(line, '', "filtro de clasificación secundaria")
replace_once(
    '  }), [scenario, startIndex, endIndex, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, episodeRelation, landCovers]);\n',
    '  }), [startIndex, endIndex, selectedDepartmentIndex, selectedMunicipalityIndex, protectedRelation, landCoverLevel, miningRelation, anlaRelation, anlaLegalStatus, anhRelation, landCovers]);\n',
    "dependencias visiblePoints",
)

metrics_pattern = re.compile(r'  const metrics = useMemo\(\(\) => \{.*?\n  \}, \[visiblePoints\]\);', re.S)
metrics_replacement = '''  const metrics = useMemo(() => {
    const departments = new Set<number>(), municipalities = new Set<number>(), sources = new Set<number>();
    const episodes = new Set<number>(), protectedEpisodes = new Set<number>(), miningEpisodes = new Set<number>();
    const anlaEpisodes = new Set<number>(), anhEpisodes = new Set<number>();
    const covers = new Set<number>();
    for (const point of visiblePoints) {
      sources.add(point[6]);
      const episodeIndex = point[18] ?? -1;
      if (episodeIndex < 0) continue;
      episodes.add(episodeIndex);
      if (point[2] >= 0) departments.add(point[2]);
      if (point[3] >= 0) municipalities.add(point[3]);
      if ((point[12] ?? -1) >= 0) covers.add(point[12]!);
      if (point[11] === 1) protectedEpisodes.add(episodeIndex);
      if (point[13] === 1) miningEpisodes.add(episodeIndex);
      if ((point[14] ?? 0) > 0) anlaEpisodes.add(episodeIndex);
      if ((point[16] ?? 0) > 0) anhEpisodes.add(episodeIndex);
    }
    return {
      departments: departments.size,
      municipalities: municipalities.size,
      sources: sources.size,
      protected: protectedEpisodes.size,
      covers: covers.size,
      mining: miningEpisodes.size,
      anla: anlaEpisodes.size,
      anh: anhEpisodes.size,
      episodes: episodes.size,
    };
  }, [visiblePoints]);'''
source, count = metrics_pattern.subn(metrics_replacement, source, count=1)
if count != 1:
    raise RuntimeError(f"bloque metrics: {count} coincidencias")

replace_once(
    '  const mapPoints = selectedEpisodeIndex === null ? visiblePoints : visiblePoints.filter((point) => point[18] === selectedEpisodeIndex);\n',
    '''  const mapPoints = selectedEpisodeIndex === null ? visiblePoints : visiblePoints.filter((point) => point[18] === selectedEpisodeIndex);
  const basicEpisodePoints = useMemo(() => {
    const indexes = [...new Set(mapPoints.map((point) => point[18] ?? -1).filter((index) => index >= 0))];
    return indexes.flatMap((index) => {
      const episode = dashboard.episodes?.[index];
      return episode ? [[episode.longitude, episode.latitude, -1, -1, 0, 0, 0, 1, null, 0, 0] as PointRow] : [];
    });
  }, [mapPoints]);
''',
    "puntos de mapa básico",
)

ranking_pattern = re.compile(r'  const ranking = useMemo\(\(\) => \{.*?\n  \}, \[visiblePoints, departmentCode\]\);', re.S)
ranking_replacement = '''  const ranking = useMemo(() => {
    const byMunicipality = departmentCode !== "00";
    const memberships = new Map<number, Set<number>>();
    for (const point of visiblePoints) {
      const episodeIndex = point[18] ?? -1;
      const territoryIndex = byMunicipality ? point[3] : point[2];
      if (episodeIndex < 0 || territoryIndex < 0) continue;
      if (!memberships.has(territoryIndex)) memberships.set(territoryIndex, new Set());
      memberships.get(territoryIndex)!.add(episodeIndex);
    }
    const catalog = byMunicipality ? dashboard.municipalities : dashboard.departments;
    return [...memberships.entries()].map(([index, episodes]) => ({ name: catalog[index].name, value: episodes.size })).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [visiblePoints, departmentCode]);'''
source, count = ranking_pattern.subn(ranking_replacement, source, count=1)
if count != 1:
    raise RuntimeError(f"bloque ranking: {count} coincidencias")

reset_pattern = re.compile(r'  const reset = \(\) => \{[^\n]+\};')
reset_replacement = '  const reset = () => { setDepartmentCode("00"); setMunicipalityCode("00000"); setStartDate(dashboard.metadata.historyStartDate); setEndDate(dashboard.metadata.lastObservationDate); setProtectedRelation("all"); setLandCoverLevel("all"); setMiningRelation("all"); setAnlaRelation("all"); setAnlaLegalStatus("all"); setAnhRelation("all"); setSelectedEpisodeIndex(null); };'
source, count = reset_pattern.subn(reset_replacement, source, count=1)
if count != 1:
    raise RuntimeError(f"reset: {count} coincidencias")

replace_once('<h1>Detecciones de calor</h1>', '<h1>Episodios de detecciones térmicas</h1>', "titulo principal")
replace_once(
    '<section className="notice" aria-label="Advertencia metodológica"><CircleAlert size={18} /><p><strong>Lectura responsable:</strong> una detección térmica satelital ni una agrupación espacio-temporal confirman por sí solas un incendio, su extensión o su causa. Fuente de puntos: IDEAM; asignación territorial: MGN 2025 del DANE.</p></section>',
    '<section className="notice" aria-label="Advertencia metodológica"><CircleAlert size={18} /><p><strong>Qué significa un episodio:</strong> es una agrupación algorítmica de al menos 3 detecciones térmicas conectadas dentro de 1 km y 24 horas. Sirve para organizar señales satelitales; <strong>no confirma por sí sola un incendio, una superficie quemada ni una causa.</strong> La interfaz usa una única configuración operativa y conserva la sensibilidad histórica A/B en la metodología y el backend.</p></section>',
    "advertencia metodológica",
)

aggregation_line = re.compile(r'\n      <label><span>Agrupación térmica</span>.*?</label>', re.S)
source, count = aggregation_line.subn('', source, count=1)
if count != 1:
    raise RuntimeError(f"control agrupación térmica: {count} coincidencias")
scenario_line = re.compile(r'\n      <div className="scenario-field">.*?</div></div>', re.S)
source, count = scenario_line.subn('', source, count=1)
if count != 1:
    raise RuntimeError(f"selector A/B: {count} coincidencias")

metrics_grid_pattern = re.compile(r'    <section className="metrics-grid">.*?\n    </section>', re.S)
metrics_grid_replacement = '''    <section className="metrics-grid">
      <MetricCard icon={Network} label="Episodios visibles" value={numberFormat.format(metrics.episodes)} detail={`1 km · 24 h · mínimo 3 · ${labelDate(startDate)}–${labelDate(endDate)}`} />
      <MetricCard icon={Flame} label="Detecciones individuales" value={numberFormat.format(visiblePoints.length)} detail={`${numberFormat.format(metrics.sources)} fuentes operativas · Suomi-NPP excluido`} />
      <MetricCard icon={MapPinned} label="Departamentos" value={numberFormat.format(metrics.departments)} detail="Con al menos un episodio visible" />
      <MetricCard icon={Activity} label="Municipios" value={numberFormat.format(metrics.municipalities)} detail="Con al menos un episodio · DANE 2025" />
      <MetricCard icon={Leaf} label="Episodios en áreas protegidas" value={numberFormat.format(metrics.protected)} detail="Al menos una detección miembro dentro de RUNAP" />
      <MetricCard icon={Layers3} label="Coberturas detalladas" value={numberFormat.format(metrics.covers)} detail="Coberturas de miembros · IDEAM 2024" />
      <MetricCard icon={Pickaxe} label="Episodios en títulos mineros" value={numberFormat.format(metrics.mining)} detail="Al menos una detección miembro dentro de ANM" />
      <MetricCard icon={Building2} label="Episodios relacionados con ANLA" value={numberFormat.format(metrics.anla)} detail="Al menos una detección miembro dentro o hasta 5 km" />
      <MetricCard icon={Fuel} label="Episodios relacionados con ANH" value={numberFormat.format(metrics.anh)} detail="Áreas asignadas · dentro o hasta 5 km" />
    </section>'''
source, count = metrics_grid_pattern.subn(metrics_grid_replacement, source, count=1)
if count != 1:
    raise RuntimeError(f"metrics-grid: {count} coincidencias")

replace_once('<span className="method-chip">Escenario {scenario}</span>', '<span className="method-chip">1 km · 24 h · ≥3</span>', "chip mapa")
replace_once('points={mapPoints} departmentCode={departmentCode}', 'points={basicEpisodePoints} departmentCode={departmentCode}', "mapa básico con episodios")
replace_once('<span><i className="dot-high" /> Detección IDEAM</span>', '<span><i className="dot-high" /> Episodio térmico</span>', "leyenda mapa básico")
replace_once(' Los indicadores y gráficos se recalculan con el periodo y escenario seleccionados.', ' Los indicadores y gráficos se recalculan con el periodo y los filtros seleccionados.', "caption sin escenario")
replace_once('"Departamentos" : "Municipios"} con más detecciones', '"Departamentos" : "Municipios"} con más episodios', "titulo ranking")
replace_once('<Bar dataKey="value" name="Detecciones"', '<Bar dataKey="value" name="Episodios"', "serie ranking")
replace_once('<h2>Detecciones por {trendGrouping === "day" ? "día" : "mes"}</h2>', '<h2>Detecciones individuales por {trendGrouping === "day" ? "día" : "mes"}</h2>', "titulo tendencia")
replace_once('<Area type="monotone" dataKey="value" name="Detecciones"', '<Area type="monotone" dataKey="value" name="Detecciones individuales"', "serie tendencia")
replace_once('aria-label="Explorador de episodios preliminares"', 'aria-label="Explorador de episodios operacionales"', "aria episodios")
replace_once('Episodios con más detecciones visibles', 'Episodios con más detecciones miembro visibles', "titulo explorador")
replace_once('<span className="method-chip">B · 1 km · 24 h</span>', '<span className="method-chip">1 km · 24 h · ≥3</span>', "chip explorador")
replace_once('El mapa muestra únicamente los miembros visibles de este episodio. Quita la selección para recuperar todas las detecciones filtradas.', 'El geovisor conserva este episodio como unidad principal. Activa «Detecciones individuales» para inspeccionar sus miembros; quita la selección para recuperar todos los episodios filtrados.', "nota de episodio")

if 'setScenario(' in source or 'scenario ===' in source or 'Escenario {scenario}' in source or 'Escenario de sensores' in source:
    raise RuntimeError("quedaron referencias públicas al selector A/B")
if 'episodeRelation' in source:
    raise RuntimeError("quedaron referencias al filtro de clasificación secundaria")
if source == original:
    raise RuntimeError("la migración no produjo cambios")

PATH.write_text(source, encoding="utf-8")
print("Interfaz migrada a configuración operacional única por episodios.")
