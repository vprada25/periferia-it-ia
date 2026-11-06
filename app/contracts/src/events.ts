import type { CaseStatus } from "./case-status"
import type { Channel } from "./records"

export type DomainEvent =
  | { type: "tool.called"; channel: Channel; tool: string; caseId: string | null; ok: boolean; summary: string }
  | { type: "case.updated"; caseId: string; status: CaseStatus }
  | { type: "confirmation.pending"; caseId: string; codes: string[] }
  | { type: "confirmation.resolved"; caseId: string; approved: boolean; by: string }
  | { type: "po.created"; caseId: string; poNumber: string; idempotent: boolean }
  | { type: "system.reset" }

export type StampedEvent = DomainEvent & { ts: string }

export const EVENT_TYPES: readonly DomainEvent["type"][] = [
  "tool.called",
  "case.updated",
  "confirmation.pending",
  "confirmation.resolved",
  "po.created",
  "system.reset",
]
