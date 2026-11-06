"use client"

import { AGENT_PROFILE, type VisibleToolCall } from "@oc/contracts"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { AgentAvatar, Chat } from "./chat"
import { useTypewriter } from "./use-typewriter"

const OPEN_KEY = "oc-assistant-open"
const GREETED_KEY = "oc-assistant-greeted"
const GREETING_MS = 9000

type Attention = "none" | "reply" | "confirmation"

/** Where the action happened: one case → its detail page; several → the case list; none → stay. */
export function screenFor(toolCalls: VisibleToolCall[]): { href: string; label: string } | null {
  const cases = [
    ...new Set(
      toolCalls
        .map((call) => (call.args as { caso?: unknown } | null)?.caso)
        .filter((caso): caso is string => typeof caso === "string"),
    ),
  ]
  if (cases.length === 1) return { href: `/cases/${cases[0]}`, label: cases[0] ?? "" }
  if (cases.length > 1) return { href: "/cases", label: "los casos" }
  return null
}

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    sessionStorage.setItem(key, value ? "1" : "0")
  } catch {
    // storage unavailable
  }
}

/**
 * Hermes as a centered chat bar at the bottom of every page. Typing in the bar (or using the expand button)
 * opens the full chat panel. The chat stays mounted while collapsed, so a running turn is never lost.
 */
export function FloatingAssistant() {
  const [open, setOpen] = useState(false)
  const [attention, setAttention] = useState<Attention>("none")
  const [draft, setDraft] = useState("")
  const [queued, setQueued] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const [focused, setFocused] = useState(false)
  const [movedTo, setMovedTo] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const phrases = [AGENT_PROFILE.greeting, ...AGENT_PROFILE.capabilities]
  const animated = useTypewriter(phrases, !open && !focused && draft === "")

  useEffect(() => {
    setOpen(readFlag(OPEN_KEY))
    if (!readFlag(GREETED_KEY)) {
      setShowGreeting(true)
      writeFlag(GREETED_KEY, true)
      const timer = setTimeout(() => setShowGreeting(false), GREETING_MS)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [])

  const toggle = useCallback((next: boolean) => {
    setOpen(next)
    setShowGreeting(false)
    if (next) {
      setAttention("none")
      setMovedTo(null)
    }
    writeFlag(OPEN_KEY, next)
  }, [])

  const submitDraft = (e: FormEvent) => {
    e.preventDefault()
    const message = draft.trim()
    if (!message) {
      toggle(true)
      return
    }
    setQueued(message)
    setDraft("")
    toggle(true)
  }

  const where = movedTo ? `Te llevé a ${movedTo} · ` : ""
  const statusText =
    attention === "confirmation"
      ? `${where}necesito tu confirmación (ábreme o apruébala aquí)`
      : attention === "reply"
        ? `${where}abre el chat para ver mi respuesta`
        : null

  return (
    <>
      <section className={open ? "assistant-panel open" : "assistant-panel"} aria-label={`Chat con ${AGENT_PROFILE.name}`} aria-hidden={!open}>
        <Chat
          onClose={() => toggle(false)}
          queuedMessage={queued}
          onQueuedSent={() => setQueued(null)}
          onBusyChange={setBusy}
          onReply={({ needsConfirmation, toolCalls }) => {
            const screen = screenFor(toolCalls)
            if (screen && screen.href !== pathname) {
              // Take the analyst to where the action happened; the bar keeps the answer one click away.
              router.push(screen.href)
              setMovedTo(screen.label)
              setOpen(false)
              writeFlag(OPEN_KEY, false)
              setAttention(needsConfirmation ? "confirmation" : "reply")
              return
            }
            if (!open) setAttention(needsConfirmation ? "confirmation" : "reply")
          }}
        />
      </section>

      {!open && (
        <div className="assistant-dock">
          {showGreeting && (
            <div className="assistant-greeting" role="status">
              <b>{AGENT_PROFILE.greeting}</b>
              <span>Te ayudo con las órdenes de compra:</span>
              <ul>
                {AGENT_PROFILE.capabilities.map((c, i) => (
                  <li key={c} style={{ animationDelay: `${0.35 + i * 0.25}s` }}>
                    {c}
                  </li>
                ))}
              </ul>
              <button className="icon-button greeting-close" onClick={() => setShowGreeting(false)} aria-label="Cerrar saludo">
                ×
              </button>
            </div>
          )}
          <form className={`assistant-bar${attention !== "none" ? " attention" : ""}`} onSubmit={submitDraft}>
            <button type="button" className="bar-avatar" onClick={() => toggle(true)} aria-label={`Abrir chat con ${AGENT_PROFILE.name}`}>
              <AgentAvatar size={38} />
              {attention !== "none" && <span className="launcher-dot" aria-hidden />}
            </button>
            <div className="bar-input-wrap">
              <input
                className="bar-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-label={`Escríbele a ${AGENT_PROFILE.name}`}
                placeholder={focused ? `Escríbele a ${AGENT_PROFILE.name}…` : ""}
              />
              {!focused && draft === "" && (
                <span className="bar-placeholder" aria-hidden>
                  {statusText ?? (
                    <>
                      <b>{AGENT_PROFILE.name}</b> · {animated}
                      <span className="caret" />
                    </>
                  )}
                </span>
              )}
            </div>
            {busy && <span className="bar-busy" aria-label="Hermes está trabajando" />}
            <button type="submit" className="bar-send primary" aria-label={draft.trim() ? "Enviar" : "Abrir chat"}>
              {draft.trim() ? "Enviar" : "⌃"}
            </button>
          </form>
        </div>
      )}
    </>
  )
}
