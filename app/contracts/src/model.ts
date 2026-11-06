import { z } from "zod"

/*
 * Domain model. Type names are English; JSON field names follow the PRD contract
 * (fixtures, normalized package, purchase order payload), so they stay in Spanish.
 */

// --- Raw inputs (PRD 7.1) ---

export const PurchaseRequestSchema = z.object({
  solicitud_id: z.string().min(1),
  solicitante: z.string().min(1),
  proveedor_nombre: z.string().min(1),
  proveedor_nit: z.string().optional(),
  descripcion: z.string().min(1),
  centro_costo: z.string().min(1),
  subarea: z.string().min(1),
  cantidad: z.number().positive(),
  valor_unitario: z.number().nonnegative(),
  valor_total: z.number().positive(),
  moneda: z.string().min(1),
  indicador_iva: z.string().optional(),
  condiciones_pago: z.string().optional(),
  fecha_solicitud: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>

export const EmailSchema = z.object({
  id: z.string(),
  de: z.string(),
  asunto: z.string(),
  fecha: z.string(),
})
export type Email = z.infer<typeof EmailSchema>

export const RawApprovalSchema = z.object({
  de: z.string(),
  para: z.string().optional(),
  cc: z.array(z.string()).optional(),
  fecha: z.string(),
  asunto: z.string().optional(),
  cuerpo: z.string(),
})
export type RawApproval = z.infer<typeof RawApprovalSchema>

// --- Normalized package (PRD 7.2) ---

export type Quote = {
  ref: string | null
  proveedor: string
  nit: string | null
  total: number
  moneda: string
  validez_hasta: string | null
  texto: string
}

export type Approval = {
  de: string
  fecha: string
  aprobado: boolean
  texto: string
  raw: RawApproval
}

export type Invoice = { numero: string; fecha: string; total: number }

export type CasePackage = {
  caso: string
  correo: Email
  solicitud: PurchaseRequest
  cotizacion: Quote | null
  aprobacion: Approval | null
  factura: Invoice | null
  /** Names of the attachments that were expected but are missing. */
  faltantes: string[]
}

// --- Master data ---

export const SupplierSchema = z.object({
  codigo_sap: z.string(),
  nit: z.string(),
  nombre: z.string(),
  condiciones_pago_default: z.string(),
  indicador_iva_default: z.string(),
  activo: z.boolean(),
})
export type Supplier = z.infer<typeof SupplierSchema>

export const CostCenterSchema = z.object({
  centro_costo: z.string(),
  nombre: z.string(),
  subareas: z.array(z.string()),
  aprobadores: z.array(z.object({ email: z.string(), nombre: z.string(), tope: z.number() })),
})
export type CostCenter = z.infer<typeof CostCenterSchema>

export const CodeEntrySchema = z.looseObject({ codigo: z.string(), descripcion: z.string() })
export type CodeEntry = z.infer<typeof CodeEntrySchema>

export type MasterData = {
  proveedores: Supplier[]
  centros: CostCenter[]
  iva: CodeEntry[]
  condiciones: CodeEntry[]
}

// --- Validation result (PRD: { apta, bloqueos[], confirmaciones[], derivados, retroactiva }) ---

export type Finding = {
  code: string
  rule: string
  detail: string
  values?: Record<string, string | number | boolean | null>
}

export type DerivedValue = { valor: string; fuente: "solicitud" | "derivado" }

export type Derived = {
  proveedor?: Supplier
  proveedor_resuelto_por?: "nit" | "nombre"
  indicador_iva?: DerivedValue
  condiciones_pago?: DerivedValue
}

export type ValidationResult = {
  apta: boolean
  bloqueos: Finding[]
  confirmaciones: Finding[]
  derivados: Derived
  retroactiva: boolean
}

// --- Purchase order payload (PRD 7.4) ---

export const PurchaseOrderSchema = z.object({
  referencia: z.object({
    solicitud_id: z.string(),
    correo_id: z.string(),
    cotizacion_ref: z.string().nullable(),
  }),
  sociedad: z.literal("1000"),
  organizacion_compras: z.literal("1000"),
  proveedor: z.object({ codigo_sap: z.string(), nit: z.string(), nombre: z.string() }),
  moneda: z.enum(["COP", "USD"]),
  condiciones_pago: z.string().min(1),
  aprobador: z.object({
    email: z.string(),
    fecha_aprobacion: z.string(),
    evidencia_sha256: z.string().length(64),
  }),
  posiciones: z
    .array(
      z.object({
        numero: z.number().int(),
        descripcion: z.string().max(40),
        cantidad: z.number().positive(),
        unidad: z.enum(["UN", "H", "MES"]),
        precio_unitario: z.number().nonnegative(),
        centro_costo: z.string(),
        subarea: z.string(),
        indicador_iva: z.string(),
      }),
    )
    .min(1),
  excepciones: z.array(
    z.object({ codigo: z.string(), detalle: z.string(), confirmado_por: z.string().nullable() }),
  ),
})
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>

/**
 * PRD HU-3: every payload value traces to `solicitud`, `cotizacion`, `maestro.<nombre>` or `derivado`.
 * Derived values say what they were derived from (`derivado:<origen>`) so the trail stays precise.
 */
export type TraceSource =
  | "solicitud"
  | "cotizacion"
  | "maestro.proveedores"
  | "derivado"
  | "derivado:aprobacion"
  | "derivado:correo"
  | "derivado:constante"
  | "derivado:validacion"

export type Traceability = Record<string, TraceSource>
