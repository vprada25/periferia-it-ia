import { z } from "zod"
import { CaseIdSchema } from "../case-ids"
import { fail, ok, registerTools, type ToolDefinition } from "./registry"

/*
 * PRD tool contract (section 6.2), shared by the agent (OcPort over HTTP) and the MCP server
 * (OcPort in process): one definition, two transports. Each export becomes `oc_<export>`. Tool names and
 * argument names (`caso`, `confirmado`) are part of the PRD contract.
 *
 * Deliberate deviation (SPEC §3, ADR-005): tools receive only `caso` and recompute everything
 * from the source files, so the model can never alter amounts between calls.
 */

const caso = CaseIdSchema.describe("Nombre de la carpeta del caso en fixtures/reto-03/solicitudes/, por ejemplo sol-004")

export const leer_paquete = {
  description: "Lee y normaliza el paquete de un caso: correo, solicitud, cotización, aprobación y factura.",
  args: { caso },
  async execute(args, ctx) {
    return ok(await ctx.oc.readPackage(args.caso))
  },
} satisfies ToolDefinition<{ caso: typeof caso }>

export const validar = {
  description: "Aplica los controles RC1–RC10 al caso y devuelve si es apto, bloqueos, confirmaciones, derivados y si es retroactivo.",
  args: { caso },
  async execute(args, ctx) {
    const { status, ...result } = await ctx.oc.validate(args.caso, { channel: ctx.channel })
    return ok({ ...result, estado: status })
  },
} satisfies ToolDefinition<{ caso: typeof caso }>

export const generar_evidencia = {
  description: "Genera out/<caso>/aprobacion.txt con el correo de aprobación y su sha256 como evidencia para la OC.",
  args: { caso },
  async execute(args, ctx) {
    return ok(await ctx.oc.generateEvidence(args.caso))
  },
} satisfies ToolDefinition<{ caso: typeof caso }>

export const construir_payload = {
  description: "Construye la orden de compra tal como quedaría en SAP, validada con su esquema, y guarda su trazabilidad.",
  args: { caso },
  async execute(args, ctx) {
    const { trazabilidad, ...payload } = await ctx.oc.buildPayload(args.caso)
    return ok({ ...payload, campos_trazados: Object.keys(trazabilidad).length })
  },
} satisfies ToolDefinition<{ caso: typeof caso }>

const confirmado = z
  .boolean()
  .optional()
  .describe("true solo si la analista confirmó explícitamente en su último mensaje; nunca lo asumas")

export const crear = {
  description: "Crea la OC en el SAP simulado si el caso es apto y sus confirmaciones fueron aprobadas por la analista.",
  args: { caso, confirmado },
  async execute(args, ctx) {
    const outcome = await ctx.oc.create(args.caso, { confirmed: args.confirmado === true, channel: ctx.channel })
    switch (outcome.status) {
      case "created":
      case "idempotent":
        return ok({ numero_oc: outcome.numero_oc, fecha: outcome.fecha, idempotente: outcome.status === "idempotent" })
      case "blocked":
        return fail(`bloqueada: ${outcome.findings.map((f) => `${f.rule} ${f.code}: ${f.detail}`).join(" | ")}`)
      case "needs_confirmation":
        return fail(`requiere confirmación: ${outcome.reason} Hallazgos: ${outcome.findings.map((f) => f.detail).join(" | ")}`)
      case "rejected":
        return fail(outcome.reason)
    }
  },
} satisfies ToolDefinition<{ caso: typeof caso; confirmado: typeof confirmado }>

/** The five PRD tools, decorated and named `oc_*`. */
export const ocTools = registerTools("oc", { leer_paquete, validar, generar_evidencia, construir_payload, crear } as Record<
  string,
  ToolDefinition<z.ZodRawShape>
>)
