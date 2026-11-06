import type { ControlRecord, PurchaseOrder, ToolLogRecord, Traceability } from "@oc/contracts"

export type StoredPayload = { order: PurchaseOrder; traceability: Traceability; sha256: string }

/** Output port: persistence of the PRD artifacts (files today; Postgres optional, ADR-015). */
export interface Repository {
  reset(): Promise<void>
  saveEvidence(caseId: string, document: string): Promise<string>
  savePayload(caseId: string, payload: StoredPayload): Promise<{ payloadPath: string; tracePath: string }>
  loadPayload(caseId: string): Promise<StoredPayload | null>
  appendControl(record: ControlRecord): Promise<void>
  listControl(): Promise<ControlRecord[]>
  appendToolLog(record: ToolLogRecord): Promise<void>
  listToolLog(limit: number): Promise<ToolLogRecord[]>
}
