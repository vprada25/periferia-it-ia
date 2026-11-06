import { cookies } from "next/headers"
import { ACCESS_COOKIE, serverEnv } from "./env"

/** True when the web is open, or when the visitor has the access cookie (ADR-007). */
export async function hasWebAccess(): Promise<boolean> {
  if (!serverEnv.accessKey) return true
  const store = await cookies()
  return store.get(ACCESS_COOKIE)?.value === serverEnv.accessKey
}
