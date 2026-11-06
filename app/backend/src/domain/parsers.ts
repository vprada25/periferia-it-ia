import type { Approval, Invoice, Quote, RawApproval } from "@oc/contracts"
import { addDays, normalizeTaxId, parseAmount } from "./normalize"

const APPROVED = /\baprobad[oa]\b/i

function capture(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[1]?.trim() ?? null
}

/** Parses the supplier quote text (fixtures/…/cotizacion.txt). */
export function parseQuote(text: string): Quote {
  const ref = capture(text, /COTIZACI[ÓO]N\s+(\S+)/i)
  const issuedOn = capture(text, /^Fecha:\s*(\d{4}-\d{2}-\d{2})/im)
  const supplier = capture(text, /^Proveedor:\s*(.+)$/im) ?? ""
  const taxId = capture(text, /^NIT:\s*([\d.\-]+)/im)
  const totalLine = capture(text, /^TOTAL[^:]*:\s*(.+)$/im)
  const total = totalLine ? parseAmount(totalLine) : null
  const validityDays = capture(text, /Validez de la oferta:\s*(\d+)\s*d[ií]as/i)
  if (total === null) throw new Error("La cotización no tiene un TOTAL legible.")
  return {
    ref,
    proveedor: supplier,
    nit: taxId ? normalizeTaxId(taxId) : null,
    total,
    moneda: totalLine?.match(/\b(COP|USD)\b/)?.[1] ?? "COP",
    validez_hasta: issuedOn && validityDays ? addDays(issuedOn, Number(validityDays)) : null,
    texto: text,
  }
}

/** Parses the invoice text (fixtures/…/factura.txt). */
export function parseInvoice(text: string): Invoice {
  const number = capture(text, /No\.\s*(\S+)/i)
  const issuedOn = capture(text, /Fecha de emisi[óo]n:\s*(\d{4}-\d{2}-\d{2})/i)
  const totalLine = capture(text, /^TOTAL:\s*(.+)$/im)
  const total = totalLine ? parseAmount(totalLine) : null
  if (!number || !issuedOn || total === null) {
    throw new Error("La factura no tiene número, fecha o total legibles.")
  }
  return { numero: number, fecha: issuedOn, total }
}

export function parseApproval(raw: RawApproval): Approval {
  return { de: raw.de, fecha: raw.fecha, aprobado: APPROVED.test(raw.cuerpo), texto: raw.cuerpo, raw }
}
