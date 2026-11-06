# ADR-004 · Reglas de control como dominio puro y determinista

**Estado:** Aceptado · 2026-11-05

## Contexto
RC1–RC10 deciden si una OC se crea. El PRD pide que `demo.ts` dé el mismo resultado en cada ejecución, que un cambio de reglas no toque el servidor y que el modelo no pueda "arreglar" montos.

## Decisión
- Toda la lógica vive en `src/domain/` como **funciones puras**: reciben `Paquete` y `Maestros` y devuelven `Finding[]`. No leen disco, no usan la hora actual y no llaman al modelo.
- `reglas.ts` exporta un arreglo `REGLAS: Regla[]`, donde `Regla = (ctx) => Finding[]`. `validar()` las ejecuta todas sin cortocircuito.
- Las herramientas (`src/tools/oc.ts`) son una capa delgada: cargan archivos, llaman al dominio, escriben en `out/` y serializan `{ ok, data }`.
- La lectura de `cotizacion.txt` y `factura.txt` es con expresiones regulares (`NIT:`, `TOTAL`, `Fecha`), no con el modelo.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Que el modelo valide leyendo los maestros | No es determinista, no se puede probar sin clave y contradice "las herramientas son la única fuente de valores". |
| Motor de reglas declarativo (JSON) | Más elegante, pero para 10 reglas es sobreingeniería en 2 horas. Se menciona como evolución. |
| Cortar en el primer bloqueo | La analista tendría que ir y volver varias veces para ver todos los problemas. |

## Consecuencias
- (+) `demo.ts` y las pruebas no necesitan red ni clave.
- (+) Agregar RC11 es una función más en el arreglo.
- (−) Las regex de la cotización dependen del formato de los fixtures. En producción habría plantillas peores. Se registra como riesgo en SOLUCION.md §12.
