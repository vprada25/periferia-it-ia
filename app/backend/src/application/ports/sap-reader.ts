import type { StoredOrder } from "@oc/contracts"

/** Read side of SAP used by the dashboard. Kept apart so the PRD's SapAdapter stays exactly as mandated. */
export interface SapOrderReader {
  listOrders(): Promise<StoredOrder[]>
  reset(): Promise<void>
}
