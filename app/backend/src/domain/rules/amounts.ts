import { formatCop } from "../normalize"
import { NO_FINDINGS, type ControlRule } from "./rule"

export const QUOTE_TOLERANCE = 0.02

export const quoteMatchRule: ControlRule = {
  id: "RC5",
  description: "La cotización no difiere más de 2 % del valor de la solicitud (sin cotización también se confirma).",
  kind: "confirmation",
  evaluate(ctx) {
    const request = ctx.pkg.solicitud
    const quote = ctx.pkg.cotizacion
    if (!quote) {
      return { confirmations: [{ code: "QUOTE_MISSING", rule: this.id, detail: "La solicitud no trae cotización del proveedor." }] }
    }
    const gap = Math.abs(quote.total - request.valor_total) / request.valor_total
    if (gap <= QUOTE_TOLERANCE) return NO_FINDINGS
    const gapPct = Math.round(gap * 10000) / 100
    return {
      confirmations: [
        {
          code: "QUOTE_MISMATCH",
          rule: this.id,
          detail: `La cotización (${formatCop(quote.total)}) difiere ${gapPct} % de la solicitud (${formatCop(request.valor_total)}); el máximo es 2 %. La OC se crearía por el valor de la solicitud.`,
          values: { solicitud: request.valor_total, cotizacion: quote.total, diferencia_pct: gapPct },
        },
      ],
    }
  },
}

export const arithmeticRule: ControlRule = {
  id: "RC10",
  description: "cantidad × valor unitario = valor total (± 1).",
  kind: "block",
  evaluate(ctx) {
    const request = ctx.pkg.solicitud
    const computed = request.cantidad * request.valor_unitario
    if (Math.abs(computed - request.valor_total) <= 1) return NO_FINDINGS
    return {
      blocks: [
        {
          code: "ARITHMETIC_MISMATCH",
          rule: this.id,
          detail: `cantidad × valor unitario = ${formatCop(computed)}, pero el valor total es ${formatCop(request.valor_total)}. Acción: pedir al solicitante que corrija la solicitud.`,
          values: { calculado: computed, valor_total: request.valor_total },
        },
      ],
    }
  },
}
