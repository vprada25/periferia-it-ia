/*
 * Provider-neutral LLM port (PRD 6.1: `enviar(mensajes, herramientas) → respuesta`).
 * The method keeps the PRD name; everything else is English. Changing provider means
 * writing another implementation of this interface; the agent loop does not change.
 */

export type LlmToolSpec = { name: string; description: string; inputSchema: Record<string, unknown> }

export type LlmToolCall = { id: string; name: string; input: unknown }

export type LlmToolResult = { callId: string; content: string; isError: boolean }

export type LlmMessage =
  | { role: "user"; text: string }
  /** `raw` keeps the provider's original content (e.g. thinking blocks) so it can be replayed unchanged. */
  | { role: "assistant"; text: string; toolCalls: LlmToolCall[]; raw: unknown }
  | { role: "tool_results"; results: LlmToolResult[]; note?: string }

export type LlmStopReason = "tool_use" | "end" | "max_tokens" | "refusal"

export type LlmResponse = {
  text: string
  toolCalls: LlmToolCall[]
  stop: LlmStopReason
  usage: { inputTokens: number; outputTokens: number }
  raw: unknown
}

export type LlmOptions = { system: string }

/** Errors surfaced to the chat in plain language (CA5). */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "rate_limit" | "timeout" | "unavailable" | "bad_request" | "not_configured",
  ) {
    super(message)
  }
}

export interface LlmAdapter {
  readonly provider: string
  readonly model: string
  enviar(mensajes: LlmMessage[], herramientas: LlmToolSpec[], opciones: LlmOptions): Promise<LlmResponse>
}
