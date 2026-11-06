/** "900.555.111-2" → "900555111" (no dots, spaces or check digit). */
export function normalizeTaxId(taxId: string): string {
  const withoutCheckDigit = taxId.split("-")[0] ?? taxId
  return withoutCheckDigit.replace(/[^\d]/g, "")
}

const COMPANY_SUFFIX = /\b(s\.?\s?a\.?\s?s\.?|s\.?\s?a\.?|ltda\.?|sas)\s*$/i

/** "TecnoSuministros S.A.S." → "tecnosuministros" */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(COMPANY_SUFFIX, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** "2026-08-21T10:02:00-05:00" → "2026-08-21" (local date as written). */
export function dateOnly(value: string): string {
  return value.slice(0, 10)
}

/** "COP 11.400.000" → 11400000 (Colombian format: dot = thousands, comma = decimals). */
export function parseAmount(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)/)
  if (!match?.[1]) return null
  const value = Number(match[1].replace(/\./g, "").replace(",", "."))
  return Number.isFinite(value) ? value : null
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const formatCop = (value: number) => value.toLocaleString("es-CO")
