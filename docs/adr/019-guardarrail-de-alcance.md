# ADR-019 · Guardarraíl de alcance determinista antes del modelo

**Estado:** Aceptado · 2026-11-06

## Contexto
Al preguntarle a Hermes "¿cuánto es 2 más 2?", respondía. El agente debe responder **solo** sobre aquello para lo que fue diseñado (órdenes de compra), y hacerlo de forma predecible. Un LLM no se vuelve determinista con instrucciones: la misma pregunta fuera de tema puede contestarse una vez y rechazarse la siguiente. Además, cada respuesta de este tipo gasta la clave.

## Decisión
La decisión de **qué** responde el agente se toma en código, antes de llamar al modelo (`app/agent/src/agent/scope-guard.ts`):

| Decisión | Cuándo | Respuesta | ¿Llama al modelo? |
|---|---|---|---|
| `in_scope` | El mensaje usa vocabulario del dominio (sol-00X, OC, solicitud, proveedor, cotización, RC1–RC10, confirmación…), o hay una confirmación pendiente y la respuesta es corta ("sí", "confirmo") | El ciclo normal del agente | Sí |
| `introduction` | Saludo o "¿quién eres? / ¿qué puedes hacer?" | Presentación fija de Hermes con sus capacidades | No |
| `out_of_scope` | Todo lo demás | Texto fijo: solo ayuda con órdenes de compra | No |

- Las frases de presentación, capacidades y fuera de alcance viven en `AGENT_PROFILE` (`app/contracts`). La web usa las mismas para la animación de la barra, así que el saludo y lo que el agente dice que puede hacer nunca divergen.
- Cada decisión del guardarraíl queda en `out/log.jsonl` (`guard_out_of_scope`, `guard_introduction`) para auditoría.
- Segunda capa: el prompt prohíbe responder la parte ajena de un mensaje mixto (por ejemplo, "cuánto es 2 + 2 en la OC de sol-001").
- `app/agent/tests/scope-guard.test.ts` cubre casos dentro y fuera de alcance, saludos, confirmaciones cortas y el determinismo (50 corridas, misma decisión).

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Solo instrucciones en el prompt | No es determinista y sigue gastando tokens en cada pregunta fuera de tema. |
| Clasificar el mensaje con otra llamada al modelo | Más costo y latencia, y otra vez no determinista. |
| Lista blanca de comandos exactos | Demasiado rígida para un chat: la analista escribe en lenguaje natural. |

## Consecuencias
- (+) Mismo mensaje, misma decisión, siempre; costo cero para lo que no es del dominio.
- (+) La demo puede mostrar en vivo que el agente se niega a salirse de su función.
- (−) Una pregunta legítima que no use ninguna palabra del dominio se rechazará; el mensaje de rechazo sugiere cómo reformularla. El vocabulario se amplía en un solo archivo.
- (−) El guardarraíl decide el *tema*, no la *calidad* de la respuesta del modelo dentro del tema; para eso siguen las herramientas como única fuente de valores (ADR-005).
