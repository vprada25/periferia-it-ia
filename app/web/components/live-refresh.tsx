"use client"

import { EVENT_TYPES, type StampedEvent } from "@oc/contracts"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

/** Browser event fired when the demo is reset, so client state (the chat) starts over too. */
export const RESET_EVENT = "oc:reset"

function describe(event: StampedEvent): string {
  switch (event.type) {
    case "tool.called":
      return `${event.channel} · ${event.tool}${event.caseId ? ` (${event.caseId})` : ""}`
    case "case.updated":
      return `${event.caseId} → ${event.status}`
    case "confirmation.pending":
      return `${event.caseId} espera confirmación`
    case "confirmation.resolved":
      return `${event.caseId} ${event.approved ? "aprobada" : "rechazada"} por ${event.by}`
    case "po.created":
      return `OC ${event.poNumber} (${event.caseId})${event.idempotent ? " ya existía" : ""}`
    case "system.reset":
      return "Demo reiniciada"
  }
}

/** Subscribes to backend events (SSE) and refreshes the server-rendered page when something changes (ADR-013). */
export function LiveRefresh() {
  const router = useRouter()
  const [connected, setConnected] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const source = new EventSource("/api/events")
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    const onEvent = (raw: MessageEvent<string>) => {
      const event = JSON.parse(raw.data) as StampedEvent
      setLast(describe(event))
      if (event.type === "system.reset") window.dispatchEvent(new Event(RESET_EVENT))
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => router.refresh(), 200)
    }
    for (const type of EVENT_TYPES) source.addEventListener(type, onEvent as EventListener)
    return () => {
      source.close()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [router])

  return (
    <div className="live" title={last ?? ""}>
      <span className={connected ? "dot on" : "dot"} />
      <span>{connected ? "En vivo" : "Reconectando…"}</span>
      {last && <span className="muted live-last">{last}</span>}
    </div>
  )
}
