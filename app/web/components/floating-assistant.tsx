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

/** Short plain-text preview of Hermes' answer: the question if it asks for confirmation, otherwise its opening lines. */
export function replyPreview(text: string, needsConfirmation: boolean): string {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim())
    .filter((line) => line && !line.startsWith("|") && !/^[-:| ]+$/.test(line))
  const question = needsConfirmation ? [...lines].reverse().find((line) => line.includes("?")) : undefined
  const preview = question ?? lines.slice(0, 2).join(" ")
  return preview.length > 240 ? `${preview.slice(0, 237)}…` : preview
}

/** Where the action happened: one case → its detail page; several → the case list; none → stay. */
export function screenFor(toolCalls: VisibleToolCall[], userText = ""): { href: string; label: string } | null {
  const fromTools = toolCalls
    .map((call) => (call.args as { caso?: unknown } | null)?.caso)
    .filter((caso): caso is string => typeof caso === "string")
  // No tools used (Hermes answered from the conversation): fall back to the cases the analyst named.
  const fromText = [...userText.toLowerCase().matchAll(/\bsol-\d{3}\b/g)].map((m) => m[0])
  const cases = [...new Set(fromTools.length > 0 ? fromTools : fromText)]
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
  const [preview, setPreview] = useState<{ text: string; needsConfirmation: boolean } | null>(null)
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
      setPreview(null)
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
          onReply={({ text, needsConfirmation, toolCalls, userText }) => {
            const screen = screenFor(toolCalls, userText)
            if (screen && screen.href !== pathname) {
              // Take the analyst to where the action happened and show what Hermes answered on top of it.
              router.push(screen.href)
              setMovedTo(screen.label)
              setOpen(false)
              writeFlag(OPEN_KEY, false)
              setAttention(needsConfirmation ? "confirmation" : "reply")
              setPreview({ text: replyPreview(text, needsConfirmation), needsConfirmation })
              return
            }
            if (!open) {
              setAttention(needsConfirmation ? "confirmation" : "reply")
              setPreview({ text: replyPreview(text, needsConfirmation), needsConfirmation })
            }
          }}
        />
      </section>

      {!open && (
        <div className="assistant-dock">
          {preview && (
            <div className={`reply-preview${preview.needsConfirmation ? " confirm" : ""}`} role="status" aria-live="polite">
              <div className="reply-head">
                <AgentAvatar size={30} />
                <b>{AGENT_PROFILE.name} te respondió{movedTo ? ` · te llevé a ${movedTo}` : ""}</b>
                <button className="icon-button" onClick={() => setPreview(null)} aria-label="Cerrar aviso">
                  ×
                </button>
              </div>
              <p>{preview.text}</p>
              <div className="reply-actions">
                <button className="primary" onClick={() => toggle(true)}>
                  Ver respuesta completa
                </button>
                {preview.needsConfirmation && (
                  <>
                    <button
                      className="ok"
                      onClick={() => {
                        setQueued("Confirmo, procede con la creación de la OC.")
                        toggle(true)
                      }}
                    >
                      Confirmar
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        setQueued("No, rechazo la confirmación. No crees la OC.")
                        toggle(true)
                      }}
                    >
                      Rechazar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {showGreeting && !preview && (
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
