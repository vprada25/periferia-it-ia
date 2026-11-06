import type { Clock } from "../application/ports/clock"

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}

/** Fixed clock for demo.ts and tests, so outputs are reproducible. */
export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return new Date(this.instant)
  }
}
