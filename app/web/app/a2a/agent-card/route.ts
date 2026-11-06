import { serverEnv } from "@/lib/env"
import { forward } from "@/lib/proxy-request"

export const dynamic = "force-dynamic"

/** Served at /.well-known/agent-card.json through a rewrite (next.config.ts). */
export const GET = (req: Request) => forward(req, `${serverEnv.backendUrl}/.well-known/agent-card.json`)
