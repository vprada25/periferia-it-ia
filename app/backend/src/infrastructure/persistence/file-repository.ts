import { appendFile, mkdir, rm } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import type { ControlRecord, ToolLogRecord } from "@oc/contracts"
import type { Repository, StoredPayload } from "../../application/ports/repository"
import { SerialQueue } from "./serial-queue"

const CONTROL_HEADER = "solicitud_id,resultado,numero_oc,retroactiva,bloqueos,confirmaciones,ts,canal"

/** Adapter: writes the PRD artifacts under out/ (control.csv, log.jsonl, evidence, payload, traceability). */
export class FileRepository implements Repository {
  private readonly queue = new SerialQueue()

  constructor(
    private readonly rootDir: string,
    private readonly outDir = join(rootDir, "out"),
  ) {}

  private path(...parts: string[]): string {
    return join(this.outDir, ...parts)
  }

  private rel(path: string): string {
    return relative(this.rootDir, path)
  }

  private async write(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await Bun.write(path, content)
  }

  async reset(): Promise<void> {
    await this.queue.run(() => rm(this.outDir, { recursive: true, force: true }))
  }

  async saveEvidence(caseId: string, document: string): Promise<string> {
    const path = this.path(caseId, "aprobacion.txt")
    await this.queue.run(() => this.write(path, document))
    return this.rel(path)
  }

  async savePayload(caseId: string, payload: StoredPayload) {
    const payloadPath = this.path(caseId, "payload.json")
    const tracePath = this.path(caseId, "trazabilidad.json")
    await this.queue.run(async () => {
      await this.write(payloadPath, JSON.stringify({ sha256: payload.sha256, orden: payload.order }, null, 2))
      await this.write(tracePath, JSON.stringify(payload.traceability, null, 2))
    })
    return { payloadPath: this.rel(payloadPath), tracePath: this.rel(tracePath) }
  }

  async loadPayload(caseId: string): Promise<StoredPayload | null> {
    const payloadFile = Bun.file(this.path(caseId, "payload.json"))
    const traceFile = Bun.file(this.path(caseId, "trazabilidad.json"))
    if (!(await payloadFile.exists()) || !(await traceFile.exists())) return null
    const stored = (await payloadFile.json()) as { sha256: string; orden: StoredPayload["order"] }
    return { order: stored.orden, sha256: stored.sha256, traceability: (await traceFile.json()) as StoredPayload["traceability"] }
  }

  async appendControl(record: ControlRecord): Promise<void> {
    const path = this.path("control.csv")
    const row = [
      record.solicitud_id,
      record.resultado,
      record.numero_oc ?? "",
      String(record.retroactiva),
      record.bloqueos.join(";"),
      record.confirmaciones.join(";"),
      record.ts,
      record.canal,
    ].join(",")
    await this.queue.run(async () => {
      await mkdir(this.outDir, { recursive: true })
      const exists = await Bun.file(path).exists()
      await appendFile(path, `${exists ? "" : `${CONTROL_HEADER}\n`}${row}\n`)
    })
  }

  async listControl(): Promise<ControlRecord[]> {
    const file = Bun.file(this.path("control.csv"))
    if (!(await file.exists())) return []
    const [, ...rows] = (await file.text()).trim().split("\n")
    return rows.map((row) => {
      const [solicitud_id = "", resultado, numero_oc, retroactiva, bloqueos, confirmaciones, ts = "", canal] = row.split(",")
      return {
        solicitud_id,
        resultado: resultado as ControlRecord["resultado"],
        numero_oc: numero_oc || null,
        retroactiva: retroactiva === "true",
        bloqueos: bloqueos ? bloqueos.split(";") : [],
        confirmaciones: confirmaciones ? confirmaciones.split(";") : [],
        ts,
        canal: canal as ControlRecord["canal"],
      }
    })
  }

  async appendToolLog(record: ToolLogRecord): Promise<void> {
    await this.queue.run(async () => {
      await mkdir(this.outDir, { recursive: true })
      await appendFile(this.path("log.jsonl"), `${JSON.stringify(record)}\n`)
    })
  }

  async listToolLog(limit: number): Promise<ToolLogRecord[]> {
    const file = Bun.file(this.path("log.jsonl"))
    if (!(await file.exists())) return []
    const lines = (await file.text()).trim().split("\n").filter(Boolean)
    return lines.slice(-limit).map((line) => JSON.parse(line) as ToolLogRecord)
  }
}
