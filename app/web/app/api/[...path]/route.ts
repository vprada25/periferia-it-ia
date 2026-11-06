import type { HealthView } from "@oc/contracts"
import { hasWebAccess } from "@/lib/auth"
import { serverEnv } from "@/lib/env"
import { forward } from "@/lib/proxy-request"

export const dynamic = "force-dynamic"

const AGENT_ROUTES = new Set(["chat", "sessions"])

/**
 * Single public entry for the browser: /api/chat and /api/sessions/* go to the agent,
 * everything else to the backend. The access key is added here, server side, so it never reaches the client.
 */
async function handle(req: Request, ctx: RouteContext<"/api/[...path]">): Promise<Response> {
  const { path } = await ctx.params
  const [head = ""] = path
  if (head !== "health" && !(await hasWebAccess())) {
    return Response.json({ ok: false, error: "Inicia sesión en la web para usar la API." }, { status: 401 })
  }
  if (head === "health" && req.method === "GET") return health()
  const base = AGENT_ROUTES.has(head) ? serverEnv.agentUrl : serverEnv.backendUrl
  const search = new URL(req.url).search
  return forward(req, `${base}/api/${path.map(encodeURIComponent).join("/")}${search}`, { bearer: serverEnv.accessKey })
}

/** PRD 6.4: GET /api/health → { ok, provider, model } (plus the state of each internal service), never the key. */
async function health(): Promise<Response> {
  const read = async (url: string) => {
    try {
      const response = await fetch(`${url}/api/health`, { cache: "no-store" })
      return response.ok ? ((await response.json()) as HealthView) : null
    } catch {
      return null
    }
  }
  const [backend, agent] = await Promise.all([read(serverEnv.backendUrl), read(serverEnv.agentUrl)])
  const ok = Boolean(backend?.ok && agent?.ok)
  return Response.json(
    {
      ok,
      provider: agent?.provider ?? "unknown",
      model: agent?.model ?? "unknown",
      services: { web: true, backend: Boolean(backend?.ok), agent: Boolean(agent?.ok) },
      channels: backend?.channels ?? [],
    },
    { status: ok ? 200 : 503 },
  )
}

export const GET = handle
export const POST = handle
