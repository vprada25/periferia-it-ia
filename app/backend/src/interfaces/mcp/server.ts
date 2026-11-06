import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"
import type { OcPort } from "@oc/contracts"
import { ocTools, type ToolContext, type ToolResult } from "@oc/contracts/tools"

const ANNOTATIONS: Record<string, ToolAnnotations> = {
  oc_leer_paquete: { readOnlyHint: true },
  oc_validar: { readOnlyHint: false, idempotentHint: true },
  oc_generar_evidencia: { idempotentHint: true },
  oc_construir_payload: { idempotentHint: true },
  // Creating a PO is the irreversible action: hosts that honor annotations ask the user first.
  oc_crear: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
}

/**
 * MCP adapter (ADR-011): registers the very same oc_* tools of the PRD contract.
 * Confirmations still have to be approved by the analyst (web or chat); `confirmado` alone is not enough.
 */
export function createMcpServer(oc: OcPort, rootDir: string): McpServer {
  const server = new McpServer({ name: "oc-sap", version: "1.0.0" })
  const ctx: ToolContext = { directory: rootDir, sessionId: "mcp", channel: "mcp", oc }
  for (const tool of ocTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema.shape, annotations: ANNOTATIONS[tool.name] ?? {} },
      async (args: Record<string, unknown>) => {
        const output = await tool.run(args, ctx)
        const parsed = JSON.parse(output) as ToolResult<unknown>
        return { content: [{ type: "text" as const, text: output }], isError: !parsed.ok }
      },
    )
  }
  return server
}
