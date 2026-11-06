/**
 * MCP over stdio for local hosts (Claude Desktop / Claude Code):
 *   claude mcp add oc-sap -- bun /path/to/repo/app/backend/src/interfaces/mcp/stdio.ts
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createContainer } from "../../bootstrap"
import { createMcpServer } from "./server"

const { service, rootDir } = createContainer()
await createMcpServer(service, rootDir).connect(new StdioServerTransport())
