import type { CaseStatus, Channel } from "@oc/contracts"
import { ChartCard, Dumbbell, RankedBars, SegmentedBar, StatTile, type Segment } from "@/components/charts"
import { money } from "@/components/format"
import { backend } from "@/lib/backend"

const STATUS_SEGMENTS: { status: CaseStatus; label: string; icon: string; tone: string }[] = [
  { status: "po_created", label: "OC creada", icon: "✓", tone: "good" },
  { status: "ready", label: "Lista para crear", icon: "→", tone: "info" },
  // Order keeps warning (yellow) and serious (orange) apart: validated adjacent CVD and normal-vision separation.
  { status: "awaiting_confirmation", label: "Esperando confirmación", icon: "!", tone: "warning" },
  { status: "blocked", label: "Bloqueada", icon: "✕", tone: "critical" },
  { status: "rejected", label: "Confirmación rechazada", icon: "↩", tone: "serious" },
  { status: "not_processed", label: "Sin procesar", icon: "·", tone: "neutral" },
]

const CHANNEL_LABEL: Record<Channel, string> = { chat: "Chat (Hermes)", web: "Web", mcp: "MCP", a2a: "A2A", demo: "demo.ts" }
const KIND_LABEL = { block: "bloqueo", confirmation: "confirmación", derived: "derivado" } as const

const millions = (value: number) => `${(value / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`

/** Operational dashboard (SSR): KPIs and charts over cases, controls, SAP orders and channel activity. */
export default async function DashboardPage() {
  const { cases, orders, control, activity, insights } = await backend.snapshot()

  const countBy = (status: CaseStatus) => cases.filter((c) => c.status === status).length
  const orderValue = orders.reduce((sum, o) => sum + o.orden.posiciones.reduce((s, p) => s + p.cantidad * p.precio_unitario, 0), 0)
  const created = control.filter((r) => r.resultado === "creada")
  const retroactivePct = created.length ? Math.round((created.filter((r) => r.retroactiva).length / created.length) * 100) : 0

  const segments: Segment[] = STATUS_SEGMENTS.map((s) => ({ key: s.status, label: s.label, icon: s.icon, tone: s.tone, value: countBy(s.status) }))

  const byChannel = new Map<Channel, number>()
  for (const a of activity) byChannel.set(a.canal, (byChannel.get(a.canal) ?? 0) + 1)

  const byOutcome = new Map<string, number>()
  for (const r of control) byOutcome.set(r.resultado, (byOutcome.get(r.resultado) ?? 0) + 1)

  return (
    <>
      <h1>Panel de órdenes de compra</h1>
      <p className="lead">Estado del buzón, controles y órdenes en SAP. Se actualiza en vivo cuando Hermes, la web, un host MCP o un agente A2A actúan.</p>

      <div className="stats">
        <StatTile label="Casos en el buzón" value={String(cases.length)} />
        <StatTile label="OC creadas en SAP" value={String(orders.length)} hint={orders.length ? money(orderValue) : "aún ninguna"} tone={orders.length ? "good" : "default"} />
        <StatTile label="Esperan confirmación" value={String(countBy("awaiting_confirmation"))} tone={countBy("awaiting_confirmation") ? "warning" : "default"} />
        <StatTile label="Bloqueadas" value={String(countBy("blocked"))} tone={countBy("blocked") ? "critical" : "default"} />
        <StatTile label="OC retroactivas" value={`${retroactivePct} %`} hint={`${created.filter((r) => r.retroactiva).length} de ${created.length} creadas`} />
      </div>

      <div className="chart-grid">
        <ChartCard
          title="Estado de los casos"
          subtitle="Cómo se reparten las 6 solicitudes del buzón"
          table={
            <table><tbody>{segments.map((s) => <tr key={s.key}><td>{s.icon} {s.label}</td><td>{s.value}</td></tr>)}</tbody></table>
          }
        >
          <SegmentedBar segments={segments} unit="casos" />
        </ChartCard>

        <ChartCard
          title="Hallazgos por control"
          subtitle="Cuántas solicitudes dispara cada regla (validación en seco de todo el buzón)"
          table={
            <table>
              <thead><tr><th>Regla</th><th>Tipo</th><th>Casos</th></tr></thead>
              <tbody>{insights.findingsByRule.map((r) => <tr key={r.id}><td>{r.id}</td><td>{KIND_LABEL[r.kind]}</td><td>{r.cases.join(", ") || "—"}</td></tr>)}</tbody>
            </table>
          }
        >
          <RankedBars
            data={insights.findingsByRule
              .filter((r) => r.count > 0)
              .map((r) => ({
                key: r.id,
                label: `${r.id} · ${KIND_LABEL[r.kind]}`,
                value: r.count,
                display: r.cases.join(", "),
                detail: r.description,
                emphasis: r.kind === "block",
              }))}
            emptyText="Ningún control con hallazgos."
          />
        </ChartCard>

        <ChartCard
          title="Solicitud vs cotización"
          subtitle="RC5 permite hasta 2 % de diferencia; lo que la supera pide confirmación"
          table={
            <table>
              <thead><tr><th>Caso</th><th>Solicitud</th><th>Cotización</th><th>Diferencia</th></tr></thead>
              <tbody>
                {insights.quoteVsRequest.map((q) => (
                  <tr key={q.caseId}><td>{q.caseId}</td><td>{money(q.solicitud)}</td><td>{q.cotizacion === null ? "—" : money(q.cotizacion)}</td><td>{q.diferencia_pct === null ? "—" : `${q.diferencia_pct} %`}</td></tr>
                ))}
              </tbody>
            </table>
          }
        >
          <Dumbbell
            aLabel="Solicitud"
            bLabel="Cotización"
            data={insights.quoteVsRequest.map((q) => ({
              key: q.caseId,
              label: q.caseId,
              a: q.solicitud,
              b: q.cotizacion,
              display: q.diferencia_pct === null ? "sin cotización" : `${q.diferencia_pct} %`,
              flagged: (q.diferencia_pct ?? 0) > 2,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Valor solicitado por centro de costo"
          subtitle="Suma de las solicitudes del buzón (COP)"
          table={
            <table><tbody>{insights.valueByCostCenter.map((c) => <tr key={c.centro_costo}><td>{c.centro_costo} {c.nombre}</td><td>{money(c.total)}</td><td>{c.cases} casos</td></tr>)}</tbody></table>
          }
        >
          <RankedBars
            data={insights.valueByCostCenter.map((c) => ({
              key: c.centro_costo,
              label: `${c.centro_costo} · ${c.nombre}`,
              value: c.total,
              display: millions(c.total),
              detail: `${c.cases} solicitudes`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Resultados en el control"
          subtitle="Cada intento queda en out/control.csv"
          table={<table><tbody>{[...byOutcome.entries()].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>}
        >
          <RankedBars
            data={[...byOutcome.entries()].map(([k, v]) => ({ key: k, label: k, value: v, display: String(v) }))}
            emptyText="Aún no hay intentos registrados."
          />
        </ChartCard>

        <ChartCard
          title="Actividad por canal"
          subtitle="Llamadas registradas en out/log.jsonl (últimas 60)"
          table={<table><tbody>{[...byChannel.entries()].map(([k, v]) => <tr key={k}><td>{CHANNEL_LABEL[k]}</td><td>{v}</td></tr>)}</tbody></table>}
        >
          <RankedBars
            data={[...byChannel.entries()].map(([k, v]) => ({ key: k, label: CHANNEL_LABEL[k], value: v, display: String(v) }))}
            emptyText="Aún no hay actividad."
          />
        </ChartCard>
      </div>
    </>
  )
}
