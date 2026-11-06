/**
 * PRD 6.5 location of the tools. The definitions live in @oc/contracts/tools so the
 * agent and the MCP server share exactly the same contract (ADR-011).
 */
export { ocTools, leer_paquete, validar, generar_evidencia, construir_payload, crear } from "@oc/contracts/tools"
export type { RegisteredTool, ToolContext, ToolDefinition, ToolResult } from "@oc/contracts/tools"
