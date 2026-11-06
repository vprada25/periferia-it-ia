/** Server-side configuration of the web process. Never imported by client components. */
export const serverEnv = {
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:4000",
  agentUrl: process.env.AGENT_URL ?? "http://localhost:4100",
  accessKey: process.env.ACCESS_KEY || undefined,
  embedOrigins: (process.env.EMBED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const

export const ACCESS_COOKIE = "oc_access"
