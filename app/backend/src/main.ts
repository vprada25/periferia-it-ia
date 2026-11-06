import { createContainer } from "./bootstrap"
import { createA2aHandlers } from "./interfaces/a2a/server"
import { createApiRoutes } from "./interfaces/http/api"
import { isAuthorized } from "./interfaces/http/auth"
import { errorResponse, json } from "./interfaces/http/responses"
import { createMcpHttpHandler } from "./interfaces/mcp/http"

const { config, rootDir, service, events } = createContainer()
const channels = ["http", "sse", "mcp", "a2a"]
const a2a = createA2aHandlers(service, {
  publicUrl: config.PUBLIC_URL,
  allowConfirm: config.A2A_ALLOW_CONFIRM,
  protectedByKey: Boolean(config.ACCESS_KEY),
})
const mcp = createMcpHttpHandler(service, rootDir)

type Handler = (req: Request) => Promise<Response> | Response

/** Wraps a handler with the optional access-key check (health and agent card stay public for discovery). */
const guard =
  (handler: Handler): Handler =>
  (req) =>
    isAuthorized(req, config.ACCESS_KEY) ? handler(req) : errorResponse("Falta la clave de acceso o no es válida.", 401)

const apiRoutes = Object.fromEntries(
  Object.entries(createApiRoutes(service, events, channels)).map(([path, methods]) => [
    path,
    Object.fromEntries(
      Object.entries(methods).map(([method, handler]) => [
        method,
        path === "/api/health" ? handler : guard(handler as Handler),
      ]),
    ),
  ]),
)

const server = Bun.serve({
  port: config.BACKEND_PORT,
  idleTimeout: 0, // SSE connections stay open
  routes: {
    ...apiRoutes,
    "/mcp": { GET: guard(mcp), POST: guard(mcp), DELETE: guard(mcp) },
    "/a2a": { POST: guard(a2a.rpc) },
    "/.well-known/agent-card.json": { GET: a2a.card },
  },
  fetch: () => json({ ok: false, error: "Ruta no encontrada." }, 404),
})

console.log(`[backend] listening on ${server.url} · channels: ${channels.join(", ")}`)
