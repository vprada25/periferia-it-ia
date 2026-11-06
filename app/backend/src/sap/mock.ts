import { appendFile, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import type { Clock } from "../application/ports/clock"
import type { StoredOrder } from "@oc/contracts"
import type { SapOrderReader } from "../application/ports/sap-reader"
import { SerialQueue } from "../infrastructure/persistence/serial-queue"
import type { OrdenCompra, SapAdapter } from "./adapter"

const FIRST_PO_NUMBER = 4500000001

/**
 * Simulated SAP (PRD 7.4). Sequential numbers from 4500000001, orders in out/sap/ordenes.jsonl,
 * idempotent by solicitud_id. Writes are serialized so two channels cannot create the same order twice.
 */
export class SapMock implements SapAdapter, SapOrderReader {
  private readonly queue = new SerialQueue()
  private readonly dir: string

  constructor(
    rootDir: string,
    private readonly clock: Clock,
    private readonly suppliers: () => Promise<{ nit: string; codigo_sap: string; activo: boolean }[]>,
  ) {
    this.dir = join(rootDir, "out/sap")
  }

  private get ordersPath() {
    return join(this.dir, "ordenes.jsonl")
  }

  private get sequencePath() {
    return join(this.dir, "secuencia.json")
  }

  async consultarProveedor(nit: string) {
    const supplier = (await this.suppliers()).find((s) => s.nit === nit)
    return supplier ? { codigo_sap: supplier.codigo_sap, activo: supplier.activo } : null
  }

  async buscarOrdenPorReferencia(solicitud_id: string) {
    const order = (await this.listOrders()).find((o) => o.solicitud_id === solicitud_id)
    return order ? { numero_oc: order.numero_oc } : null
  }

  crearOrden(orden: OrdenCompra): Promise<{ numero_oc: string; fecha: string }> {
    return this.queue.run(async () => {
      // Checked again inside the queue: the business reference is the idempotency key.
      const existing = (await this.listOrders()).find((o) => o.solicitud_id === orden.referencia.solicitud_id)
      if (existing) return { numero_oc: existing.numero_oc, fecha: existing.fecha }
      await mkdir(this.dir, { recursive: true })
      const sequence = Bun.file(this.sequencePath)
      const last = (await sequence.exists()) ? ((await sequence.json()) as { ultimo: number }).ultimo : FIRST_PO_NUMBER - 1
      const numero_oc = String(last + 1)
      const fecha = this.clock.now().toISOString().slice(0, 10)
      const stored: StoredOrder = { numero_oc, fecha, solicitud_id: orden.referencia.solicitud_id, orden }
      await appendFile(this.ordersPath, `${JSON.stringify(stored)}\n`)
      await Bun.write(this.sequencePath, JSON.stringify({ ultimo: last + 1 }))
      return { numero_oc, fecha }
    })
  }

  async listOrders(): Promise<StoredOrder[]> {
    const file = Bun.file(this.ordersPath)
    if (!(await file.exists())) return []
    return (await file.text())
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredOrder)
  }

  async reset(): Promise<void> {
    await this.queue.run(() => rm(this.dir, { recursive: true, force: true }))
  }
}
