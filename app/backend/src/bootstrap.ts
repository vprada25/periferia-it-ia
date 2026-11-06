import { ConfirmationStore } from "./application/confirmations"
import { OcService } from "./application/oc-service"
import type { Clock } from "./application/ports/clock"
import type { EventPublisher } from "./application/ports/events"
import { loadBackendConfig, type BackendConfig } from "./config"
import { InMemoryEventBus } from "./infrastructure/events/in-memory-event-bus"
import { FixtureDataSource } from "./infrastructure/fixtures/fixture-data-source"
import { FileRepository } from "./infrastructure/persistence/file-repository"
import { SystemClock } from "./infrastructure/system-clock"
import { SapMock } from "./sap/mock"

export type Container = {
  config: BackendConfig
  rootDir: string
  service: OcService
  events: EventPublisher
  clock: Clock
}

/**
 * Composition root: the only place that knows the concrete implementations.
 * Swapping files for Postgres or the SAP mock for a real SAP adapter happens here.
 */
export function createContainer(options: { clock?: Clock; config?: BackendConfig } = {}): Container {
  const config = options.config ?? loadBackendConfig()
  const rootDir = config.OC_ROOT_DIR
  const clock = options.clock ?? new SystemClock()
  const dataSource = new FixtureDataSource(rootDir)
  const events = new InMemoryEventBus(clock)
  const sap = new SapMock(rootDir, clock, async () => (await dataSource.loadMasterData()).proveedores)
  const service = new OcService({
    dataSource,
    repository: new FileRepository(rootDir),
    sap,
    sapReader: sap,
    events,
    clock,
    confirmations: new ConfirmationStore(),
  })
  return { config, rootDir, service, events, clock }
}
