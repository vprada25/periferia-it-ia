import { z } from "zod"
import type { OcPort } from "../oc-port"
import type { Channel } from "../records"

/** Context received by every tool (PRD 6.2) plus the channel and use cases injected by the composition root. */
export type ToolContext = {
  directory: string
  sessionId: string
  channel: Channel
  oc: OcPort
}

/** Tool shape mandated by the PRD: description, zod args and execute() returning a JSON string. */
export type ToolDefinition<Shape extends z.ZodRawShape> = {
  description: string
  args: Shape
  execute(args: z.infer<z.ZodObject<Shape>>, ctx: ToolContext): Promise<string>
}

export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const ok = <T>(data: T): string => JSON.stringify({ ok: true, data } satisfies ToolResult<T>)
export const fail = (error: string): string => JSON.stringify({ ok: false, error } satisfies ToolResult<never>)

export type RegisteredTool = {
  name: string
  description: string
  schema: z.ZodObject<z.ZodRawShape>
  /** Validates, executes, logs and never throws. */
  run(rawArgs: unknown, ctx: ToolContext): Promise<string>
}

function summarize(result: string): string {
  try {
    const parsed = JSON.parse(result) as ToolResult<unknown>
    const text = parsed.ok ? JSON.stringify(parsed.data) : parsed.error
    return text.length > 200 ? `${text.slice(0, 197)}...` : text
  } catch {
    return result.slice(0, 200)
  }
}

/**
 * Decorator: wraps a PRD tool with argument validation, error capture (tools never throw)
 * and activity logging, without repeating that code in every tool.
 */
export function decorateTool<Shape extends z.ZodRawShape>(name: string, tool: ToolDefinition<Shape>): RegisteredTool {
  const schema = z.object(tool.args)
  return {
    name,
    description: tool.description,
    schema: schema as unknown as z.ZodObject<z.ZodRawShape>,
    async run(rawArgs, ctx) {
      const parsed = schema.safeParse(rawArgs ?? {})
      const caseId = typeof (rawArgs as { caso?: unknown })?.caso === "string" ? (rawArgs as { caso: string }).caso : null
      let result: string
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; ")
        result = fail(`Argumentos inválidos para ${name}: ${issues}`)
      } else {
        try {
          result = await tool.execute(parsed.data, ctx)
        } catch (error) {
          result = fail(error instanceof Error ? error.message : "Error inesperado en la herramienta.")
        }
      }
      const okFlag = (JSON.parse(result) as ToolResult<unknown>).ok
      await ctx.oc
        .recordActivity({ herramienta: name, caso: caseId, ok: okFlag, resumen: summarize(result), canal: ctx.channel })
        .catch(() => undefined)
      return result
    },
  }
}

/** Builds the registry from a module of tools: each export `x` becomes `<prefix>_x` (PRD 6.2). */
export function registerTools(prefix: string, module: Record<string, ToolDefinition<z.ZodRawShape>>): RegisteredTool[] {
  return Object.entries(module).map(([exportName, tool]) => decorateTool(`${prefix}_${exportName}`, tool))
}
