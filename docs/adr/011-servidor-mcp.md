# ADR-011 · Servidor MCP con las mismas herramientas

**Estado:** Aceptado · 2026-11-06

## Contexto
Se quiere que el agente se pueda usar "en otros sitios". Hoy la forma estándar de que un host de IA (Claude Desktop, Claude Code, Cursor u otros agentes) use herramientas externas es **MCP (Model Context Protocol)**. Las herramientas del PRD ya tienen nombre, descripción y esquema zod, que es justo lo que pide MCP.

## Decisión
- SDK oficial `@modelcontextprotocol/sdk` con un `McpServer` que registra **las mismas** herramientas de `src/tools/oc.ts` en un bucle. No hay definiciones paralelas.
- Dos transportes del mismo servidor:
  - **Streamable HTTP** en `/mcp`, montado en el Express del monolito, para el link desplegado.
  - **stdio** con `bun run mcp`, para uso local en Claude Desktop o Claude Code.
- Anotaciones: lectura → `readOnlyHint`; `oc_crear` → `destructiveHint` + `idempotentHint`. Los hosts que respetan anotaciones piden permiso al usuario antes de crear la OC.
- Confirmación: si el host soporta *elicitation*, `oc_crear` pregunta por ahí. Si no, la confirmación debe aprobarse en la web (ADR-012). El argumento `confirmado=true` por sí solo **no basta**.
- Opcional: recurso `oc://conocimiento` y prompt `procesar_solicitud`.
- Si existe `ACCESS_KEY`, `/mcp` exige `Authorization: Bearer`.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Solo el `modulo/` del PRD | Sirve para plataformas que cargan archivos de agente, pero no para hosts que se conectan a un servidor. Se hacen los dos (ADR-014). |
| OpenAPI + plugin propio por plataforma | Una integración distinta por cada host. MCP es el estándar común. |
| Servidor MCP separado del monolito | Otro despliegue y perder la vista en vivo de la web. |

## Consecuencias
- (+) Cualquier host MCP usa el agente sin código extra y **sin gastar la clave** del reto (el razonamiento lo pone el host).
- (+) Las acciones por MCP aparecen en la web en vivo con `canal: mcp`. Esto sirve para la demo: se ejecuta desde Claude Code y la web cambia.
- (−) El LLM del host decide el flujo. Un host podría llamar a `oc_crear` sin pasar por validar. Mitigación: `crear()` revalida todo por dentro y exige confirmación aprobada.
- (−) La API del SDK cambia entre versiones; fijar versión y aislar en `channels/mcp/`.
