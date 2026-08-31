# Adenda de alcance — corte histórico

**Fecha:** 31 de agosto de 2026  
**Versión:** 0.1.1  
**Estado:** regla aprobada y preparada para la Fase 2

## Decisión

El dashboard nacional conservará históricos únicamente desde el 1 de julio de 2026. El corte es inclusivo y se interpreta en la zona horaria `America/Bogota`.

## Implementación realizada

- regla centralizada en `config/data-policy.json`;
- fecha inicial visible en la interfaz;
- alcance, metodología y diccionario actualizados;
- prueba automatizada para impedir que el corte cambie de forma accidental;
- obligación explícita para la futura ingesta de descartar datos anteriores antes de escribir salidas.

## Controles ejecutados

| Control | Resultado |
|---|---|
| Calidad estática | Correcto |
| Exportación para GitHub Pages | Correcta |
| Compilación de producción | Correcta |
| Pruebas automatizadas | 6 aprobadas, 0 fallidas |
| Fecha visible en HTML generado | Correcta |

## Comportamiento exigido a la Fase 2

1. El descubrimiento retrospectivo comienza en `2026-07-01`.
2. Ningún CSV diario anterior se incorpora al archivo bruto.
3. Las filas anteriores mezcladas en un archivo se rechazan antes del almacenamiento.
4. La bitácora registra el número de rechazos, no copia sus observaciones.
5. El histórico válido se acumula desde el corte y alimenta todas las estadísticas.

## Riesgo pendiente

El crecimiento futuro del repositorio requerirá evaluar compresión mensual o almacenamiento más eficiente, sin reducir el periodo aprobado.
