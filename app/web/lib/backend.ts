import type { CaseDetail, MasterData, Snapshot } from "@oc/contracts"
import { serverEnv } from "./env"

/** Typed server-side client of the backend API, used by server components (SSR) and server actions. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${serverEnv.backendUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(serverEnv.accessKey ? { Authorization: `Bearer ${serverEnv.accessKey}` } : {}),
      ...init.headers,
    },
  })
  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? `Backend ${response.status}`)
  return body as T
}

export const backend = {
  snapshot: () => request<Snapshot>("/api/state"),
  caseDetail: (caseId: string) => request<CaseDetail>(`/api/cases/${caseId}`),
  masterData: () => request<MasterData>("/api/master-data"),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
}
