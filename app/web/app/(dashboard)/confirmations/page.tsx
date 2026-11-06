import Link from "next/link"
import { ActionButton } from "@/components/action-button"
import { FindingList } from "@/components/format"
import { createPurchaseOrder, resolveConfirmation } from "@/lib/actions"
import { backend } from "@/lib/backend"

export const metadata = { title: "Confirmaciones" }

/** Approval console (ADR-012): any channel can raise a confirmation; the analyst resolves it here or in the chat. */
export default async function ConfirmationsPage() {
  const { confirmations, cases } = await backend.snapshot()
  const pending = confirmations.filter((c) => c.status === "pending")
  const resolved = confirmations.filter((c) => c.status !== "pending")
  return (
    <>
      <h1>Confirmaciones</h1>
      <p className="lead">
        Lo que pida el chat, un host MCP o un agente A2A y requiera decisión humana aparece aquí. Una OC con excepciones solo se crea si la analista la aprueba.
      </p>
      {pending.length === 0 && <p className="muted">No hay confirmaciones pendientes.</p>}
      <div className="grid">
        {pending.map((c) => (
          <div key={c.caseId} className="card confirm-card">
            <b><Link href={`/cases/${c.caseId}`}>{c.caseId}</Link></b>
            <FindingList findings={c.findings} tone="warn" />
            <div className="actions">
              <ActionButton action={resolveConfirmation.bind(null, c.caseId, true)} label="Aprobar" variant="ok" />
              <ActionButton action={resolveConfirmation.bind(null, c.caseId, false)} label="Rechazar" variant="danger" />
            </div>
          </div>
        ))}
      </div>
      {resolved.length > 0 && (
        <>
          <h2>Resueltas</h2>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Caso</th><th>Códigos</th><th>Estado</th><th>Por</th><th /></tr></thead>
              <tbody>
                {resolved.map((c) => {
                  const summary = cases.find((x) => x.caseId === c.caseId)
                  return (
                    <tr key={c.caseId}>
                      <td><Link href={`/cases/${c.caseId}`}>{c.caseId}</Link></td>
                      <td>{c.codes.join(", ")}</td>
                      <td><span className={`badge ${c.status === "approved" ? "ok" : "danger"}`}>{c.status === "approved" ? "aprobada" : "rechazada"}</span></td>
                      <td>{c.resolvedBy ? `${c.resolvedBy.channel}:${c.resolvedBy.who}` : "—"}</td>
                      <td>
                        {c.status === "approved" && !summary?.numero_oc && (
                          <ActionButton action={createPurchaseOrder.bind(null, c.caseId)} label="Crear OC" variant="ok" />
                        )}
                        {summary?.numero_oc && <span className="badge ok">OC {summary.numero_oc}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
