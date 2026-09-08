# Fase 6C — Sensibilidad A/B de relaciones territoriales a nivel de episodio

## Estado

Auditoría metodológica terminada sobre el corte nacional acumulado del 1 de julio al 7 de septiembre de 2026. Esta fase no modifica `dashboard.json`, la identidad persistente de los episodios operativos B ni la configuración pública del dashboard.

## Objetivo

Comprobar si la exclusión operativa de VIIRS Suomi-NPP altera sustancialmente, además del número de detecciones y episodios, la estructura de las relaciones territoriales de los episodios frente a RUNAP, títulos mineros ANM, proyectos ANLA y áreas contractuales ANH.

La comparación también evalúa si los rankings internos de entidades —áreas protegidas, títulos, expedientes y contratos— conservan una estructura semejante entre los escenarios A y B.

## Método

Se reconstruyeron desde los `hotspots_*.csv` territorializados dos universos con idénticos parámetros de agrupación:

- escenario A: todos los sensores;
- escenario B: exclusión de VIIRS Suomi-NPP;
- distancia máxima de enlace: 1.000 m;
- ventana temporal: 24 h;
- episodio robusto: componente conexo de al menos 3 detecciones.

Una relación territorial a nivel de episodio se considera presente cuando **al menos una detección miembro del episodio** satisface la regla correspondiente:

- RUNAP: dentro de un área protegida;
- ANM: dentro de un título minero vigente;
- ANLA: dentro o hasta 5 km de un proyecto;
- ANH: dentro o hasta 5 km de un área contractual.

Esta definición mide exposición espacial del episodio y no causalidad. Un episodio inferido continúa siendo una agrupación espacio-temporal de anomalías térmicas y no equivale por sí mismo a un incendio confirmado ni a un efecto atribuible a una actividad extractiva.

## Cierre de universos

| Indicador | Escenario A | Escenario B | Cambio B frente a A |
|---|---:|---:|---:|
| Detecciones evaluadas | 33.550 | 23.380 | −10.170 (−30,31 %) |
| Episodios ≥3 | 3.161 | 2.008 | −1.153 (−36,48 %) |

La reconstrucción B cerró exactamente con el producto operacional vigente: 23.380 detecciones evaluadas y 2.008 episodios.

La reducción de episodios es, por tanto, sustantiva y no debe describirse como una diferencia menor entre A y B.

## Sensibilidad de las proporciones territoriales de episodios

| Relación | A: episodios relacionados | % A | B: episodios relacionados | % B | Δ B−A |
|---|---:|---:|---:|---:|---:|
| RUNAP · dentro | 217 | 6,8649 % | 147 | 7,3207 % | +0,4558 pp |
| ANM · dentro de título vigente | 683 | 21,6071 % | 472 | 23,5060 % | +1,8989 pp |
| ANLA · dentro o ≤5 km | 1.749 | 55,3306 % | 1.149 | 57,2211 % | +1,8905 pp |
| ANH · dentro o ≤5 km | 1.092 | 34,5460 % | 703 | 35,0100 % | +0,4639 pp |

Aunque el número absoluto de episodios disminuye 36,48 %, las proporciones de episodios relacionados se mantienen próximas. El mayor desplazamiento observado es de 1,90 puntos porcentuales, en ANM, seguido de 1,89 puntos porcentuales en ANLA. RUNAP y ANH cambian menos de medio punto porcentual.

La conclusión correcta es, por tanto, doble: **A y B no producen el mismo número de episodios, pero la composición territorial proporcional de los episodios resultantes es comparativamente estable en las cuatro dimensiones examinadas.**

## Linaje A → B

Como B se obtiene retirando detecciones de A bajo los mismos umbrales, un episodio B no puede fusionar dos episodios A previamente separados; puede conservar parte de uno, desaparecer por quedar con menos de tres miembros o surgir como uno de varios fragmentos robustos de un episodio A.

Resultados:

- 1.987 de los 3.161 episodios A conservan al menos un descendiente robusto B;
- 1.174 episodios A dejan de tener un descendiente B de tres o más detecciones;
- 20 episodios A se fragmentan en más de un episodio B robusto;
- esos 20 episodios originan 41 episodios B.

La mayor parte de la diferencia de conteo proviene, por tanto, de agrupaciones A que pierden robustez al excluir Suomi-NPP, no de una reorganización territorial completamente distinta.

## Persistencia de las relaciones en los episodios A

Para cada episodio A relacionado se verificó si al menos uno de sus descendientes B robustos conservaba esa relación.

| Relación | Episodios A relacionados | Conservan relación en ≥1 descendiente B | Sin descendiente B robusto | Descendiente B existe pero pierde relación | Conservación |
|---|---:|---:|---:|---:|---:|
| RUNAP | 217 | 146 | 69 | 2 | 67,28 % |
| ANM | 683 | 465 | 213 | 5 | 68,08 % |
| ANLA | 1.749 | 1.140 | 607 | 2 | 65,18 % |
| ANH | 1.092 | 695 | 396 | 1 | 63,64 % |

El dato decisivo es la última columna de pérdida condicionada: cuando un episodio A sí mantiene un descendiente B robusto, la relación territorial casi siempre persiste. La mayoría de las relaciones que desaparecen lo hacen porque desaparece el episodio robusto completo, no porque el episodio superviviente cambie de contexto territorial.

## Estabilidad de rankings internos

Los rankings se compararon **dentro de cada dominio**, nunca entre dominios, porque sus reglas espaciales son distintas. Se contaron episodios asociados a cada entidad y se compararon los rangos A/B mediante correlación de Spearman y coincidencia del top 10.

| Dominio | Entidades comunes A/B | Spearman sobre comunes | Spearman sobre unión | Coincidencia top 10 |
|---|---:|---:|---:|---:|
| RUNAP | 52 | 0,8708 | 0,8525 | 8/10 |
| ANM | 319 | 0,8568 | 0,6541 | 8/10 |
| ANLA | 685 | 0,9366 | 0,9072 | 9/10 |
| ANH | 138 | 0,9393 | 0,9143 | 10/10 |

La correlación sobre la unión penaliza entidades que solo aparecen en uno de los dos escenarios; por ello ANM baja a 0,6541. Entre las entidades observadas en ambos escenarios, las cuatro correlaciones son altas (0,8568–0,9393). Los primeros lugares muestran también fuerte persistencia: 8 de 10 en RUNAP y ANM, 9 de 10 en ANLA y 10 de 10 en ANH.

Ejemplos de estabilidad en la cabeza de los rankings:

- RUNAP: el Complejo Cenagoso de Zapatosa ocupa el primer lugar en A y B.
- ANM: el título 144-97 ocupa el primer lugar en A y B; BLOQUE 895 permanece segundo.
- ANLA: LAM2375 y LAM3308 intercambian los dos primeros lugares entre A y B.
- ANH: LA LOMA ADICIONAL permanece primero; los diez contratos del top 10 A también aparecen en el top 10 B, aunque algunos cambian de orden.

Estos rankings expresan frecuencia de coincidencia/proximidad espacial de episodios y **no constituyen evidencia de causalidad, responsabilidad ni origen del fuego**.

## Decisión metodológica

La auditoría respalda mantener la arquitectura ya adoptada:

1. **Escenario B como escenario operacional y público**, por control de calidad instrumental.
2. **Escenario A como sensibilidad y trazabilidad metodológica**, no como una alternativa de interpretación que el usuario deba seleccionar en la interfaz pública.
3. No afirmar que A y B son equivalentes: B reduce 30,31 % de las detecciones y 36,48 % de los episodios.
4. Sí puede afirmarse, con el corte auditado, que las **proporciones territoriales** y la **estructura general de los rankings internos** permanecen relativamente estables después de la exclusión.
5. Conservar la advertencia de que toda relación con RUNAP, ANM, ANLA o ANH es espacial y exploratoria, no causal.

En consecuencia, el selector público A/B puede eliminarse sin ocultar una decisión analítica: la sensibilidad A debe quedar documentada y reproducible en la metodología, mientras la visualización operativa utiliza B.

## Productos reproducibles

- `scripts/analyze_episode_relation_sensitivity.py`.
- `.github/workflows/episode-relation-sensitivity.yml`.
- Artefactos generados por el workflow:
  - `data/episodes/relation_sensitivity_summary.csv`;
  - `data/episodes/relation_sensitivity_rankings.csv`;
  - `data/episodes/relation_sensitivity.json`;
  - `data/metadata/episode_relation_sensitivity_latest_run.json`.

Los archivos de salida se publicaron como artefacto de GitHub Actions y no alteran los productos operacionales del dashboard.

## Validación remota

- Workflow: `Auditar sensibilidad A-B por episodios`.
- Ejecución exitosa: `34180220003`.
- Commit auditado: `2ee90f41454bbc4f7adc851416f094d6bc645884`.
- Artefacto: `episode-relation-sensitivity`, ID `10038630504`.
- SHA-256 del ZIP: `62265f2419ed4d5b82bbc51ce8c397afd60c34b149e7dc6cf999ce03932c52ec`.
- El workflow verificó explícitamente que B reconstruido cerrara contra `episodes_latest_run.json` antes de producir resultados.
