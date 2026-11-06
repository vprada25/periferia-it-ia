import { serverEnv } from "@/lib/env"
import { forward } from "@/lib/proxy-request"

export const dynamic = "force-dynamic"

/** Public A2A JSON-RPC endpoint of the deterministic OC agent. */
export const POST = (req: Request) => forward(req, `${serverEnv.backendUrl}/a2a`)
