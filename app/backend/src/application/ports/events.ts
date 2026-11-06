import type { DomainEvent, StampedEvent } from "@oc/contracts"

export type EventListener = (event: StampedEvent) => void

/** Observer: publishers do not know who listens (web via SSE, logs, tests). */
export interface EventPublisher {
  publish(event: DomainEvent): void
  subscribe(listener: EventListener): () => void
}
