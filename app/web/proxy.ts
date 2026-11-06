import { NextResponse, type NextRequest } from "next/server"

/** Runtime frame policy for /embed (ADR-014): only the configured origins may frame the chat. */
export function proxy(_req: NextRequest): NextResponse {
  const origins = (process.env.EMBED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const response = NextResponse.next()
  response.headers.set("Content-Security-Policy", `frame-ancestors 'self' ${origins.join(" ")}`.trim())
  return response
}

export const config = { matcher: ["/embed"] }
