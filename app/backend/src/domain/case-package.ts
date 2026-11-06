import { EmailSchema, PurchaseRequestSchema, RawApprovalSchema, type CasePackage } from "@oc/contracts"
import { parseApproval, parseInvoice, parseQuote } from "./parsers"

/** Raw case files as read by an adapter; any of them may be missing. */
export type RawCaseFiles = {
  caso: string
  correo: unknown
  solicitud: unknown
  cotizacion: string | null
  aprobacion: unknown
  factura: string | null
}

/** Normalizes a case into the PRD 7.2 package. Throws a readable error if a required file is malformed. */
export function buildCasePackage(raw: RawCaseFiles): CasePackage {
  const missing: string[] = []
  const email = EmailSchema.safeParse(raw.correo)
  if (!email.success) throw new Error(`correo.json inválido o ausente en ${raw.caso}.`)
  const request = PurchaseRequestSchema.safeParse(raw.solicitud)
  if (!request.success) {
    const fields = request.error.issues.map((i) => i.path.join(".")).join(", ")
    throw new Error(`solicitud.json inválido en ${raw.caso} (campos: ${fields}). Pídele al solicitante que lo corrija.`)
  }
  if (raw.cotizacion === null) missing.push("cotizacion")
  const approval = raw.aprobacion === null ? null : RawApprovalSchema.safeParse(raw.aprobacion)
  if (!approval?.success) missing.push("aprobacion")
  return {
    caso: raw.caso,
    correo: email.data,
    solicitud: request.data,
    cotizacion: raw.cotizacion === null ? null : parseQuote(raw.cotizacion),
    aprobacion: approval?.success ? parseApproval(approval.data) : null,
    factura: raw.factura === null ? null : parseInvoice(raw.factura),
    faltantes: missing,
  }
}
