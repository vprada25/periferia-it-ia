import type { Finding } from "./model"
import type { Channel } from "./records"

export type ConfirmationStatus = "pending" | "approved" | "rejected"

export type Confirmation = {
  caseId: string
  codes: string[]
  findings: Finding[]
  status: ConfirmationStatus
  resolvedBy?: { channel: Channel; who: string; at: string }
}
