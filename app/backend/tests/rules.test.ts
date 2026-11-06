import { describe, expect, test } from "bun:test"
import { buildCasePackage } from "../src/domain/case-package"
import { renderApprovalEvidence } from "../src/domain/evidence"
import { PurchaseOrderBuilder, deriveUnit } from "../src/domain/purchase-order-builder"
import { validatePackage } from "../src/domain/rules"
import { FixtureDataSource } from "../src/infrastructure/fixtures/fixture-data-source"

const source = new FixtureDataSource(`${import.meta.dir}/../../..`)

async function validateCase(caseId: string) {
  const pkg = buildCasePackage(await source.loadRawCase(caseId))
  return { pkg, result: validatePackage(pkg, await source.loadMasterData()) }
}

const codes = (findings: { code: string }[]) => findings.map((f) => f.code)

// Expected results: SPEC §6 (computed by hand from the fixtures).
describe("control rules RC1–RC10 against the PRD cases", () => {
  test("sol-001: eligible, no confirmations", async () => {
    const { result } = await validateCase("sol-001")
    expect(result.apta).toBe(true)
    expect(result.bloqueos).toEqual([])
    expect(result.confirmaciones).toEqual([])
    expect(result.retroactiva).toBe(false)
  })

  test("sol-002: unknown supplier blocks (RC1)", async () => {
    const { result } = await validateCase("sol-002")
    expect(result.apta).toBe(false)
    expect(codes(result.bloqueos)).toEqual(["SUPPLIER_NOT_FOUND"])
  })

  test("sol-003: approver from another cost center blocks (RC2), limit exceeded as aggravating (RC3)", async () => {
    const { result } = await validateCase("sol-003")
    expect(result.apta).toBe(false)
    expect(codes(result.bloqueos)).toEqual(["APPROVER_NOT_AUTHORIZED", "APPROVER_LIMIT_EXCEEDED"])
  })

  test("sol-004: quote differs 6 % → confirmation (RC5)", async () => {
    const { result } = await validateCase("sol-004")
    expect(result.apta).toBe(true)
    expect(codes(result.confirmaciones)).toEqual(["QUOTE_MISMATCH"])
    expect(result.confirmaciones[0]?.values).toEqual({ solicitud: 25000000, cotizacion: 26500000, diferencia_pct: 6 })
  })

  test("sol-005: invoice before request → retroactive confirmation (RC8)", async () => {
    const { result } = await validateCase("sol-005")
    expect(result.apta).toBe(true)
    expect(codes(result.confirmaciones)).toEqual(["RETROACTIVE_PO"])
    expect(result.retroactiva).toBe(true)
  })

  test("sol-006: supplier by name, derived VAT (RC6) and payment terms (RC7)", async () => {
    const { result } = await validateCase("sol-006")
    expect(result.apta).toBe(true)
    expect(result.derivados.proveedor_resuelto_por).toBe("nombre")
    expect(codes(result.confirmaciones)).toEqual(["VAT_DERIVED"])
    expect(result.derivados.indicador_iva).toEqual({ valor: "C1", fuente: "derivado" })
    expect(result.derivados.condiciones_pago).toEqual({ valor: "Z030", fuente: "derivado" })
  })
})

describe("purchase order builder", () => {
  test("builds a schema-valid order with traceability (sol-004)", async () => {
    const { pkg, result } = await validateCase("sol-004")
    const evidence = renderApprovalEvidence(pkg.aprobacion!.raw)
    const { order, traceability } = new PurchaseOrderBuilder(pkg, result)
      .withReference()
      .withSupplier()
      .withCommercialTerms()
      .withApprover(evidence.sha256)
      .withItem()
      .withExceptions(null)
      .build()
    expect(order.proveedor.codigo_sap).toBe("100310")
    expect(order.posiciones[0]?.unidad).toBe("H")
    expect(order.posiciones[0]?.precio_unitario).toBe(250000)
    expect(order.excepciones.map((e) => e.codigo)).toEqual(["QUOTE_MISMATCH"])
    expect(traceability.proveedor).toBe("maestro.proveedores")
  })

  test("evidence hash is deterministic", async () => {
    const { pkg } = await validateCase("sol-001")
    expect(renderApprovalEvidence(pkg.aprobacion!.raw).sha256).toBe(renderApprovalEvidence(pkg.aprobacion!.raw).sha256)
  })

  test("unit derivation", () => {
    expect(deriveUnit("Bolsa de 100 horas de arquitectura")).toBe("H")
    expect(deriveUnit("Renovación licencias antivirus, vigencia 12 meses")).toBe("UN")
  })
})
