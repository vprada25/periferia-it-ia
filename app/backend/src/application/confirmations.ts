import type { Channel, Confirmation, Finding } from "@oc/contracts"

export type { Confirmation } from "@oc/contracts"

/**
 * Central confirmation registry per case (ADR-012). Any channel can read it;
 * only a human-facing channel (chat, web) or an explicitly trusted one can resolve it.
 */
export class ConfirmationStore {
  private readonly items = new Map<string, Confirmation>()

  /** Registers (or refreshes) the pending confirmation. Keeps an existing approval if the codes did not change. */
  require(caseId: string, findings: Finding[]): Confirmation {
    const codes = findings.map((f) => f.code).sort()
    const current = this.items.get(caseId)
    if (current && current.codes.join() === codes.join() && current.status !== "pending") return current
    const next: Confirmation = { caseId, codes, findings, status: "pending" }
    this.items.set(caseId, next)
    return next
  }

  resolve(caseId: string, approved: boolean, by: { channel: Channel; who: string; at: string }): Confirmation | null {
    const current = this.items.get(caseId)
    if (!current) return null
    const next: Confirmation = { ...current, status: approved ? "approved" : "rejected", resolvedBy: by }
    this.items.set(caseId, next)
    return next
  }

  get(caseId: string): Confirmation | null {
    return this.items.get(caseId) ?? null
  }

  clear(caseId: string): void {
    this.items.delete(caseId)
  }

  list(): Confirmation[] {
    return [...this.items.values()]
  }

  reset(): void {
    this.items.clear()
  }
}
