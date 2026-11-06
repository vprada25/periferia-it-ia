import { z } from "zod"

export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export const ChatRequestSchema = z.object({
  sessionId: z.string().regex(SESSION_ID_PATTERN, "sessionId inválido"),
  message: z.string().trim().min(1).max(4000),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export type VisibleToolCall = { name: string; args: unknown; ok: boolean; summary: string }

export type VisibleMessage = {
  role: "user" | "assistant"
  text: string
  toolCalls?: VisibleToolCall[]
  needsConfirmation?: boolean
  ts: string
}

/** PRD 6.4: POST /api/chat → { reply, toolCalls[], needsConfirmation }. */
export type ChatTurn = {
  reply: string
  toolCalls: VisibleToolCall[]
  needsConfirmation: boolean
  usage: { inputTokens: number; outputTokens: number; sessionTokens: number }
}

/** PRD 6.4: GET /api/sessions/:id. */
export type SessionView = { id: string; messages: VisibleMessage[]; tokensUsed: number; pendingCases: string[] }

export type HealthView = { ok: true; service: string; provider?: string; model?: string; channels?: string[] }
