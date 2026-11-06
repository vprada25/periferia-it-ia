/** Output port for time, so use cases stay deterministic in demo and tests. */
export interface Clock {
  now(): Date
}
