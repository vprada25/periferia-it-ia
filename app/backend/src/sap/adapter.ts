import type { PurchaseOrder } from "@oc/contracts"

/** Re-exported with the PRD name so the mandated interface reads exactly as specified. */
export type OrdenCompra = PurchaseOrder

/**
 * Output port to SAP. Location and method names are mandated by the PRD (section 7.4),
 * which is why they stay in Spanish.
 */
export interface SapAdapter {
  consultarProveedor(nit: string): Promise<{ codigo_sap: string; activo: boolean } | null>
  crearOrden(orden: OrdenCompra): Promise<{ numero_oc: string; fecha: string }>
  buscarOrdenPorReferencia(solicitud_id: string): Promise<{ numero_oc: string } | null>
}
