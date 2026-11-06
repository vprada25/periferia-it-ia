"use client"

import { AGENT_PROFILE, type ChatTurn, type SessionView, type VisibleMessage, type VisibleToolCall } from "@oc/contracts"
import { marked } from "marked"
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"

const SUGGESTIONS = [
  "Procesa la solicitud sol-001 y crea la OC si todo cuadra.",
  "Procesa la solicitud sol-004. Muéstrame la OC como quedaría en SAP y no la crees hasta que yo lo confirme.",
  "Revisa sol-002 y sol-003 y dime por qué no se pueden crear.",
  "Procesa sol-005 y sol-006.",
] as const

const SESSION_KEY = "oc-session-id"

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const created = crypto.randomUUID().replace(/-/g, "")
    sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return crypto.randomUUID().replace(/-/g, "")
  }
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)

/** Model output is escaped before markdown rendering, so it cannot inject HTML. */
function Markdown({ text }: { text: string }) {
  const html = marked.parse(escapeHtml(text), { async: false, gfm: true, breaks: true })
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
}

function ToolCallCard({ call }: { call: VisibleToolCall }) {
  const caso = (call.args as { caso?: unknown } | null)?.caso
  return (
    <details className={`tool ${call.ok ? "ok" : "err"}`}>
      <summary>
        <code>{call.name}</code>
        {typeof caso === "string" && <span className="muted">{caso}</span>}
      </summary>
      <pre>args: {JSON.stringify(call.args, null, 2)}</pre>
      <pre>{call.summary}</pre>
    </details>
  )
}

export function AgentAvatar({ size = 36 }: { size?: number }) {
  return <img src={AGENT_PROFILE.avatarPath} alt={AGENT_PROFILE.name} width={size} height={size} className="avatar" />
}

type Props = {
  compact?: boolean
  /** Shown as a close/minimize button in the header (floating panel). */
  onClose?: () => void
  /** Notifies the host when Hermes answers: the tools it used and whether it needs the analyst's confirmation. */
  onReply?: (turn: { needsConfirmation: boolean; toolCalls: VisibleToolCall[] }) => void
  /** A message typed elsewhere (the collapsed chat bar) to be sent as soon as the chat is ready. */
  queuedMessage?: string | null
  onQueuedSent?: () => void
  /** Notifies the host while a turn is running (used by the collapsed bar). */
  onBusyChange?: (busy: boolean) => void
}

/** Conversational agent UI (Hermes), shared by the floating assistant and /embed (ADR-014). */
export function Chat({ compact = false, onClose, onReply, queuedMessage, onQueuedSent, onBusyChange }: Props) {
  const [messages, setMessages] = useState<VisibleMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const current = sessionId()
    setId(current)
    fetch(`/api/sessions/${current}`)
      .then((r) => (r.ok ? (r.json() as Promise<SessionView>) : null))
      .then((s) => s && setMessages(s.messages))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, busy])

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  useEffect(() => {
    if (!queuedMessage || !id || busy) return
    onQueuedSent?.()
    void send(queuedMessage)
    // send() is recreated each render; the queued message is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedMessage, id, busy])

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy || !id) return
    setInput("")
    setBusy(true)
    const now = new Date().toISOString()
    setMessages((m) => [...m, { role: "user", text: message, ts: now }])
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id, message }),
      })
      const body = (await response.json()) as ChatTurn | { ok: false; error: string }
      const reply: VisibleMessage =
        "reply" in body
          ? { role: "assistant", text: body.reply, toolCalls: body.toolCalls, needsConfirmation: body.needsConfirmation, ts: new Date().toISOString() }
          : { role: "assistant", text: `⚠️ ${body.error}`, ts: new Date().toISOString() }
      setMessages((m) => [...m, reply])
      onReply?.({ needsConfirmation: reply.needsConfirmation ?? false, toolCalls: reply.toolCalls ?? [] })
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "⚠️ No fue posible contactar al agente.", ts: new Date().toISOString() }])
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <AgentAvatar size={40} />
        <div className="chat-identity">
          <b>{AGENT_PROFILE.name}</b>
          <span className="muted">{busy ? "pensando…" : AGENT_PROFILE.role}</span>
        </div>
        {onClose && (
          <button className="icon-button" onClick={onClose} aria-label={`Minimizar ${AGENT_PROFILE.name}`} title="Minimizar">
            ⌄
          </button>
        )}
      </div>
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="turn assistant-turn">
            <AgentAvatar size={28} />
            <div className="msg assistant">
              Hola, soy <b>{AGENT_PROFILE.name}</b>. Pídeme que procese una solicitud (sol-001 … sol-006): verás cada herramienta que uso y te pediré confirmación cuando haga falta.
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg user">
              {m.text}
            </div>
          ) : (
            <div key={i} className="turn assistant-turn">
              <AgentAvatar size={28} />
              <div className="turn-body">
              {(m.toolCalls ?? []).map((call, j) => (
                <ToolCallCard key={j} call={call} />
              ))}
              <div className={`msg assistant${m.needsConfirmation ? " needs-confirmation" : ""}`}>
                {m.needsConfirmation && <span className="badge warn">Requiere tu confirmación</span>}
                <Markdown text={m.text} />
                {m.needsConfirmation && i === messages.length - 1 && (
                  <div className="confirm-bar">
                    <button className="ok" disabled={busy} onClick={() => void send("Confirmo, procede con la creación de la OC.")}>
                      Confirmar
                    </button>
                    <button className="danger" disabled={busy} onClick={() => void send("No, rechazo la confirmación. No crees la OC.")}>
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
              </div>
            </div>
          ),
        )}
        {busy && <div className="thinking">{AGENT_PROFILE.name} está trabajando…</div>}
      </div>
      {!compact && messages.length === 0 && (
        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => void send(s)}>
              {s.length > 52 ? `${s.slice(0, 52)}…` : s}
            </button>
          ))}
        </div>
      )}
      <form className="chat-form" onSubmit={onSubmit}>
        <textarea
          placeholder={`Escríbele a ${AGENT_PROFILE.name}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
        />
        <button className="primary" disabled={busy || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  )
}
