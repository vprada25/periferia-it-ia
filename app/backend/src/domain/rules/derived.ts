import { NO_FINDINGS, type ControlRule } from "./rule"

export const vatIndicatorRule: ControlRule = {
  id: "RC6",
  description: "Si falta el indicador de IVA, se deriva del proveedor y se pide confirmación.",
  kind: "confirmation",
  evaluate(ctx) {
    const request = ctx.pkg.solicitud
    if (request.indicador_iva) {
      ctx.derived.indicador_iva = { valor: request.indicador_iva, fuente: "solicitud" }
      return NO_FINDINGS
    }
    const supplier = ctx.derived.proveedor
    if (!supplier) return NO_FINDINGS
    const code = supplier.indicador_iva_default
    ctx.derived.indicador_iva = { valor: code, fuente: "derivado" }
    const vat = ctx.masterData.iva.find((v) => v.codigo === code)
    return {
      confirmations: [
        {
          code: "VAT_DERIVED",
          rule: this.id,
          detail: `La solicitud no informa indicador de IVA. Se propone ${code} (${vat?.descripcion ?? "sin descripción"}), el predeterminado de ${supplier.nombre}.`,
          values: { indicador_iva: code },
        },
      ],
    }
  },
}

export const paymentTermsRule: ControlRule = {
  id: "RC7",
  description: "Si faltan las condiciones de pago, se derivan del proveedor (solo se informa).",
  kind: "derived",
  evaluate(ctx) {
    const request = ctx.pkg.solicitud
    if (request.condiciones_pago) {
      ctx.derived.condiciones_pago = { valor: request.condiciones_pago, fuente: "solicitud" }
    } else if (ctx.derived.proveedor) {
      ctx.derived.condiciones_pago = { valor: ctx.derived.proveedor.condiciones_pago_default, fuente: "derivado" }
    }
    return NO_FINDINGS
  },
}
