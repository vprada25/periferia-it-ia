const HOP_BY_HOP = ["connection", "keep-alive", "transfer-encoding", "content-length", "host", "content-encoding"]

/**
 * Forwards a request to an internal service and streams the response back unchanged
 * (works for JSON, SSE and MCP). Optionally injects the server-side access key.
 */
export async function forward(req: Request, targetUrl: string, options: { bearer?: string } = {}): Promise<Response> {
  const headers = new Headers(req.headers)
  for (const name of HOP_BY_HOP) headers.delete(name)
  headers.delete("cookie")
  if (options.bearer) headers.set("authorization", `Bearer ${options.bearer}`)
  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      signal: req.signal,
      cache: "no-store",
    })
    const responseHeaders = new Headers(upstream.headers)
    for (const name of HOP_BY_HOP) responseHeaders.delete(name)
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return Response.json({ ok: false, error: "El servicio interno no está disponible." }, { status: 502 })
  }
}
