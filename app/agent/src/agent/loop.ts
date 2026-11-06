import { z } from "zod"
import type { ChatTurn, OcPort } from "@oc/contracts"
import type { RegisteredTool, ToolResult } from "@oc/contracts/tools"
import { LlmError, type LlmAdapter, type LlmToolResult, type LlmToolSpec } from "../llm/adapter"
import { decideScope } from "./scope-guard"
import { readConfirmationIntent, type ChatSession, type VisibleToolCall } from "./session"

export type AgentLimits = { maxIterations: number; maxSessionTokens: number }

export type TurnResult = ChatTurn

export type AgentDeps = {
  llm: LlmAdapter
  tools: RegisteredTool[]
  oc: OcPort
  systemPrompt: string
  limits: AgentLimits
  rootDir: string
}

const LIMIT_NOTE =
  "[Sistema] Se alcanzó el límite de pasos de este turno. No llames más herramientas: responde con lo que ya tienes y lo que falta."

export function toToolSpecs(tools: RegisteredTool[]): LlmToolSpec[] {
  return tools.map((tool) => {
    const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(tool.schema) as Record<string, unknown>
    return { name: tool.name, description: tool.description, inputSchema }
  })
}

function caseOf(args: unknown): string | null {
  const value = (args as { caso?: unknown } | null)?.caso
  return typeof value === "string" ? value : null
}

/**
 * Agent loop (PRD 6.3): model → tools → model, with an iteration cap per turn (CA1),
 * every tool call visible (CA4), confirmations resolved only by the analyst (CA3/ADR-012)
 * and provider errors reported in plain language without killing the session (CA5).
 */
export class AgentLoop {
  private readonly toolSpecs: LlmToolSpec[]

  constructor(private readonly deps: AgentDeps) {
    this.toolSpecs = toToolSpecs(deps.tools)
  }

  async runTurn(session: ChatSession, userText: string): Promise<TurnResult> {
    const now = () => new Date().toISOString()
    session.visible.push({ role: "user", text: userText, ts: now() })

    if (session.tokensUsed >= this.deps.limits.maxSessionTokens) {
      return await this.finish(session, "Esta sesión alcanzó su tope de tokens. Abre una sesión nueva para continuar.", [], 0, 0)
    }

    // Deterministic scope guard (ADR-019): off-topic messages never reach the model.
    const scope = decideScope(userText, session.pendingCases.length > 0)
    if (scope.kind !== "in_scope") {
      await this.deps.oc
        .recordActivity({ herramienta: `guard_${scope.kind}`, caso: null, ok: true, resumen: userText.slice(0, 120), canal: "chat" })
        .catch(() => undefined)
      return await this.finish(session, scope.reply, [], 0, 0)
    }

    const note = await this.resolvePendingConfirmations(session, userText)
    session.history.push({ role: "user", text: note ? `${userText}\n\n${note}` : userText })

    const toolCalls: VisibleToolCall[] = []
    const touchedCases = new Set<string>()
    let inputTokens = 0
    let outputTokens = 0
    let reply = ""

    try {
      for (let iteration = 1; iteration <= this.deps.limits.maxIterations; iteration++) {
        const response = await this.deps.llm.enviar(session.history, this.toolSpecs, { system: this.deps.systemPrompt })
        inputTokens += response.usage.inputTokens
        outputTokens += response.usage.outputTokens
        session.history.push({ role: "assistant", text: response.text, toolCalls: response.toolCalls, raw: response.raw })

        if (response.stop === "refusal") {
          reply = response.text || "El modelo no pudo responder a esta solicitud. Reformúlala, por favor."
          break
        }
        if (response.toolCalls.length === 0) {
          reply = response.text
          break
        }

        const results: LlmToolResult[] = []
        for (const call of response.toolCalls) {
          const tool = this.deps.tools.find((t) => t.name === call.name)
          const output = tool
            ? await tool.run(call.input, { directory: this.deps.rootDir, sessionId: session.id, channel: "chat", oc: this.deps.oc })
            : JSON.stringify({ ok: false, error: `Herramienta desconocida: ${call.name}` })
          const parsed = JSON.parse(output) as ToolResult<unknown>
          const caseId = caseOf(call.input)
          if (caseId) touchedCases.add(caseId)
          toolCalls.push({ name: call.name, args: call.input, ok: parsed.ok, summary: summarize(parsed) })
          results.push({ callId: call.id, content: output, isError: !parsed.ok })
        }
        const lastIteration = iteration === this.deps.limits.maxIterations
        session.history.push({ role: "tool_results", results, ...(lastIteration ? { note: LIMIT_NOTE } : {}) })
        if (lastIteration) {
          const final = await this.deps.llm.enviar(session.history, this.toolSpecs, { system: this.deps.systemPrompt })
          inputTokens += final.usage.inputTokens
          outputTokens += final.usage.outputTokens
          session.history.push({ role: "assistant", text: final.text, toolCalls: [], raw: final.raw })
          reply = final.text || "Llegué al límite de pasos de este turno. Pídeme que continúe."
        }
      }
    } catch (error) {
      const message = error instanceof LlmError ? error.message : "Ocurrió un error inesperado al hablar con el modelo."
      return await this.finish(session, `⚠️ ${message}`, toolCalls, inputTokens, outputTokens, touchedCases)
    }

    return await this.finish(session, reply, toolCalls, inputTokens, outputTokens, touchedCases)
  }

  /** If the last turn left confirmations pending, the analyst's reply resolves them (ADR-012, channel "chat"). */
  private async resolvePendingConfirmations(session: ChatSession, userText: string): Promise<string | null> {
    if (session.pendingCases.length === 0) return null
    const intent = readConfirmationIntent(userText)
    if (intent === "none") return null
    const resolved: string[] = []
    for (const caseId of session.pendingCases) {
      const current = await this.deps.oc.getConfirmation(caseId)
      if (current?.status !== "pending") continue
      await this.deps.oc.confirm(caseId, { approved: intent === "approve", channel: "chat", who: "analista" })
      resolved.push(caseId)
    }
    session.pendingCases = []
    if (resolved.length === 0) return null
    return intent === "approve"
      ? `[Sistema] La analista aprobó la confirmación de: ${resolved.join(", ")}. Ya puedes llamar oc_crear con confirmado=true para esos casos.`
      : `[Sistema] La analista rechazó la confirmación de: ${resolved.join(", ")}. No crees esas OC.`
  }

  private async finish(
    session: ChatSession,
    reply: string,
    toolCalls: VisibleToolCall[],
    inputTokens: number,
    outputTokens: number,
    touchedCases: Set<string> = new Set(),
  ): Promise<TurnResult> {
    session.tokensUsed += inputTokens + outputTokens
    const statuses = await Promise.all(
      [...touchedCases].map(async (c) => ({ c, status: (await this.deps.oc.getConfirmation(c))?.status })),
    )
    session.pendingCases = statuses.filter((s) => s.status === "pending").map((s) => s.c)
    const needsConfirmation = session.pendingCases.length > 0
    session.visible.push({ role: "assistant", text: reply, toolCalls, needsConfirmation, ts: new Date().toISOString() })
    return { reply, toolCalls, needsConfirmation, usage: { inputTokens, outputTokens, sessionTokens: session.tokensUsed } }
  }
}

function summarize(result: ToolResult<unknown>): string {
  const text = result.ok ? JSON.stringify(result.data) : result.error
  return text.length > 200 ? `${text.slice(0, 197)}...` : text
}
