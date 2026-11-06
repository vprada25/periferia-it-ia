import { buildCasePackage } from "../domain/case-package"
import { STATUS_LABEL, statusAfterValidation, type CaseStatus } from "../domain/case-state"
import { renderApprovalEvidence, sha256Of } from "../domain/evidence"
import type { CasePackage, MasterData, ValidationResult } from "@oc/contracts"
import { PurchaseOrderBuilder } from "../domain/purchase-order-builder"
import { CONTROL_RULES, validatePackage } from "../domain/rules"
import type { SapAdapter } from "../sap/adapter"
import { ConfirmationStore, type Confirmation } from "./confirmations"
import type { Clock } from "./ports/clock"
import type { DataSource } from "./ports/data-source"
import type { EventPublisher } from "./ports/events"
import type {
  Actor,
  CaseDetail,
  CaseSummary,
  ControlRecord,
  ControlResult,
  CreateOutcome,
  EvidenceResult,
  Insights,
  OcPort,
  PayloadResult,
  ProcessResult,
  Snapshot,
  ToolLogRecord,
  ValidationWithStatus,
} from "@oc/contracts"
import type { Repository } from "./ports/repository"
import type { SapOrderReader } from "./ports/sap-reader"

export type OcServiceDeps = {
  dataSource: DataSource
  repository: Repository
  sap: SapAdapter
  sapReader: SapOrderReader
  events: EventPublisher
  clock: Clock
  confirmations: ConfirmationStore
}

type CaseRecord = { status: CaseStatus; validation: ValidationResult | null; poNumber: string | null; payload: PayloadResult | null }

const codesOf = (findings: { code: string }[]) => findings.map((f) => f.code)
const actorLabel = (actor: Actor) => `${actor.channel}:${actor.who ?? "analista"}`

/**
 * Facade over the purchase-order use cases. Every channel (chat tools, web, MCP, A2A)
 * goes through here, so business behavior is identical regardless of the entry point.
 */
export class OcService implements OcPort {
  private readonly records = new Map<string, CaseRecord>()

  constructor(private readonly deps: OcServiceDeps) {}

  // --- Queries ---

  async listCases(): Promise<CaseSummary[]> {
    const ids = await this.deps.dataSource.listCases()
    const orders = await this.deps.sapReader.listOrders()
    return Promise.all(ids.map((id) => this.summarize(id, orders)))
  }

  async readPackage(caseId: string): Promise<CasePackage> {
    return buildCasePackage(await this.deps.dataSource.loadRawCase(caseId))
  }

  async caseDetail(caseId: string): Promise<CaseDetail> {
    const raw = await this.deps.dataSource.loadRawCase(caseId)
    const documents = [
      { nombre: "correo.json", contenido: JSON.stringify(raw.correo, null, 2) },
      { nombre: "solicitud.json", contenido: JSON.stringify(raw.solicitud, null, 2) },
      { nombre: "cotizacion.txt", contenido: raw.cotizacion },
      { nombre: "aprobacion.json", contenido: raw.aprobacion === null ? null : JSON.stringify(raw.aprobacion, null, 2) },
      { nombre: "factura.txt", contenido: raw.factura },
    ].filter((d): d is { nombre: string; contenido: string } => d.contenido !== null)
    const orders = await this.deps.sapReader.listOrders()
    const record = this.records.get(caseId)
    return {
      summary: await this.summarize(caseId, orders),
      documents,
      validacion: record?.validation ?? null,
      payload: record?.payload ?? null,
      confirmacion: this.deps.confirmations.get(caseId),
    }
  }

  async getConfirmation(caseId: string): Promise<Confirmation | null> {
    return this.deps.confirmations.get(caseId)
  }

  masterData(): Promise<MasterData> {
    return this.deps.dataSource.loadMasterData()
  }

  async snapshot(): Promise<Snapshot> {
    const [cases, orders, control, activity] = await Promise.all([
      this.listCases(),
      this.deps.sapReader.listOrders(),
      this.deps.repository.listControl(),
      this.deps.repository.listToolLog(60),
    ])
    return {
      cases,
      confirmations: this.deps.confirmations.list(),
      orders,
      control,
      activity,
      rules: CONTROL_RULES.map(({ id, description, kind }) => ({ id, description, kind })),
      insights: await this.insights(),
    }
  }

  /** Dry-run validation of every case for the dashboard charts. Pure reads: no events, no files written. */
  private async insights(): Promise<Insights> {
    const master = await this.deps.dataSource.loadMasterData()
    const ids = await this.deps.dataSource.listCases()
    const evaluated = await Promise.all(
      ids.map(async (caseId) => {
        const pkg = await this.readPackage(caseId)
        return { caseId, pkg, result: validatePackage(pkg, master) }
      }),
    )
    const findingsByRule = CONTROL_RULES.map(({ id, description, kind }) => {
      const cases = evaluated
        .filter(({ result }) => [...result.bloqueos, ...result.confirmaciones].some((f) => f.rule === id))
        .map(({ caseId }) => caseId)
      return { id, description, kind, count: cases.length, cases }
    })
    const byCenter = new Map<string, { total: number; cases: number }>()
    for (const { pkg } of evaluated) {
      const current = byCenter.get(pkg.solicitud.centro_costo) ?? { total: 0, cases: 0 }
      byCenter.set(pkg.solicitud.centro_costo, { total: current.total + pkg.solicitud.valor_total, cases: current.cases + 1 })
    }
    const valueByCostCenter = [...byCenter.entries()]
      .map(([centro_costo, v]) => ({ centro_costo, nombre: master.centros.find((c) => c.centro_costo === centro_costo)?.nombre ?? "", ...v }))
      .sort((a, b) => b.total - a.total)
    const quoteVsRequest = evaluated.map(({ caseId, pkg }) => {
      const solicitud = pkg.solicitud.valor_total
      const cotizacion = pkg.cotizacion?.total ?? null
      const diferencia_pct = cotizacion === null ? null : Math.round((Math.abs(cotizacion - solicitud) / solicitud) * 1000) / 10
      return { caseId, solicitud, cotizacion, diferencia_pct }
    })
    return { findingsByRule, valueByCostCenter, quoteVsRequest }
  }

  // --- Commands ---

  async validate(caseId: string, actor: Actor): Promise<ValidationWithStatus> {
    const { pkg, result } = await this.evaluate(caseId)
    const existing = await this.deps.sap.buscarOrdenPorReferencia(pkg.solicitud.solicitud_id)
    let status: CaseStatus
    if (existing) {
      status = "po_created"
    } else if (!result.apta) {
      status = "blocked"
      await this.control(pkg, result, "bloqueada", null, actor)
    } else {
      status = this.statusFor(caseId, result)
    }
    this.track(caseId, { status, validation: result, poNumber: existing?.numero_oc ?? null })
    return { ...result, status }
  }

  async generateEvidence(caseId: string): Promise<EvidenceResult> {
    const pkg = await this.readPackage(caseId)
    if (!pkg.aprobacion) throw new Error(`El caso ${caseId} no tiene correo de aprobación; no hay evidencia que generar.`)
    const evidence = renderApprovalEvidence(pkg.aprobacion.raw)
    const ruta = await this.deps.repository.saveEvidence(caseId, evidence.document)
    return { ruta, sha256: evidence.sha256 }
  }

  async buildPayload(caseId: string): Promise<PayloadResult> {
    const { pkg, result } = await this.evaluate(caseId)
    if (!result.apta) {
      throw new Error(`No se puede construir la OC de ${caseId}: tiene bloqueos (${codesOf(result.bloqueos).join(", ")}).`)
    }
    const confirmation = this.deps.confirmations.get(caseId)
    const confirmedBy =
      confirmation?.status === "approved" && confirmation.resolvedBy
        ? `${confirmation.resolvedBy.channel}:${confirmation.resolvedBy.who}`
        : null
    const { order, traceability } = this.buildOrder(pkg, result, confirmedBy)
    const sha256 = sha256Of(order)
    const { tracePath } = await this.deps.repository.savePayload(caseId, { order, traceability, sha256 })
    const payload: PayloadResult = { orden: order, ruta_trazabilidad: tracePath, sha256_payload: sha256, trazabilidad: traceability }
    this.track(caseId, { payload })
    return payload
  }

  async process(caseId: string, actor: Actor): Promise<ProcessResult> {
    const validation = await this.validate(caseId, actor)
    if (!validation.apta) return { validacion: validation, status: validation.status, evidencia: null, payload: null }
    const evidencia = await this.generateEvidence(caseId)
    const payload = await this.buildPayload(caseId)
    return { validacion: validation, status: validation.status, evidencia, payload }
  }

  async create(caseId: string, input: { confirmed: boolean } & Actor): Promise<CreateOutcome> {
    const pkg = await this.readPackage(caseId)
    const requestId = pkg.solicitud.solicitud_id

    // 1. Idempotency: the business reference decides, not the payload.
    const existing = await this.deps.sap.buscarOrdenPorReferencia(requestId)
    if (existing) {
      const order = (await this.deps.sapReader.listOrders()).find((o) => o.numero_oc === existing.numero_oc)
      await this.control(pkg, null, "idempotente", existing.numero_oc, input)
      this.track(caseId, { status: "po_created", poNumber: existing.numero_oc })
      this.deps.events.publish({ type: "po.created", caseId, poNumber: existing.numero_oc, idempotent: true })
      return { status: "idempotent", numero_oc: existing.numero_oc, fecha: order?.fecha ?? "" }
    }

    // 2. Re-validate from the source files: nothing the caller sends can alter the order.
    const { result } = await this.evaluate(caseId, pkg)
    if (!result.apta) {
      await this.control(pkg, result, "bloqueada", null, input)
      this.track(caseId, { status: "blocked", validation: result })
      return { status: "blocked", findings: result.bloqueos }
    }

    // 3. Confirmation gate (ADR-012): approved in the central store AND confirmado=true.
    let confirmedBy: string | null = null
    if (result.confirmaciones.length > 0) {
      const confirmation = this.deps.confirmations.require(caseId, result.confirmaciones)
      if (confirmation.status === "rejected") {
        await this.control(pkg, result, "rechazada", null, input)
        this.track(caseId, { status: "rejected", validation: result })
        return { status: "rejected", reason: "La analista rechazó la confirmación de este caso; no se crea la OC." }
      }
      if (confirmation.status !== "approved" || !input.confirmed) {
        await this.control(pkg, result, "pendiente", null, input)
        this.track(caseId, { status: "awaiting_confirmation", validation: result })
        this.deps.events.publish({ type: "confirmation.pending", caseId, codes: confirmation.codes })
        const reason =
          confirmation.status !== "approved"
            ? "Requiere confirmación explícita de la analista (en el chat o en la web) antes de crear la OC."
            : "La confirmación ya fue aprobada; vuelve a llamar con confirmado=true."
        return { status: "needs_confirmation", findings: result.confirmaciones, reason }
      }
      confirmedBy = confirmation.resolvedBy ? `${confirmation.resolvedBy.channel}:${confirmation.resolvedBy.who}` : actorLabel(input)
    }

    // 4. Build, persist artifacts and send to SAP.
    const evidence = renderApprovalEvidence(pkg.aprobacion!.raw)
    await this.deps.repository.saveEvidence(caseId, evidence.document)
    const { order, traceability } = this.buildOrder(pkg, result, confirmedBy)
    const sha256 = sha256Of(order)
    const { tracePath } = await this.deps.repository.savePayload(caseId, { order, traceability, sha256 })
    const created = await this.deps.sap.crearOrden(order)
    await this.control(pkg, result, "creada", created.numero_oc, input)
    const payload: PayloadResult = { orden: order, ruta_trazabilidad: tracePath, sha256_payload: sha256, trazabilidad: traceability }
    this.track(caseId, { status: "po_created", validation: result, poNumber: created.numero_oc, payload })
    this.deps.events.publish({ type: "po.created", caseId, poNumber: created.numero_oc, idempotent: false })
    return { status: "created", ...created }
  }

  async confirm(caseId: string, input: { approved: boolean } & Actor): Promise<Confirmation> {
    let confirmation = this.deps.confirmations.get(caseId)
    if (!confirmation) {
      await this.validate(caseId, input)
      confirmation = this.deps.confirmations.get(caseId)
    }
    if (!confirmation) throw new Error(`El caso ${caseId} no tiene confirmaciones pendientes.`)
    const by = { channel: input.channel, who: input.who ?? "analista", at: this.deps.clock.now().toISOString() }
    const resolved = this.deps.confirmations.resolve(caseId, input.approved, by)!
    this.deps.events.publish({ type: "confirmation.resolved", caseId, approved: input.approved, by: `${by.channel}:${by.who}` })
    const record = this.records.get(caseId)
    if (record?.status !== "po_created") this.track(caseId, { status: input.approved ? "ready" : "rejected" })
    if (!input.approved) {
      const pkg = await this.readPackage(caseId)
      await this.control(pkg, record?.validation ?? null, "rechazada", null, input)
    }
    return resolved
  }

  async recordActivity(record: Omit<ToolLogRecord, "ts">): Promise<void> {
    const ts = this.deps.clock.now().toISOString()
    await this.deps.repository.appendToolLog({ ...record, ts })
    this.deps.events.publish({
      type: "tool.called",
      channel: record.canal,
      tool: record.herramienta,
      caseId: record.caso,
      ok: record.ok,
      summary: record.resumen,
    })
  }

  async reset(): Promise<void> {
    this.records.clear()
    this.deps.confirmations.reset()
    // Sequential on purpose: both adapters delete folders under out/.
    await this.deps.sapReader.reset()
    await this.deps.repository.reset()
    this.deps.events.publish({ type: "system.reset" })
  }

  // --- Internals ---

  private async evaluate(caseId: string, pkg?: CasePackage): Promise<{ pkg: CasePackage; result: ValidationResult; master: MasterData }> {
    const casePkg = pkg ?? (await this.readPackage(caseId))
    const master = await this.deps.dataSource.loadMasterData()
    return { pkg: casePkg, result: validatePackage(casePkg, master), master }
  }

  private statusFor(caseId: string, result: ValidationResult): CaseStatus {
    if (result.confirmaciones.length === 0) {
      this.deps.confirmations.clear(caseId)
      return "ready"
    }
    const confirmation = this.deps.confirmations.require(caseId, result.confirmaciones)
    if (confirmation.status === "pending") {
      this.deps.events.publish({ type: "confirmation.pending", caseId, codes: confirmation.codes })
    }
    return statusAfterValidation({
      eligible: true,
      pendingConfirmations: confirmation.status !== "approved",
      confirmationRejected: confirmation.status === "rejected",
    })
  }

  private buildOrder(pkg: CasePackage, result: ValidationResult, confirmedBy: string | null) {
    if (!pkg.aprobacion) throw new Error("No hay aprobación; no se puede construir la OC.")
    const evidence = renderApprovalEvidence(pkg.aprobacion.raw)
    return new PurchaseOrderBuilder(pkg, result)
      .withReference()
      .withSupplier()
      .withCommercialTerms()
      .withApprover(evidence.sha256)
      .withItem()
      .withExceptions(confirmedBy)
      .build()
  }

  private async control(
    pkg: CasePackage,
    result: ValidationResult | null,
    outcome: ControlResult,
    poNumber: string | null,
    actor: Actor,
  ): Promise<void> {
    const record: ControlRecord = {
      solicitud_id: pkg.solicitud.solicitud_id,
      resultado: outcome,
      numero_oc: poNumber,
      retroactiva: result?.retroactiva ?? false,
      bloqueos: result ? codesOf(result.bloqueos) : [],
      confirmaciones: result ? codesOf(result.confirmaciones) : [],
      ts: this.deps.clock.now().toISOString(),
      canal: actor.channel,
    }
    await this.deps.repository.appendControl(record)
  }

  private track(caseId: string, patch: Partial<CaseRecord>): void {
    const current = this.records.get(caseId) ?? { status: "not_processed", validation: null, poNumber: null, payload: null }
    const next = { ...current, ...patch }
    this.records.set(caseId, next)
    if (patch.status) this.deps.events.publish({ type: "case.updated", caseId, status: patch.status })
  }

  private async summarize(caseId: string, orders: { numero_oc: string; solicitud_id: string }[]): Promise<CaseSummary> {
    const pkg = await this.readPackage(caseId)
    const record = this.records.get(caseId)
    const order = orders.find((o) => o.solicitud_id === pkg.solicitud.solicitud_id)
    const status: CaseStatus = order ? "po_created" : (record?.status ?? "not_processed")
    return {
      caseId,
      solicitud_id: pkg.solicitud.solicitud_id,
      descripcion: pkg.solicitud.descripcion,
      proveedor: pkg.solicitud.proveedor_nombre,
      centro_costo: pkg.solicitud.centro_costo,
      subarea: pkg.solicitud.subarea,
      valor_total: pkg.solicitud.valor_total,
      moneda: pkg.solicitud.moneda,
      status,
      statusLabel: STATUS_LABEL[status],
      bloqueos: record?.validation ? codesOf(record.validation.bloqueos) : [],
      confirmaciones: record?.validation ? codesOf(record.validation.confirmaciones) : [],
      retroactiva: record?.validation?.retroactiva ?? false,
      numero_oc: order?.numero_oc ?? record?.poNumber ?? null,
    }
  }
}
