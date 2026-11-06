import type {
  Actor,
  CaseDetail,
  CasePackage,
  CaseSummary,
  Confirmation,
  CreateOutcome,
  EvidenceResult,
  MasterData,
  OcPort,
  PayloadResult,
  ProcessResult,
  Snapshot,
  ToolLogRecord,
  ValidationWithStatus,
} from "@oc/contracts"

type Method = "GET" | "POST"

/**
 * Adapter: OcPort over the backend's HTTP API. The agent never imports backend code;
 * it only knows the shared contract (ADR-016/018).
 */
export class OcHttpClient implements OcPort {
  constructor(
    private readonly baseUrl: string,
    private readonly accessKey?: string,
  ) {}

  private async call<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.accessKey ? { Authorization: `Bearer ${this.accessKey}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const payload = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      const message = (payload as { error?: string } | null)?.error ?? `El backend respondió ${response.status}.`
      throw new Error(message)
    }
    return payload as T
  }

  listCases = () => this.call<CaseSummary[]>("GET", "/api/cases")
  readPackage = (caseId: string) => this.call<CasePackage>("GET", `/api/cases/${caseId}/package`)
  validate = (caseId: string, actor: Actor) => this.call<ValidationWithStatus>("POST", `/api/cases/${caseId}/validate`, actor)
  generateEvidence = (caseId: string) => this.call<EvidenceResult>("POST", `/api/cases/${caseId}/evidence`)
  buildPayload = (caseId: string) => this.call<PayloadResult>("POST", `/api/cases/${caseId}/payload`)
  create = (caseId: string, input: { confirmed: boolean } & Actor) =>
    this.call<CreateOutcome>("POST", `/api/cases/${caseId}/create`, input)
  confirm = (caseId: string, input: { approved: boolean } & Actor) =>
    this.call<Confirmation>("POST", `/api/confirmations/${caseId}`, { approve: input.approved, channel: input.channel, who: input.who })
  process = (caseId: string, actor: Actor) => this.call<ProcessResult>("POST", `/api/cases/${caseId}/process`, actor)
  caseDetail = (caseId: string) => this.call<CaseDetail>("GET", `/api/cases/${caseId}`)
  getConfirmation = (caseId: string) => this.call<Confirmation | null>("GET", `/api/confirmations/${caseId}`)
  masterData = () => this.call<MasterData>("GET", "/api/master-data")
  snapshot = () => this.call<Snapshot>("GET", "/api/state")
  recordActivity = async (record: Omit<ToolLogRecord, "ts">) => {
    await this.call<{ ok: true }>("POST", "/api/activity", record)
  }
  reset = async () => {
    await this.call<{ ok: true }>("POST", "/api/reset")
  }
}
