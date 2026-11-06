import type { CostCenter, MasterData, Supplier } from "@oc/contracts"
import { normalizeName, normalizeTaxId } from "./normalize"

export type SupplierMatch = { supplier: Supplier | null; matchedBy: "nit" | "nombre" }

/** Finds a supplier by tax id; when the request has none, by normalized name (RC1). */
export function findSupplier(masterData: MasterData, criteria: { taxId?: string | null; name: string }): SupplierMatch {
  if (criteria.taxId) {
    const taxId = normalizeTaxId(criteria.taxId)
    return { supplier: masterData.proveedores.find((s) => s.nit === taxId) ?? null, matchedBy: "nit" }
  }
  const name = normalizeName(criteria.name)
  return {
    supplier: masterData.proveedores.find((s) => normalizeName(s.nombre) === name) ?? null,
    matchedBy: "nombre",
  }
}

export function findCostCenter(masterData: MasterData, code: string): CostCenter | null {
  return masterData.centros.find((c) => c.centro_costo === code) ?? null
}
