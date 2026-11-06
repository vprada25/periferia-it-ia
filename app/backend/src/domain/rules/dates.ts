import { dateOnly } from "../normalize"
import { NO_FINDINGS, type ControlRule } from "./rule"

export const retroactiveInvoiceRule: ControlRule = {
  id: "RC8",
  description: "Si la factura es anterior a la solicitud, la OC es retroactiva y se pide confirmación.",
  kind: "confirmation",
  evaluate(ctx) {
    const invoice = ctx.pkg.factura
    const requestedOn = ctx.pkg.solicitud.fecha_solicitud
    if (!invoice || invoice.fecha >= requestedOn) return NO_FINDINGS
    return {
      retroactive: true,
      confirmations: [
        {
          code: "RETROACTIVE_PO",
          rule: this.id,
          detail: `La factura ${invoice.numero} es del ${invoice.fecha}, anterior a la solicitud del ${requestedOn}. La OC quedaría marcada como retroactiva.`,
          values: { factura: invoice.numero, fecha_factura: invoice.fecha, fecha_solicitud: requestedOn },
        },
      ],
    }
  },
}

export const approvalDateRule: ControlRule = {
  id: "RC9",
  description: "La fecha de aprobación es igual o posterior a la de la solicitud.",
  kind: "confirmation",
  evaluate(ctx) {
    const approval = ctx.pkg.aprobacion
    const requestedOn = ctx.pkg.solicitud.fecha_solicitud
    if (!approval || dateOnly(approval.fecha) >= requestedOn) return NO_FINDINGS
    return {
      confirmations: [
        {
          code: "APPROVAL_BEFORE_REQUEST",
          rule: this.id,
          detail: `La aprobación (${dateOnly(approval.fecha)}) es anterior a la solicitud (${requestedOn}).`,
        },
      ],
    }
  },
}
