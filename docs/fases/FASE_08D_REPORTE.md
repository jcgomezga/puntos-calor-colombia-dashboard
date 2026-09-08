# Fase 8D · Portal público centrado en detecciones térmicas

## Decisión

La interfaz pública vuelve a utilizar la **detección térmica individual** como unidad principal de exploración. La agrupación por episodios y la sensibilidad instrumental permanecen en los productos analíticos, scripts y documentación, pero dejan de exponerse como decisiones operativas del visitante del portal.

## Alcance

- El universo público conserva el conjunto operacional ya adoptado por control de calidad instrumental; la interfaz no expone escenarios A/B.
- El geovisor representa las detecciones IDEAM mediante agrupación visual por zoom (clusters) y puntos individuales al acercarse.
- Los filtros RUNAP, ANM, ANLA y ANH vuelven a evaluarse directamente sobre cada detección.
- La ficha de una detección incluye fecha, sensor, FRP, confianza y su relación espacial con RUNAP, ANM, ANLA y ANH.
- Las fichas completas de RUNAP/ANM/ANLA/ANH siguen cargándose bajo demanda desde los fragmentos del catálogo territorial.
- Al activar una capa de contexto, el modo de consulta cambia automáticamente a `Contexto` y solo consulta capas actualmente visibles.
- Coberturas IDEAM 2024 y límites/etiquetas DANE se conservan.

## Interpretación

Una detección térmica satelital no confirma por sí sola un incendio, su extensión ni su causa. Los cruces con capas territoriales representan coincidencia o proximidad espacial y no establecen causalidad.

## Continuidad analítica

Los episodios operacionales, el algoritmo 1 km + 24 h + mínimo 3 detecciones, el análisis de sensibilidad A/B y sus productos no se eliminan del repositorio. Se reservan para una futura sección de **Análisis detallado**.
