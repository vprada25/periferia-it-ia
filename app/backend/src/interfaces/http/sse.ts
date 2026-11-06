import type { EventPublisher } from "../../application/ports/events"

const PING_MS = 25_000

/** Server-Sent Events stream with every domain event (ADR-013). */
export function eventStream(events: EventPublisher, signal: AbortSignal): Response {
  const encoder = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }
      send("retry: 3000\n\n")
      const unsubscribe = events.subscribe((event) => send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))
      const ping = setInterval(() => send(": ping\n\n"), PING_MS)
      cleanup = () => {
        clearInterval(ping)
        unsubscribe()
      }
      signal.addEventListener("abort", () => {
        cleanup()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
    cancel() {
      cleanup()
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
