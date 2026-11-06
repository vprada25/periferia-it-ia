import { findSupplier } from "../master-data"
import { NO_FINDINGS, type ControlRule } from "./rule"

export const activeSupplierRule: ControlRule = {
  id: "RC1",
  description: "El proveedor existe en el maestro (por NIT o, si no hay NIT, por nombre) y está activo.",
  kind: "block",
  evaluate(ctx) {
    const request = ctx.pkg.solicitud
    const { supplier, matchedBy } = findSupplier(ctx.masterData, {
      taxId: request.proveedor_nit,
      name: request.proveedor_nombre,
    })
    if (!supplier) {
      const key = request.proveedor_nit ? `NIT ${request.proveedor_nit}` : `nombre "${request.proveedor_nombre}"`
      return {
        blocks: [
          {
            code: "SUPPLIER_NOT_FOUND",
            rule: this.id,
            detail: `El proveedor ${request.proveedor_nombre} (${key}) no existe en el maestro. Acción: solicitar su creación en SAP antes de emitir la OC.`,
          },
        ],
      }
    }
    ctx.derived.proveedor = supplier
    ctx.derived.proveedor_resuelto_por = matchedBy
    if (supplier.activo) return NO_FINDINGS
    return {
      blocks: [
        {
          code: "SUPPLIER_INACTIVE",
          rule: this.id,
          detail: `El proveedor ${supplier.nombre} (${supplier.codigo_sap}) está inactivo. Acción: pedir su reactivación o cambiar de proveedor.`,
        },
      ],
    }
  },
}
