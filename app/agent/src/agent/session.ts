import { SESSION_ID_PATTERN, type VisibleMessage } from "@oc/contracts"
import type { LlmMessage } from "../llm/adapter"

export type { VisibleMessage, VisibleToolCall } from "@oc/contracts"

export type ChatSession = {
  id: string
  /** Full provider-neutral history replayed to the model. */
  history: LlmMessage[]
  /** What the UI shows (PRD 6.4 GET /api/sessions/:id). */
  visible: VisibleMessage[]
  tokensUsed: number
  /** Cases whose confirmation was pending when the assistant ended its last turn (CA3). */
  pendingCases: string[]
}

/** In-memory session store (PRD 6.1 allows memory). One analyst, single instance. */
export class SessionStore {
  private readonly sessions = new Map<string, ChatSession>()

  static isValidId(id: string): boolean {
    return SESSION_ID_PATTERN.test(id)
  }

  getOrCreate(id: string): ChatSession {
    const existing = this.sessions.get(id)
    if (existing) return existing
    const session: ChatSession = { id, history: [], visible: [], tokensUsed: 0, pendingCases: [] }
    this.sessions.set(id, session)
    return session
  }

  get(id: string): ChatSession | null {
    return this.sessions.get(id) ?? null
  }

  clear(): void {
    this.sessions.clear()
  }
}

const AFFIRMATIVE = /\b(s[ií]|confirmo|confirmado|confirmar|apruebo|aprobado|procede|proceder|adelante|dale|ok|de acuerdo|cr[ée]ala|cr[ée]alas)\b/i
const NEGATIVE = /\b(no|rechazo|rechazar|rechazada|cancela|cancelar|det[ée]n|espera)\b/i

export type ConfirmationIntent = "approve" | "reject" | "none"

/** Reads the analyst's reply to a pending confirmation. Ambiguous replies resolve nothing. */
export function readConfirmationIntent(text: string): ConfirmationIntent {
  const yes = AFFIRMATIVE.test(text)
  const no = NEGATIVE.test(text)
  if (yes && !no) return "approve"
  if (no && !yes) return "reject"
  return "none"
}
