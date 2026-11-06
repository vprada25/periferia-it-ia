import type { AgentConfig } from "../config"
import { LlmError, type LlmAdapter } from "./adapter"
import { AnthropicAdapter } from "./anthropic"

/** Adapter used when no API key is configured: the app still runs (web, MCP, A2A); only the chat explains what is missing. */
class UnconfiguredLlm implements LlmAdapter {
  readonly provider = "none"
  constructor(readonly model: string) {}
  async enviar(): Promise<never> {
    throw new LlmError("El chat no tiene clave del modelo configurada (ANTHROPIC_API_KEY).", "not_configured")
  }
}

/** Factory Method: picks the LLM implementation from configuration. */
export function createLlm(config: AgentConfig): LlmAdapter {
  if (!config.ANTHROPIC_API_KEY) return new UnconfiguredLlm(config.LLM_MODEL)
  return new AnthropicAdapter({
    apiKey: config.ANTHROPIC_API_KEY,
    ...(config.ANTHROPIC_WORKSPACE_ID ? { workspaceId: config.ANTHROPIC_WORKSPACE_ID } : {}),
    model: config.LLM_MODEL,
    effort: config.LLM_EFFORT,
    timeoutMs: config.LLM_TIMEOUT_MS,
  })
}
