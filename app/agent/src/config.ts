import { resolve } from "node:path"
import { z } from "zod"

const EnvSchema = z.object({
  AGENT_PORT: z.coerce.number().int().positive().default(4100),
  BACKEND_URL: z.string().url().default("http://localhost:4000"),
  AGENT_DIR: z.string().default(resolve(import.meta.dir, "..")),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Only for organization-level keys that are not scoped to a workspace. */
  ANTHROPIC_WORKSPACE_ID: z.string().optional(),
  LLM_MODEL: z.string().default("claude-sonnet-5-5"),
  LLM_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  MAX_ITERATIONS: z.coerce.number().int().positive().default(25),
  MAX_SESSION_TOKENS: z.coerce.number().int().positive().default(200_000),
  ACCESS_KEY: z.string().optional(),
})

export type AgentConfig = z.infer<typeof EnvSchema>

export function loadAgentConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  const cleaned = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v]))
  return EnvSchema.parse(cleaned)
}
