# ADR-010 · Agente OC determinista expuesto por A2A

**Estado:** Aceptado · 2026-11-06

## Contexto
Se quiere usar el protocolo **A2A (Agent2Agent)** y que el agente sea **determinista**, de modo que otros agentes puedan delegarle la preparación y creación de OC en las siguientes etapas. Un LLM no es determinista: con la misma entrada puede elegir caminos distintos.

## Decisión
Separar dos agentes con responsabilidades distintas:

| | Agente OC | Asistente conversacional |
|---|---|---|
| Qué es | Agente A2A **sin LLM** | Agente con LLM (Claude) |
| Para quién | Otros agentes y sistemas | La analista, en lenguaje natural |
| Entrada | Comando estructurado (`DataPart` o texto con gramática fija) | Texto libre |
| Determinista | **Sí**: misma entrada, mismo resultado | No, pero no puede alterar resultados (ADR-005/012) |
| Usa la clave del modelo | No | Sí |

Detalles del Agente OC:
- SDK `@a2a-js/sdk`, JSON-RPC 2.0 en `/a2a`, Agent Card en `/.well-known/agent-card.json`.
- 3 skills: `procesar-solicitud`, `crear-orden` y `consultar-estado` (SPEC §11).
- Se apoya en los estados de tarea de A2A: `completed` con artifacts; **`input-required`** cuando hay confirmación pendiente (calza con la confirmación humana del PRD); `rejected` para comandos inválidos; `failed` para errores.
- Comando no reconocido → `rejected` con la gramática válida. **Nunca interpreta con heurísticas.**
- El ejecutor llama a `OcService`, igual que los demás canales.

**¿El asistente conversacional habla con el Agente OC por A2A?** Hoy no. Sus herramientas llaman a `OcService` en proceso. Hacerlo por HTTP dentro del mismo proceso agrega latencia y fallas sin beneficio, y el PRD exige que `demo.ts` importe las herramientas sin servidor. El puerto `OcPort` (ADR-008) deja preparado el cambio: cuando el Agente OC viva aparte, las herramientas usarán un `A2aOcPort`.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Exponer por A2A el agente con LLM | Otro agente recibiría respuestas no deterministas en texto libre y cada llamada gastaría la clave. |
| Agente A2A que interpreta texto libre con regex flexibles | Sería "casi determinista": ambigüedades silenciosas. Mejor rechazar con ayuda. |
| Exponer los casos de uso como API REST propia | Funciona, pero cada agente integrador tendría que aprender un contrato a medida. A2A da descubrimiento (Agent Card) y ciclo de tareas estándar. |

## Consecuencias
- (+) Otros agentes obtienen resultados reproducibles; `scripts/a2a-client.ts` lo prueba contra la misma tabla que `demo.ts`.
- (+) La confirmación humana tiene un estado estándar (`input-required`) en vez de una convención propia.
- (+) Costo cero de modelo para integraciones agente a agente.
- (−) Un dependiente más (`@a2a-js/sdk`) cuya API puede cambiar entre versiones. Mitigación: fijar versión y aislarla en `channels/a2a/`.
- (−) Sin streaming ni push notifications en esta etapa; las tareas son cortas (milisegundos).
