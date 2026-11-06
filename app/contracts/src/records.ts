import type { PurchaseOrder } from "./model"

export type Channel = "chat" | "web" | "mcp" | "a2a" | "demo"

export type ControlResult = "creada" | "idempotente" | "bloqueada" | "pendiente" | "rechazada"

/** One row of out/control.csv per attempt (PRD HU-5) plus the channel that triggered it. */
export type ControlRecord = {
  solicitud_id: string
  resultado: ControlResult
  numero_oc: string | null
  retroactiva: boolean
  bloqueos: string[]
  confirmaciones: string[]
  ts: string
  canal: Channel
}

/** One line of out/log.jsonl (PRD RN/CA4): { ts, herramienta, ok, resumen } plus case and channel. */
export type ToolLogRecord = {
  ts: string
  herramienta: string
  caso: string | null
  ok: boolean
  resumen: string
  canal: Channel
}

export type StoredOrder = { numero_oc: string; fecha: string; solicitud_id: string; orden: PurchaseOrder }
