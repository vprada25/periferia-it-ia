/** Public surface of the backend package (used by demo.ts and scripts). */
export { createContainer, type Container } from "./bootstrap"
export { loadBackendConfig, type BackendConfig } from "./config"
export { FixedClock, SystemClock } from "./infrastructure/system-clock"
