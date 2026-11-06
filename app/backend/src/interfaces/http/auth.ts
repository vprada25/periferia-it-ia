import { timingSafeEqual } from "node:crypto"

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Access key from Authorization: Bearer, x-access-key, or ?key= (EventSource cannot send headers). */
export function extractAccessKey(req: Request): string | null {
  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim()
  const header = req.headers.get("x-access-key")
  if (header) return header.trim()
  return new URL(req.url).searchParams.get("key")
}

/** Optional shared-key protection (ADR-007). When ACCESS_KEY is empty everything is open. */
export function isAuthorized(req: Request, accessKey: string | undefined): boolean {
  if (!accessKey) return true
  const provided = extractAccessKey(req)
  return provided !== null && safeEqual(provided, accessKey)
}
