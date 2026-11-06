# ADR-002 · Ciclo del agente propio con adaptador LLM

**Estado:** Aceptado · 2026-11-05

## Contexto
El PRD exige: una interfaz propia `enviar(mensajes, herramientas) → respuesta`; que cambiar de proveedor no toque el ciclo; un tope de iteraciones por turno (CA1); un tope de tokens por sesión; y mostrar cada llamada a herramienta.

## Decisión
Escribir el ciclo a mano en `src/agent/loop.ts` sobre una interfaz neutral:

```ts
// src/llm/adapter.ts
export interface LlmAdapter {
  readonly provider: string
  readonly model: string
  enviar(input: {
    system: string
    mensajes: MensajeNeutral[]
    herramientas: HerramientaNeutral[]   // { nombre, descripcion, jsonSchema }
  }): Promise<RespuestaNeutral>          // { texto, llamadas: {id, nombre, args}[], fin: "tool_use"|"end"|"max_tokens", usage, raw }
}
```

El ciclo:
1. Llama `enviar`.
2. Si hay `llamadas`, valida los args con zod, ejecuta cada herramienta y devuelve **todos** los resultados en un solo mensaje.
3. Repite hasta `fin = "end"` o hasta llegar a `MAX_ITERATIONS`.
4. Acumula `usage` en la sesión y corta si supera `MAX_SESSION_TOKENS`.

Los esquemas zod se convierten a JSON Schema con `z.toJSONSchema()` (zod v4) para el proveedor.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Tool Runner del SDK de Anthropic | Amarra el ciclo al SDK de un proveedor; incumple "cambiar de proveedor no toca el ciclo". |
| Claude Agent SDK | Trae herramientas de shell y archivos que el PRD prohíbe y oculta el ciclo que evalúan. |
| LangChain / Vercel AI SDK | Otra capa que hay que justificar y explicar línea por línea en la defensa. |

## Consecuencias
- (+) El ciclo cabe en unas 80 líneas y se puede explicar completo en la defensa.
- (+) Un segundo proveedor solo requiere un archivo nuevo en `src/llm/`.
- (−) Hay que manejar a mano el formato de mensajes del proveedor. Mitigación: `raw` guarda el `content` original de la respuesta y se reenvía tal cual en la siguiente vuelta (lo exige el proveedor para los bloques de thinking).
