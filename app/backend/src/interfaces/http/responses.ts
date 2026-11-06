import { z } from "zod"

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } })

export const errorResponse = (message: string, status = 400): Response => json({ ok: false, error: message }, status)

/** Runs a handler and turns thrown errors into readable JSON without stack traces (HU-6). */
export async function safely(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "))
    }
    return errorResponse(error instanceof Error ? error.message : "Error inesperado.")
  }
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error("El cuerpo de la petición no es un JSON válido.")
  }
}
