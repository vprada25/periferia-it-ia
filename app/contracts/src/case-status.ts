/** Lifecycle status of a purchase request case (transition rules live in the backend domain). */
export type CaseStatus = "not_processed" | "blocked" | "awaiting_confirmation" | "ready" | "rejected" | "po_created"

export const STATUS_LABEL: Record<CaseStatus, string> = {
  not_processed: "Sin procesar",
  blocked: "Bloqueada",
  awaiting_confirmation: "Esperando confirmación",
  ready: "Lista para crear",
  rejected: "Confirmación rechazada",
  po_created: "OC creada",
}
