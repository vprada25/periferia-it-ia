import { ChatRequestSchema, type HealthView, type SessionView } from "@oc/contracts"
import { timingSafeEqual } from "node:crypto"
import { createAgentContainer } from "./bootstrap"

const { config, agent, sessions, llm } = await createAgentContainer()

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } })

function authorized(req: Request): boolean {
  if (!config.ACCESS_KEY) return true
  const auth = req.headers.get("authorization")
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : req.headers.get("x-access-key")
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(config.ACCESS_KEY)
  return a.length === b.length && timingSafeEqual(a, b)
}

const denied = () => json({ ok: false, error: "Falta la clave de acceso o no es válida." }, 401)

/** Inbound HTTP adapter of the conversational agent (PRD 6.4: chat, sessions, health). */
const server = Bun.serve({
  port: config.AGENT_PORT,
  idleTimeout: 255, // a turn with several tool calls can take a while
  routes: {
    "/api/health": {
      GET: () => json({ ok: true, service: "agent", provider: llm.provider, model: llm.model } satisfies HealthView),
    },
    "/api/chat": {
      POST: async (req) => {
        if (!authorized(req)) return denied()
        const parsed = ChatRequestSchema.safeParse(await req.json().catch(() => null))
        if (!parsed.success) return json({ ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") }, 400)
        const session = sessions.getOrCreate(parsed.data.sessionId)
        return json(await agent.runTurn(session, parsed.data.message))
      },
    },
    "/api/sessions/:id": {
      GET: (req) => {
        if (!authorized(req)) return denied()
        const session = sessions.get(req.params.id)
        if (!session) return json({ id: req.params.id, messages: [], tokensUsed: 0, pendingCases: [] } satisfies SessionView)
        return json({
          id: session.id,
          messages: session.visible,
          tokensUsed: session.tokensUsed,
          pendingCases: session.pendingCases,
        } satisfies SessionView)
      },
    },
  },
  fetch: () => json({ ok: false, error: "Ruta no encontrada." }, 404),
})

console.log(`[agent] listening on ${server.url} · ${llm.provider}/${llm.model} · backend ${config.BACKEND_URL}`)
