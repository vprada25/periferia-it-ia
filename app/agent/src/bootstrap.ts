import { resolve } from "node:path"
import type { OcPort } from "@oc/contracts"
import { ocTools } from "./tools/oc"
import { AgentLoop } from "./agent/loop"
import { SessionStore } from "./agent/session"
import { loadSystemPrompt } from "./agent/system-prompt"
import { loadAgentConfig, type AgentConfig } from "./config"
import type { LlmAdapter } from "./llm/adapter"
import { createLlm } from "./llm/factory"
import { OcHttpClient } from "./oc-http-client"

export type AgentContainer = { config: AgentConfig; agent: AgentLoop; sessions: SessionStore; llm: LlmAdapter; oc: OcPort }

/** Composition root of the agent: the OcPort implementation is injected (HTTP in production). */
export async function createAgentContainer(options: { config?: AgentConfig; oc?: OcPort } = {}): Promise<AgentContainer> {
  const config = options.config ?? loadAgentConfig()
  const oc = options.oc ?? new OcHttpClient(config.BACKEND_URL, config.ACCESS_KEY)
  const llm = createLlm(config)
  const agent = new AgentLoop({
    llm,
    tools: ocTools,
    oc,
    systemPrompt: await loadSystemPrompt(config.AGENT_DIR),
    limits: { maxIterations: config.MAX_ITERATIONS, maxSessionTokens: config.MAX_SESSION_TOKENS },
    // PRD 6.2: ctx.directory is the project root.
    rootDir: resolve(config.AGENT_DIR, "../.."),
  })
  return { config, agent, sessions: new SessionStore(), llm, oc }
}
