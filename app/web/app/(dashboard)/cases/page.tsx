import Link from "next/link"
import { StatusBadge, money } from "@/components/format"
import { backend } from "@/lib/backend"

export const metadata = { title: "Casos" }

/** Case list, server-rendered and refreshed live through SSE. */
export default async function CasesPage() {
  const { cases } = await backend.snapshot()
  return (
    <>
      <h1>Casos</h1>
      <p className="lead">Cada tarjeta cambia en vivo cuando el agente, la web, un host MCP o un agente A2A actúan sobre el caso.</p>
      <div className="grid">
        {cases.map((c) => (
          <Link key={c.caseId} href={`/cases/${c.caseId}`} className="card case-card">
            <div className="case-head">
              <span className="case-id">{c.caseId}</span>
              <StatusBadge status={c.status} />
            </div>
            <span>{c.descripcion}</span>
            <span className="muted">
              {c.proveedor} · {c.centro_costo} / {c.subarea}
            </span>
            <span className="amount">{money(c.valor_total, c.moneda)}</span>
            <div className="chips">
              {c.bloqueos.map((b) => (
                <span key={b} className="badge danger">{b}</span>
              ))}
              {c.confirmaciones.map((x) => (
                <span key={x} className="badge warn">{x}</span>
              ))}
              {c.retroactiva && <span className="badge warn">retroactiva</span>}
              {c.numero_oc && <span className="badge ok">OC {c.numero_oc}</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
