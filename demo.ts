/**
 * PRD 6.6 — runs the five tools over the six cases without any language model or API key.
 * Deterministic: out/ is wiped at start and the clock is fixed.
 *
 *   bun install && bun run demo.ts
 */
import { FixedClock, createContainer, loadBackendConfig } from "@oc/backend"
import { ocTools, type ToolContext, type ToolResult } from "@oc/agent/tools"

// The tools run against the backend use cases in process (same OcPort contract the agent uses over HTTP).
const { service, rootDir } = createContainer({
  clock: new FixedClock(new Date("2026-09-03T15:00:00Z")),
  config: loadBackendConfig({}),
})
const ctx: ToolContext = { directory: rootDir, sessionId: "demo", channel: "demo", oc: service }

type Finding = { code: string; rule: string }
type Validation = { apta: boolean; bloqueos: Finding[]; confirmaciones: Finding[]; retroactiva: boolean }

async function call<T>(tool: string, args: Record<string, unknown>): Promise<ToolResult<T>> {
  const registered = ocTools.find((t) => t.name === tool)
  if (!registered) throw new Error(`Tool ${tool} not found`)
  return JSON.parse(await registered.run(args, ctx)) as ToolResult<T>
}

const codes = (findings: Finding[]) => (findings.length ? findings.map((f) => `${f.rule}:${f.code}`).join(", ") : "—")

async function runCase(caso: string, confirm = false): Promise<void> {
  const pkg = await call("oc_leer_paquete", { caso })
  if (!pkg.ok) return console.log(`${caso.padEnd(8)} | error al leer: ${pkg.error}`)
  const validation = await call<Validation>("oc_validar", { caso })
  if (!validation.ok) return console.log(`${caso.padEnd(8)} | error al validar: ${validation.error}`)
  const v = validation.data
  if (v.apta) {
    await call("oc_generar_evidencia", { caso })
    await call("oc_construir_payload", { caso })
  }
  let created = await call<{ numero_oc: string; idempotente: boolean }>("oc_crear", { caso })
  if (!created.ok && confirm && created.error.startsWith("requiere confirmación")) {
    console.log(`${caso.padEnd(8)} | sin confirmar → ${created.error.slice(0, 90)}…`)
    await service.confirm(caso, { approved: true, channel: "demo", who: "analista-demo" })
    created = await call("oc_crear", { caso, confirmado: true })
  }
  const outcome = created.ok
    ? `OC ${created.data.numero_oc}${created.data.idempotente ? " (idempotente)" : ""}`
    : created.error.split(":")[0]
  console.log(
    [
      caso.padEnd(8),
      `apta=${String(v.apta).padEnd(5)}`,
      `bloqueos=${codes(v.bloqueos).padEnd(52)}`,
      `confirmaciones=${codes(v.confirmaciones).padEnd(22)}`,
      `retroactiva=${String(v.retroactiva).padEnd(5)}`,
      outcome,
    ].join(" | "),
  )
}

await service.reset()
console.log("Demo reto 03 — herramientas oc_* sin modelo\n")
await runCase("sol-001")
await runCase("sol-001") // idempotency: same PO number, no second order
await runCase("sol-002")
await runCase("sol-003")
await runCase("sol-004", true) // explicit confirmation
await runCase("sol-005", true)
await runCase("sol-006", true)
console.log("\nArtefactos en out/: sap/ordenes.jsonl, control.csv, log.jsonl, <caso>/aprobacion.txt, payload.json, trazabilidad.json")
