import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { OcPort } from "@oc/contracts"
import { createMcpServer } from "./server"

/** Streamable HTTP transport in stateless mode: one server + transport per request (Request → Response). */
export function createMcpHttpHandler(oc: OcPort, rootDir: string) {
  return async (req: Request): Promise<Response> => {
    const server = createMcpServer(oc, rootDir)
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    const response = await transport.handleRequest(req)
    void server.close()
    return response
  }
}
