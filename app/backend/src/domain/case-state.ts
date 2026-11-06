import type { CaseStatus } from "@oc/contracts"

export type { CaseStatus } from "@oc/contracts"
export { STATUS_LABEL } from "@oc/contracts"

/** State: allowed transitions of the case lifecycle. */
const TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  not_processed: ["blocked", "awaiting_confirmation", "ready", "po_created"],
  blocked: ["blocked", "awaiting_confirmation", "ready"],
  awaiting_confirmation: ["awaiting_confirmation", "ready", "rejected", "blocked"],
  ready: ["ready", "po_created", "awaiting_confirmation", "blocked"],
  rejected: ["rejected", "awaiting_confirmation", "ready", "blocked"],
  po_created: ["po_created"],
}

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function transition(from: CaseStatus, to: CaseStatus): CaseStatus {
  if (!canTransition(from, to)) throw new Error(`Transición de estado inválida: ${from} → ${to}`)
  return to
}

/** Status right after validation, given the findings and the confirmation state. */
export function statusAfterValidation(input: {
  eligible: boolean
  pendingConfirmations: boolean
  confirmationRejected: boolean
}): CaseStatus {
  if (!input.eligible) return "blocked"
  if (input.confirmationRejected) return "rejected"
  return input.pendingConfirmations ? "awaiting_confirmation" : "ready"
}
