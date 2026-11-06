import { randomUUID } from "node:crypto"
import { Role, TaskState, type Artifact, type Message, type Part } from "@a2a-js/sdk"
import { AgentEvent, type AgentExecutor, type ExecutionEventBus, type RequestContext } from "@a2a-js/sdk/server"
import type { OcPort } from "@oc/contracts"
import { GRAMMAR_HELP, parseCommand, runCommand, type CommandOutcome } from "./commands"

const textPart = (value: string): Part => ({ content: { $case: "text", value }, metadata: undefined, filename: "", mediaType: "text/plain" })
const dataPart = (value: unknown): Part => ({ content: { $case: "data", value }, metadata: undefined, filename: "", mediaType: "application/json" })

function agentMessage(ctx: RequestContext, text: string): Message {
  return {
    messageId: randomUUID(),
    contextId: ctx.contextId,
    taskId: ctx.taskId,
    role: Role.ROLE_AGENT,
    parts: [textPart(text)],
    metadata: undefined,
    extensions: [],
    referenceTaskIds: [],
  }
}

function readInput(message: Message): { data?: unknown; text?: string } {
  for (const part of message.parts) {
    if (part.content?.$case === "data") return { data: part.content.value }
  }
  const text = message.parts
    .map((p) => (p.content?.$case === "text" ? p.content.value : ""))
    .join(" ")
    .trim()
  return { text }
}

const STATE: Record<CommandOutcome["kind"], TaskState> = {
  completed: TaskState.TASK_STATE_COMPLETED,
  input_required: TaskState.TASK_STATE_INPUT_REQUIRED,
  rejected: TaskState.TASK_STATE_REJECTED,
}

/** Deterministic OC agent (ADR-010): parses a command, runs it, publishes the task lifecycle. */
export class OcAgentExecutor implements AgentExecutor {
  constructor(
    private readonly oc: OcPort,
    private readonly options: { allowConfirm: boolean },
  ) {}

  async execute(ctx: RequestContext, bus: ExecutionEventBus): Promise<void> {
    const status = (state: TaskState, text: string) => ({ state, message: agentMessage(ctx, text), timestamp: new Date().toISOString() })
    bus.publish(
      AgentEvent.task({
        id: ctx.taskId,
        contextId: ctx.contextId,
        status: status(TaskState.TASK_STATE_WORKING, "Procesando comando."),
        artifacts: [],
        history: [ctx.userMessage],
        metadata: undefined,
      }),
    )

    let outcome: CommandOutcome
    let failed = false
    const command = parseCommand(readInput(ctx.userMessage))
    try {
      outcome = command
        ? await runCommand(this.oc, command, this.options)
        : { kind: "rejected", summary: `Comando no reconocido. ${GRAMMAR_HELP}` }
      await this.oc.recordActivity({
        herramienta: `a2a_${command?.accion ?? "rechazado"}`,
        caso: command?.caso ?? null,
        ok: outcome.kind !== "rejected",
        resumen: outcome.summary.slice(0, 200),
        canal: "a2a",
      })
    } catch (error) {
      failed = true
      outcome = { kind: "rejected", summary: error instanceof Error ? error.message : "Error inesperado." }
    }

    if ("artifacts" in outcome) {
      for (const item of outcome.artifacts) {
        const artifact: Artifact = {
          artifactId: randomUUID(),
          name: item.name,
          description: "",
          parts: [dataPart(item.data)],
          metadata: undefined,
          extensions: [],
        }
        bus.publish(AgentEvent.artifactUpdate({ taskId: ctx.taskId, contextId: ctx.contextId, artifact, append: false, lastChunk: true, metadata: undefined }))
      }
    }
    const finalState = failed ? TaskState.TASK_STATE_FAILED : STATE[outcome.kind]
    bus.publish(AgentEvent.statusUpdate({ taskId: ctx.taskId, contextId: ctx.contextId, status: status(finalState, outcome.summary), metadata: undefined }))
    bus.finished()
  }

  async cancelTask(): Promise<void> {
    // Commands run in milliseconds; there is nothing to cancel.
  }
}
