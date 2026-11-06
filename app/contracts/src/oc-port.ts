import type { CaseStatus } from "./case-status"
import type { Confirmation } from "./confirmation"
import type { CasePackage, Finding, MasterData, PurchaseOrder, Traceability, ValidationResult } from "./model"
import type { Channel, ControlRecord, StoredOrder, ToolLogRecord } from "./records"

export type RuleKind = "block" | "confirmation" | "derived"

export type CaseSummary = {
  caseId: string
  solicitud_id: string
  descripcion: string
  proveedor: string
  centro_costo: string
  subarea: string
  valor_total: number
  moneda: string
  status: CaseStatus
  statusLabel: string
  bloqueos: string[]
  confirmaciones: string[]
  retroactiva: boolean
  numero_oc: string | null
}

export type EvidenceResult = { ruta: string; sha256: string }

export type PayloadResult = {
  orden: PurchaseOrder
  ruta_trazabilidad: string
  sha256_payload: string
  trazabilidad: Traceability
}

export type CreateOutcome =
  | { status: "created" | "idempotent"; numero_oc: string; fecha: string }
  | { status: "blocked"; findings: Finding[] }
  | { status: "needs_confirmation"; findings: Finding[]; reason: string }
  | { status: "rejected"; reason: string }

export type ValidationWithStatus = ValidationResult & { status: CaseStatus }

export type ProcessResult = {
  validacion: ValidationWithStatus
  status: CaseStatus
  evidencia: EvidenceResult | null
  payload: PayloadResult | null
}

export type CaseDocument = { nombre: string; contenido: string }

export type CaseDetail = {
  summary: CaseSummary
  documents: CaseDocument[]
  validacion: ValidationResult | null
  payload: PayloadResult | null
  confirmacion: Confirmation | null
}

export type RuleInfo = { id: string; description: string; kind: RuleKind }

/** Read-only analytics for the dashboard: a dry-run validation of every case (no events, no writes). */
export type Insights = {
  findingsByRule: (RuleInfo & { count: number; cases: string[] })[]
  valueByCostCenter: { centro_costo: string; nombre: string; total: number; cases: number }[]
  quoteVsRequest: { caseId: string; solicitud: number; cotizacion: number | null; diferencia_pct: number | null }[]
}

export type Snapshot = {
  cases: CaseSummary[]
  confirmations: Confirmation[]
  orders: StoredOrder[]
  control: ControlRecord[]
  activity: ToolLogRecord[]
  rules: RuleInfo[]
  insights: Insights
}

export type Actor = { channel: Channel; who?: string }

/**
 * Input port of the purchase-order use cases. The backend implements it in process;
 * the agent consumes it over HTTP. Same contract, so channels behave identically.
 */
export interface OcPort {
  listCases(): Promise<CaseSummary[]>
  readPackage(caseId: string): Promise<CasePackage>
  validate(caseId: string, actor: Actor): Promise<ValidationWithStatus>
  generateEvidence(caseId: string): Promise<EvidenceResult>
  buildPayload(caseId: string): Promise<PayloadResult>
  create(caseId: string, input: { confirmed: boolean } & Actor): Promise<CreateOutcome>
  confirm(caseId: string, input: { approved: boolean } & Actor): Promise<Confirmation>
  process(caseId: string, actor: Actor): Promise<ProcessResult>
  caseDetail(caseId: string): Promise<CaseDetail>
  getConfirmation(caseId: string): Promise<Confirmation | null>
  masterData(): Promise<MasterData>
  snapshot(): Promise<Snapshot>
  recordActivity(record: Omit<ToolLogRecord, "ts">): Promise<void>
  reset(): Promise<void>
}
