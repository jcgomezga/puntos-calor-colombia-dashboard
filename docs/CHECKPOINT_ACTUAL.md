# Checkpoint actual

- Fecha: 1 de septiembre de 2026.
- Versión: 0.2.0.
- Fases cerradas: 0, 1 y 2.
- Estado técnico: lint correcto, build Vinext correcto, exportación estática correcta, 6/6 pruebas Python y 6/6 pruebas de interfaz aprobadas.
- Estado de datos: histórico oficial IDEAM ingerido y normalizado; todavía no territorializado ni conectado a la interfaz.
- Periodo almacenado: `2026-07-01` a `2026-08-31`, hora de Colombia.
- Volumen: 62 archivos diarios y 30.890 detecciones únicas.
- Escenarios: A = 30.890; B sin Suomi-NPP = 21.606.
- Repositorio remoto: `https://github.com/jcgomezga/puntos-calor-colombia-dashboard`.
- URL pública: `https://jcgomezga.github.io/puntos-calor-colombia-dashboard/`.
- Workflow de ingesta verificado: `33459561062`.
- Checkpoint remoto del histórico: `730e232665d5fdb9ce9b0850725cdc58375aec5d`.
- Cierre documental de la Fase 2: `7ffb0451c9d403e987210555513591db1fbdd24e`.
- Automatización: `refresh` cada tres horas; reconsulta el día actual y los dos anteriores.
- Seguridad de fuente: verificación TLS estricta; el intermedio faltante se obtiene desde AIA y se valida contra las raíces del sistema.
- Próxima fase: unión espacial DANE, controles territoriales e integración de datos oficiales en el dashboard.
