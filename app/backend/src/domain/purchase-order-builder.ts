import {
  PurchaseOrderSchema,
  type CasePackage,
  type PurchaseOrder,
  type Traceability,
  type TraceSource,
  type ValidationResult,
} from "@oc/contracts"
import { dateOnly } from "./normalize"

const SHORT_TEXT_MAX = 40 // SAP short text limit (PRD 7.4)
const FIRST_ITEM = 10

type Unit = PurchaseOrder["posiciones"][number]["unidad"]

export function deriveUnit(description: string): Unit {
  if (/\bhoras?\b/i.test(description)) return "H"
  if (/\b(mensual|mensualidad|por mes)\b/i.test(description)) return "MES"
  return "UN"
}

/**
 * Builder: assembles the purchase order step by step and records where every value
 * comes from (traceability). `build()` validates the result against the PRD schema.
 */
export class PurchaseOrderBuilder {
  private readonly draft: Record<string, unknown> = { sociedad: "1000", organizacion_compras: "1000" }
  private readonly trace: Traceability = { sociedad: "derivado:constante", organizacion_compras: "derivado:constante" }

  constructor(
    private readonly pkg: CasePackage,
    private readonly validation: ValidationResult,
  ) {}

  private set(path: string, value: unknown, source: TraceSource): void {
    this.draft[path] = value
    this.trace[path] = source
  }

  withReference(): this {
    this.set(
      "referencia",
      {
        solicitud_id: this.pkg.solicitud.solicitud_id,
        correo_id: this.pkg.correo.id,
        cotizacion_ref: this.pkg.cotizacion?.ref ?? null,
      },
      "solicitud",
    )
    this.trace["referencia.correo_id"] = "derivado:correo"
    this.trace["referencia.cotizacion_ref"] = "cotizacion"
    return this
  }

  withSupplier(): this {
    const supplier = this.validation.derivados.proveedor
    if (!supplier) throw new Error("No hay proveedor resuelto; la solicitud no es apta.")
    this.set("proveedor", { codigo_sap: supplier.codigo_sap, nit: supplier.nit, nombre: supplier.nombre }, "maestro.proveedores")
    return this
  }

  withCommercialTerms(): this {
    this.set("moneda", this.pkg.solicitud.moneda, "solicitud")
    const terms = this.validation.derivados.condiciones_pago
    if (!terms) throw new Error("No hay condiciones de pago ni en la solicitud ni en el proveedor.")
    this.set("condiciones_pago", terms.valor, terms.fuente === "derivado" ? "derivado" : "solicitud")
    return this
  }

  withApprover(evidenceSha256: string): this {
    const approval = this.pkg.aprobacion
    if (!approval) throw new Error("No hay aprobación; la solicitud no es apta.")
    this.set(
      "aprobador",
      { email: approval.de, fecha_aprobacion: dateOnly(approval.fecha), evidencia_sha256: evidenceSha256 },
      "derivado:aprobacion",
    )
    this.trace["aprobador.evidencia_sha256"] = "derivado"
    return this
  }

  withItem(): this {
    const request = this.pkg.solicitud
    const vat = this.validation.derivados.indicador_iva
    if (!vat) throw new Error("No hay indicador de IVA ni en la solicitud ni en el proveedor.")
    const description = request.descripcion.slice(0, SHORT_TEXT_MAX).trim()
    this.set(
      "posiciones",
      [
        {
          numero: FIRST_ITEM,
          descripcion: description,
          cantidad: request.cantidad,
          unidad: deriveUnit(request.descripcion),
          precio_unitario: request.valor_unitario,
          centro_costo: request.centro_costo,
          subarea: request.subarea,
          indicador_iva: vat.valor,
        },
      ],
      "solicitud",
    )
    this.trace["posiciones[0].numero"] = "derivado:constante"
    this.trace["posiciones[0].unidad"] = "derivado"
    this.trace["posiciones[0].indicador_iva"] = vat.fuente === "derivado" ? "derivado" : "solicitud"
    if (description.length < request.descripcion.length) this.trace["posiciones[0].descripcion"] = "derivado"
    return this
  }

  /** One exception per confirmation; `confirmedBy` is null until a human approves. */
  withExceptions(confirmedBy: string | null): this {
    const exceptions = this.validation.confirmaciones.map((c) => ({
      codigo: c.code,
      detalle: c.detail,
      confirmado_por: confirmedBy,
    }))
    this.set("excepciones", exceptions, "derivado:validacion")
    return this
  }

  build(): { order: PurchaseOrder; traceability: Traceability } {
    const order = PurchaseOrderSchema.parse(this.draft)
    return { order, traceability: { ...this.trace } }
  }
}
