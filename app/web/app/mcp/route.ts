import { serverEnv } from "@/lib/env"
import { forward } from "@/lib/proxy-request"

export const dynamic = "force-dynamic"

/** Public MCP endpoint: forwarded as-is; external hosts authenticate with their own Bearer key. */
const handle = (req: Request) => forward(req, `${serverEnv.backendUrl}/mcp`)

export const GET = handle
export const POST = handle
export const DELETE = handle
