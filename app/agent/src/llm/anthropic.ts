import Anthropic from "@anthropic-ai/sdk"
import type { BetaContentBlock, BetaMessageParam, BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages"
import {
  LlmError,
  type LlmAdapter,
  type LlmMessage,
  type LlmOptions,
  type LlmResponse,
  type LlmStopReason,
  type LlmToolSpec,
} from "./adapter"

export type AnthropicConfig = {
  apiKey: string
  workspaceId?: string
  model: string
  effort: "low" | "medium" | "high"
  timeoutMs: number
}

const MAX_OUTPUT_TOKENS = 16_000
const FALLBACK_BETA = "server-side-fallback-2026-07-01"

/** Adapter for Claude through the official SDK. Only this file knows the Anthropic message format. */
export class AnthropicAdapter implements LlmAdapter {
  readonly provider = "anthropic"
  readonly model: string
  private readonly client: Anthropic

  constructor(private readonly config: AnthropicConfig) {
    this.model = config.model
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: 2,
      ...(config.workspaceId ? { defaultHeaders: { "anthropic-workspace-id": config.workspaceId } } : {}),
    })
  }

  async enviar(mensajes: LlmMessage[], herramientas: LlmToolSpec[], opciones: LlmOptions): Promise<LlmResponse> {
    try {
      const response = await this.client.beta.messages.create({
        model: this.config.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Stable prefix (system + tools) is cached; it repeats on every loop iteration.
        system: [{ type: "text", text: opciones.system, cache_control: { type: "ephemeral" } }],
        tools: herramientas.map(toTool),
        messages: mensajes.map(toMessageParam),
        output_config: { effort: this.config.effort },
        // On a policy decline the API retries on the model's default fallback inside the same call.
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      })
      const toolCalls = response.content
        .filter((b): b is Extract<BetaContentBlock, { type: "tool_use" }> => b.type === "tool_use")
        .map((b) => ({ id: b.id, name: b.name, input: b.input }))
      const text = response.content
        .filter((b): b is Extract<BetaContentBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim()
      return {
        text,
        toolCalls,
        stop: mapStop(response.stop_reason, toolCalls.length),
        usage: { inputTokens: totalInput(response.usage), outputTokens: response.usage.output_tokens },
        raw: response.content,
      }
    } catch (error) {
      throw toLlmError(error)
    }
  }
}

function toTool(spec: LlmToolSpec): BetaTool {
  return { name: spec.name, description: spec.description, input_schema: spec.inputSchema as BetaTool["input_schema"] }
}

function toMessageParam(message: LlmMessage): BetaMessageParam {
  switch (message.role) {
    case "user":
      return { role: "user", content: message.text }
    case "assistant":
      // Replay the original content unchanged (thinking blocks must not be edited).
      return { role: "assistant", content: message.raw as BetaContentBlock[] }
    case "tool_results":
      return {
        role: "user",
        content: [
          ...message.results.map((r) => ({
            type: "tool_result" as const,
            tool_use_id: r.callId,
            content: r.content,
            is_error: r.isError,
          })),
          ...(message.note ? [{ type: "text" as const, text: message.note }] : []),
        ],
      }
  }
}

function mapStop(reason: string | null, toolCalls: number): LlmStopReason {
  if (reason === "refusal") return "refusal"
  if (reason === "max_tokens") return "max_tokens"
  return toolCalls > 0 ? "tool_use" : "end"
}

function totalInput(usage: { input_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
  return usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
}

function toLlmError(error: unknown): LlmError {
  if (error instanceof Anthropic.AuthenticationError) return new LlmError("La clave del modelo no es válida.", "auth")
  if (error instanceof Anthropic.RateLimitError) {
    return new LlmError("El proveedor del modelo está limitando las peticiones. Intenta de nuevo en un minuto.", "rate_limit")
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new LlmError("El modelo tardó demasiado en responder. Intenta de nuevo.", "timeout")
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new LlmError(`El proveedor rechazó la petición: ${error.message}`, "bad_request")
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmError("El servicio del modelo no está disponible en este momento.", "unavailable")
  }
  return new LlmError("No fue posible comunicarse con el modelo.", "unavailable")
}
