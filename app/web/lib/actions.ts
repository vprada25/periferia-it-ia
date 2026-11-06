"use server"

import type { Confirmation, CreateOutcome, ProcessResult } from "@oc/contracts"
import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { hasWebAccess } from "./auth"
import { backend } from "./backend"
import { ACCESS_COOKIE, serverEnv } from "./env"

export type ActionState = { ok: boolean; message: string } | null

async function guarded(run: () => Promise<string>): Promise<ActionState> {
  if (!(await hasWebAccess())) return { ok: false, message: "Inicia sesión para operar." }
  try {
    const message = await run()
    refresh()
    return { ok: true, message }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Error inesperado." }
  }
}

export async function processCase(caseId: string, _prev: ActionState): Promise<ActionState> {
  return guarded(async () => {
    const result = await backend.post<ProcessResult>(`/api/cases/${caseId}/process`, { channel: "web" })
    return `${caseId}: ${result.status}`
  })
}

export async function resolveConfirmation(caseId: string, approve: boolean, _prev: ActionState): Promise<ActionState> {
  return guarded(async () => {
    const result = await backend.post<Confirmation>(`/api/confirmations/${caseId}`, { approve, channel: "web", who: "analista" })
    return `Confirmación de ${caseId}: ${result.status === "approved" ? "aprobada" : "rechazada"}`
  })
}

export async function createPurchaseOrder(caseId: string, _prev: ActionState): Promise<ActionState> {
  return guarded(async () => {
    const outcome = await backend.post<CreateOutcome>(`/api/cases/${caseId}/create`, { channel: "web", confirmed: true })
    switch (outcome.status) {
      case "created":
        return `OC ${outcome.numero_oc} creada.`
      case "idempotent":
        return `La OC ${outcome.numero_oc} ya existía.`
      case "needs_confirmation":
        throw new Error(outcome.reason)
      case "blocked":
        throw new Error(`Bloqueada: ${outcome.findings.map((f) => f.code).join(", ")}`)
      case "rejected":
        throw new Error(outcome.reason)
    }
  })
}

export async function resetDemo(_prev: ActionState): Promise<ActionState> {
  return guarded(async () => {
    await backend.post<{ ok: true }>("/api/reset", {})
    // Chat sessions live in the agent process: clear them too, so Hermes does not answer from stale history.
    await fetch(`${serverEnv.agentUrl}/api/sessions/reset`, {
      method: "POST",
      headers: serverEnv.accessKey ? { Authorization: `Bearer ${serverEnv.accessKey}` } : {},
    }).catch(() => undefined)
    return "Demo reiniciada."
  })
}

export async function login(formData: FormData): Promise<void> {
  const key = String(formData.get("key") ?? "")
  if (serverEnv.accessKey && key === serverEnv.accessKey) {
    const store = await cookies()
    store.set(ACCESS_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" })
    redirect("/")
  }
  redirect("/login?error=1")
}
