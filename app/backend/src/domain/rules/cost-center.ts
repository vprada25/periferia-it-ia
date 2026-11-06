import { costCenterOf, NO_FINDINGS, type ControlRule } from "./rule"

export const subareaRule: ControlRule = {
  id: "RC4",
  description: "La subárea pertenece al centro de costo.",
  kind: "block",
  evaluate(ctx) {
    const request = ctx.pkg.solicitud
    const center = costCenterOf(ctx)
    if (!center) {
      return {
        blocks: [{ code: "COST_CENTER_NOT_FOUND", rule: this.id, detail: `El centro de costo ${request.centro_costo} no existe.` }],
      }
    }
    if (center.subareas.includes(request.subarea)) return NO_FINDINGS
    return {
      blocks: [
        {
          code: "SUBAREA_INVALID",
          rule: this.id,
          detail: `La subárea "${request.subarea}" no pertenece a ${center.centro_costo}. Válidas: ${center.subareas.join(", ")}.`,
        },
      ],
    }
  },
}
