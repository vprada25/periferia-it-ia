import type { Clock } from "../../application/ports/clock"
import type { DomainEvent } from "@oc/contracts"
import type { EventListener, EventPublisher } from "../../application/ports/events"

/** Observer implementation for a single-instance monolith (ADR-013). A broker would replace it when scaling out. */
export class InMemoryEventBus implements EventPublisher {
  private readonly listeners = new Set<EventListener>()

  constructor(private readonly clock: Clock) {}

  publish(event: DomainEvent): void {
    const stamped = { ...event, ts: this.clock.now().toISOString() }
    for (const listener of this.listeners) {
      try {
        listener(stamped)
      } catch {
        // A failing subscriber (e.g. a closed SSE connection) must never break a use case.
      }
    }
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
