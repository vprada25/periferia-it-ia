import type { Finding } from "@oc/contracts"
import { formatCop } from "../normalize"
import { approverOf, costCenterOf, NO_FINDINGS, type ControlRule } from "./rule"

export const validApprovalRule: ControlRule = {
  id: "RC2",
  description: 'Existe aprobación, contiene "Aprobado" y viene de un aprobador del centro de costo.',
  kind: "block",
  evaluate(ctx) {
    const approval = ctx.pkg.aprobacion
    if (!approval) {
      return {
        blocks: [
          {
            code: "APPROVAL_MISSING",
            rule: this.id,
            detail: "No hay correo de aprobación. Acción: solicitarla al líder del centro de costo.",
          },
        ],
      }
    }
    const blocks: Finding[] = []
    if (!approval.aprobado) {
      blocks.push({ code: "APPROVAL_TEXT_MISSING", rule: this.id, detail: `El correo de ${approval.de} no contiene "Aprobado".` })
    }
    const center = costCenterOf(ctx)
    if (center && !approverOf(ctx)) {
      const allowed = center.aprobadores.map((a) => `${a.nombre} <${a.email}>`).join(", ")
      blocks.push({
        code: "APPROVER_NOT_AUTHORIZED",
        rule: this.id,
        detail: `${approval.de} no es aprobador de ${center.centro_costo} (${center.nombre}). Aprobadores válidos: ${allowed}. Acción: pedir la aprobación a uno de ellos o corregir el centro de costo.`,
      })
    }
    return { blocks }
  },
}

export const approverLimitRule: ControlRule = {
  id: "RC3",
  description: "El valor total no supera el tope del aprobador en ese centro de costo.",
  kind: "block",
  evaluate(ctx) {
    const center = costCenterOf(ctx)
    if (!center || !ctx.pkg.aprobacion || center.aprobadores.length === 0) return NO_FINDINGS
    const total = ctx.pkg.solicitud.valor_total
    const approver = approverOf(ctx)
    // Unauthorized approver (RC2): compare against the highest limit in the cost center as an aggravating factor.
    const limit = approver ? approver.tope : Math.max(...center.aprobadores.map((a) => a.tope))
    if (total <= limit) return NO_FINDINGS
    const against = approver ? `el tope de ${approver.nombre}` : `el mayor tope de ${center.centro_costo}`
    return {
      blocks: [
        {
          code: "APPROVER_LIMIT_EXCEEDED",
          rule: this.id,
          detail: `El valor ${formatCop(total)} supera ${against} (${formatCop(limit)}).`,
          values: { valor_total: total, tope: limit },
        },
      ],
    }
  },
}
