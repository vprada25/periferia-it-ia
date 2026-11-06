import { CaseIdSchema, type Actor, type OcPort } from "@oc/contracts"
import { z } from "zod"

/**
 * Command: every A2A message becomes one explicit command, or it is rejected.
 * No heuristics and no language model, which is what makes this agent deterministic.
 */

const ACTIONS = ["procesar", "crear", "confirmar", "estado"] as const
export type CommandAction = (typeof ACTIONS)[number]

export const CommandSchema = z.object({
  accion: z.enum(ACTIONS),
  caso: CaseIdSchema.optional(),
  confirmar: z.boolean().optional(),
})
export type Command = z.infer<typeof CommandSchema>

const TEXT_GRAMMAR = /^\s*(procesar|crear|confirmar|rechazar|estado)(?:\s+(sol-\d{3}))?\s*$/i

export const GRAMMAR_HELP =
  'Comandos válidos: DataPart {"accion":"procesar|crear|confirmar|estado","caso":"sol-004","confirmar":true} ' +
  'o texto "procesar sol-004", "crear sol-004", "confirmar sol-004", "rechazar sol-004", "estado [sol-004]".'

/** Parses a DataPart value or a text with the fixed grammar. Returns null when it does not match exactly. */
export function parseCommand(input: { data?: unknown; text?: string }): Command | null {
  if (input.data !== undefined) {
    const parsed = CommandSchema.safeParse(input.data)
    return parsed.success ? parsed.data : null
  }
  const match = input.text?.match(TEXT_GRAMMAR)
  if (!match?.[1]) return null
  const verb = match[1].toLowerCase()
  const caso = match[2]?.toLowerCase()
  if (verb === "rechazar") return { accion: "confirmar", caso, confirmar: false }
  if (verb === "confirmar") return { accion: "confirmar", caso, confirmar: true }
  return { accion: verb as CommandAction, caso }
}

export type CommandOutcome =
  | { kind: "completed"; summary: string; artifacts: { name: string; data: unknown }[] }
  | { kind: "input_required"; summary: string; artifacts: { name: string; data: unknown }[] }
  | { kind: "rejected"; summary: string }

const ACTOR: Actor = { channel: "a2a", who: "agente-a2a" }

/** Executes a parsed command against the use cases. */
export async function runCommand(
  oc: OcPort,
  command: Command,
  options: { allowConfirm: boolean },
): Promise<CommandOutcome> {
  if (command.accion === "estado") {
    const data = command.caso ? (await oc.caseDetail(command.caso)).summary : await oc.listCases()
    return { kind: "completed", summary: "Estado consultado.", artifacts: [{ name: "estado", data }] }
  }
  if (!command.caso) return { kind: "rejected", summary: `Falta el caso. ${GRAMMAR_HELP}` }
  const caso = command.caso

  if (command.accion === "procesar") {
    const result = await oc.process(caso, ACTOR)
    const artifacts = [{ name: "resultado-validacion", data: result.validacion }, ...(result.payload ? [{ name: "payload-oc", data: result.payload.orden }] : [])]
    if (!result.validacion.apta) {
      return { kind: "completed", summary: `${caso} bloqueado: ${result.validacion.bloqueos.map((b) => b.code).join(", ")}.`, artifacts }
    }
    if (result.status === "awaiting_confirmation") {
      return { kind: "input_required", summary: confirmationText(caso, result.validacion.confirmaciones.map((c) => c.detail)), artifacts }
    }
    return { kind: "completed", summary: `${caso} listo para crear la OC.`, artifacts }
  }

  if (command.accion === "confirmar") {
    if (!options.allowConfirm) {
      return { kind: "rejected", summary: "Este agente no puede aprobar confirmaciones (A2A_ALLOW_CONFIRM=false). La analista debe aprobarlas en la web." }
    }
    const confirmation = await oc.confirm(caso, { approved: command.confirmar !== false, ...ACTOR })
    return { kind: "completed", summary: `Confirmación de ${caso}: ${confirmation.status}.`, artifacts: [{ name: "confirmacion", data: confirmation }] }
  }

  const outcome = await oc.create(caso, { confirmed: true, ...ACTOR })
  switch (outcome.status) {
    case "created":
    case "idempotent":
      return {
        kind: "completed",
        summary: `OC ${outcome.numero_oc}${outcome.status === "idempotent" ? " (ya existía)" : ""} para ${caso}.`,
        artifacts: [{ name: "orden-creada", data: { numero_oc: outcome.numero_oc, fecha: outcome.fecha, idempotente: outcome.status === "idempotent" } }],
      }
    case "needs_confirmation":
      return { kind: "input_required", summary: confirmationText(caso, outcome.findings.map((f) => f.detail)), artifacts: [] }
    case "blocked":
      return { kind: "completed", summary: `${caso} bloqueado: ${outcome.findings.map((f) => f.code).join(", ")}.`, artifacts: [{ name: "bloqueos", data: outcome.findings }] }
    case "rejected":
      return { kind: "completed", summary: outcome.reason, artifacts: [] }
  }
}

function confirmationText(caso: string, details: string[]): string {
  return `${caso} requiere confirmación humana: ${details.join(" | ")} Apruébala en la web y luego envía "crear ${caso}".`
}
