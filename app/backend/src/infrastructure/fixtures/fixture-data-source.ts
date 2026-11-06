import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import type { DataSource } from "../../application/ports/data-source"
import type { RawCaseFiles } from "../../domain/case-package"
import { CodeEntrySchema, CostCenterSchema, SupplierSchema, type MasterData } from "@oc/contracts"

const CASE_ID = /^[a-z0-9-]{1,40}$/

/** Adapter: reads the read-only fixtures delivered with the PRD. */
export class FixtureDataSource implements DataSource {
  private readonly casesDir: string
  private readonly masterDir: string
  private masterCache: MasterData | null = null

  constructor(rootDir: string) {
    this.casesDir = join(rootDir, "fixtures/reto-03/solicitudes")
    this.masterDir = join(rootDir, "fixtures/reto-03/maestros")
  }

  async listCases(): Promise<string[]> {
    const entries = await readdir(this.casesDir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
  }

  async loadRawCase(caseId: string): Promise<RawCaseFiles> {
    if (!CASE_ID.test(caseId)) throw new Error(`Identificador de caso inválido: "${caseId}".`)
    const dir = join(this.casesDir, caseId)
    if (!(await Bun.file(join(dir, "solicitud.json")).exists())) {
      throw new Error(`El caso "${caseId}" no existe. Casos disponibles: ${(await this.listCases()).join(", ")}.`)
    }
    const [correo, solicitud, aprobacion, cotizacion, factura] = await Promise.all([
      readJson(join(dir, "correo.json")),
      readJson(join(dir, "solicitud.json")),
      readJson(join(dir, "aprobacion.json")),
      readText(join(dir, "cotizacion.txt")),
      readText(join(dir, "factura.txt")),
    ])
    return { caso: caseId, correo, solicitud, aprobacion, cotizacion, factura }
  }

  async loadMasterData(): Promise<MasterData> {
    if (this.masterCache) return this.masterCache
    const [proveedores, centros, iva, condiciones] = await Promise.all([
      readJson(join(this.masterDir, "proveedores.json")).then((d) => z.array(SupplierSchema).parse(d)),
      readJson(join(this.masterDir, "centros-costo.json")).then((d) => z.array(CostCenterSchema).parse(d)),
      readJson(join(this.masterDir, "indicadores-iva.json")).then((d) => z.array(CodeEntrySchema).parse(d)),
      readJson(join(this.masterDir, "condiciones-pago.json")).then((d) => z.array(CodeEntrySchema).parse(d)),
    ])
    this.masterCache = { proveedores, centros, iva, condiciones }
    return this.masterCache
  }
}

async function readText(path: string): Promise<string | null> {
  const file = Bun.file(path)
  return (await file.exists()) ? file.text() : null
}

async function readJson(path: string): Promise<unknown> {
  const text = await readText(path)
  if (text === null) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`El archivo ${path.split("/").slice(-2).join("/")} no es un JSON válido.`)
  }
}
