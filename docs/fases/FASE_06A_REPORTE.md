# Fase 6A — Sensibilidad de episodios espacio-temporales

## Estado

Auditoría metodológica terminada. No se incorporaron episodios al dashboard.

## Objetivo

Determinar cómo cambia la agrupación de las detecciones nacionales al variar simultáneamente la distancia y la ventana temporal, antes de fijar una configuración operativa que pueda modificar indicadores y relaciones espaciales.

## Matriz evaluada

- Distancias: 500 m, 1.000 m y 2.000 m.
- Ventanas: 12 h, 24 h y 48 h.
- Escenarios: A, todos los sensores; B, sin Suomi-NPP.
- Combinaciones: 18.
- Regla de enlace: dos detecciones se conectan únicamente cuando cumplen simultáneamente ambos umbrales, incluidos sus límites exactos.
- Agrupación: componentes conexos espacio-temporales.

La conectividad es transitiva: si A se conecta con B y B con C, los tres pertenecen al mismo componente aunque A y C no sean vecinos directos. Por ello se midieron duración y diagonal de la caja envolvente para detectar encadenamientos extensos.

## Categorías analíticas propuestas

| Categoría | Regla | Uso recomendado |
|---|---|---|
| Aislada | Un hotspot sin vecino | Mantener como detección individual |
| Asociación candidata | Dos hotspots conectados | Mostrar separada; no denominar episodio consolidado |
| Episodio preliminar | Tres o más hotspots conectados | Incorporar solo con advertencia metodológica |
| Episodio encadenado | Duración o diagonal superior a cinco veces el umbral | Marcar para control y posible revisión |

## Resultados del escenario B

| Distancia | Ventana | Episodios ≥3 | Hotspots en episodios ≥3 | Pares | Aislados | Tamaño máximo |
|---:|---:|---:|---:|---:|---:|---:|
| 500 m | 12 h | 1.601 | 8.189 | 2.158 | 9.425 | 71 |
| 500 m | 24 h | 1.636 | 8.885 | 2.063 | 8.919 | 106 |
| 500 m | 48 h | 1.654 | 9.273 | 2.013 | 8.631 | 114 |
| 1.000 m | 12 h | 1.868 | 10.209 | 2.172 | 7.377 | 157 |
| 1.000 m | 24 h | 1.881 | 10.975 | 2.027 | 6.901 | 232 |
| 1.000 m | 48 h | 1.878 | 11.375 | 1.976 | 6.603 | 289 |
| 2.000 m | 12 h | 1.955 | 11.030 | 2.176 | 6.548 | 211 |
| 2.000 m | 24 h | 1.969 | 11.925 | 1.978 | 6.049 | 315 |
| 2.000 m | 48 h | 1.971 | 12.451 | 1.906 | 5.667 | 317 |

## Configuración recomendada para aprobación

**Escenario B · 1.000 m · 24 horas · mínimo 3 detecciones.**

Razones:

1. Ocupa el centro de los rangos ensayados y no selecciona un extremo por conveniencia.
2. Reduce los aislados respecto de 500 m sin alcanzar las fusiones y tamaños máximos de 2 km.
3. La cantidad de episodios robustos es estable frente a 12 y 48 horas: 1.868, 1.881 y 1.878.
4. El percentil 95 es de 9 detecciones, 24,47 horas y 1,68 km de diagonal; la mayoría de los grupos conserva una escala acotada.
5. Mantiene el escenario A como sensibilidad, sin mezclarlo con el resultado operativo B.

Con esta configuración:

- 21.930 hotspots del escenario B fueron evaluados.
- 1.881 episodios preliminares reúnen 10.975 hotspots.
- 2.027 asociaciones de dos puntos reúnen 4.054 hotspots.
- 6.901 detecciones quedan aisladas.
- 179 episodios candidatos atraviesan más de un municipio; no deben dividirse artificialmente.
- 16 agrupaciones candidatas presentan encadenamiento fuerte y reúnen 1.013 hotspots.
- El grupo mayor contiene 232 hotspots, equivalente al 1,058 % del escenario B.

## Riesgos que debe resolver la Fase 6B

1. **Identidad estable:** una detección nueva puede ampliar o fusionar episodios existentes. El identificador no debe depender del `OBJECTID` ni únicamente del conjunto completo de miembros.
2. **Fusión retrospectiva:** debe registrarse el linaje cuando dos identificadores previos pasan a formar un solo episodio.
3. **Pares:** no deben sumarse automáticamente a los indicadores de episodios de tres o más detecciones.
4. **Encadenamiento:** las agrupaciones marcadas necesitan una bandera visible y análisis de sensibilidad.
5. **Mes abierto:** los episodios del periodo en curso pueden seguir creciendo.
6. **Interpretación:** un episodio inferido sigue siendo una agrupación de anomalías térmicas, no un incendio confirmado.

## Productos

- `scripts/analyze_episode_sensitivity.py`.
- `tests_py/test_analyze_episode_sensitivity.py`.
- `data/episodes/sensitivity_matrix.csv`.
- `data/episodes/sensitivity_matrix.json`.
- `data/metadata/episode_sensitivity_latest_run.json`.

## Validaciones

- 48/48 pruebas Python aprobadas en el repositorio completo.
- 10/10 pruebas web aprobadas.
- ESLint y ambas compilaciones aprobados.
- Inclusión exacta de los límites espaciales y temporales.
- Exclusión cuando solo uno de los dos criterios se cumple.
- Verificación explícita de la transitividad.
- Separación de pares y episodios de tres o más detecciones.
- Cierre sobre 31.353 hotspots del escenario A y 21.930 del escenario B.

## Decisión pendiente

La configuración recomendada no alimentará el dashboard hasta aprobar la Fase 6B. La aprobación debe cubrir el escenario B, 1 km, 24 horas, mínimo tres detecciones, tratamiento separado de pares y bandera de encadenamiento.
