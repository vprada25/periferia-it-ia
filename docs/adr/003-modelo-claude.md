# ADR-003 · Proveedor y modelo: Anthropic Claude (Sonnet 5.5 en desarrollo, Opus 5.5 en defensa)

**Estado:** Aceptado · 2026-11-05

## Contexto
El agente debe seguir un flujo fijo de 5 herramientas, respetar confirmaciones y no inventar valores. La SOLUCION.md pide el costo estimado por caso. La clave solo puede vivir en variables de entorno del backend.

## Decisión
- Proveedor: **Anthropic**, SDK oficial `@anthropic-ai/sdk`.
- Modelo por defecto: **`claude-sonnet-5-5`** (USD 2/10 por MTok), configurable con `LLM_MODEL`. Presupuesto del reto: USD 5 de crédito prepago. Se desarrolla con Sonnet y, si al llegar a la defensa quedan más de USD 2, se cambia a **`claude-opus-5-5`** (USD 4/20) solo con la variable de entorno.
- `output_config.effort: "low"` por defecto (`LLM_EFFORT`). El trabajo pesado lo hacen las herramientas; el modelo solo orquesta y redacta.
- `tool_choice: auto` (este modelo no acepta forzar herramienta) y `strict: true` en cada herramienta para que los args siempre cumplan el esquema.
- Timeout de 60 s y `maxRetries: 2` en el cliente. Los errores se mapean a mensajes claros (CA5).
- El `content` de cada respuesta se reenvía completo (incluidos los bloques de thinking), sin editar el historial.

## Costo estimado por caso
| Supuesto | Valor |
|---|---|
| Vueltas al modelo por caso | ~6 (5 herramientas + respuesta final) |
| Tokens de entrada por vuelta | ~5.000 (prompt + conocimiento + historial creciente) |
| Tokens de salida totales | ~2.500 |
| **Sonnet 5.5** | 30.000 × 2/1M + 2.500 × 10/1M ≈ **USD 0,085 por caso** |
| **Opus 5.5** | 30.000 × 4/1M + 2.500 × 20/1M ≈ **USD 0,17 por caso** |

La caché de prompt sobre el system + herramientas baja estos valores. Se mide en la primera prueba con `usage` y el valor real se reporta en SOLUCION.md §4.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Opus 5.5 como modelo de desarrollo | Duplica el costo; con USD 5 de presupuesto no alcanzan las pruebas más la defensa. Se reserva para la defensa. |
| `claude-haiku-5-5` | Más barato aún, pero con más riesgo de saltarse una confirmación en la demo en vivo. |
| OpenAI / Gemini | Sin ventaja para el caso; el adaptador permite agregarlos después. |

## Consecuencias
- (+) Buen seguimiento de instrucciones en flujos con confirmación.
- (−) Costo por caso más alto que modelos pequeños. Mitigación: `effort: low`, caché y tope de tokens por sesión.
- (−) Dependencia de un proveedor externo en la demo. Mitigación: `demo.ts` prueba toda la lógica sin modelo.
