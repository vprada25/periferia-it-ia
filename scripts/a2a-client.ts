/**
 * A2A end-to-end check (ADR-010): sends "procesar" and "crear" for each case to the deterministic OC agent
 * and prints the resulting task state. Running it twice prints the same table.
 *
 *   bun run a2a:demo                       # against http://localhost:3000
 *   A2A_URL=https://<app>.onrender.com bun run a2a:demo
 */
const base = process.env.A2A_URL ?? "http://localhost:3000"
const key = process.env.ACCESS_KEY

type TaskResult = { state: string; text: string }
type RpcResponse = {
  result?: { task?: { status?: { state?: string; message?: { parts?: { text?: string }[] } } } }
  error?: { message: string }
}

let nextId = 1

async function send(command: { accion: string; caso: string }): Promise<TaskResult> {
  const response = await fetch(`${base}/a2a`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "A2A-Version": "1.0", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId++,
      method: "SendMessage",
      params: { message: { messageId: crypto.randomUUID(), role: "ROLE_USER", parts: [{ data: command }] } },
    }),
  })
  const body = (await response.json()) as RpcResponse
  if (body.error) return { state: "ERROR", text: body.error.message }
  const status = body.result?.task?.status
  return {
    state: (status?.state ?? "UNKNOWN").replace("TASK_STATE_", ""),
    text: status?.message?.parts?.[0]?.text ?? "",
  }
}

const card = (await (await fetch(`${base}/.well-known/agent-card.json`)).json()) as { name: string; skills: { id: string }[] }
console.log(`Agent Card: ${card.name} · skills: ${card.skills.map((s) => s.id).join(", ")}\n`)

for (const caso of ["sol-001", "sol-002", "sol-003", "sol-004", "sol-005", "sol-006"]) {
  const processed = await send({ accion: "procesar", caso })
  const created = await send({ accion: "crear", caso })
  console.log(`${caso.padEnd(8)} | procesar=${processed.state.padEnd(14)} | crear=${created.state.padEnd(14)} | ${created.text.slice(0, 90)}`)
}

export {}
