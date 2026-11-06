import { CaseIdSchema } from "@oc/contracts"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ActionButton } from "@/components/action-button"
import { FindingList, StatusBadge, money } from "@/components/format"
import { createPurchaseOrder, processCase, resolveConfirmation } from "@/lib/actions"
import { backend } from "@/lib/backend"

export async function generateMetadata(props: PageProps<"/cases/[caseId]">) {
  const { caseId } = await props.params
  return { title: caseId }
}

/** Case detail (SSR): original documents, controls, purchase order payload and traceability. */
export default async function CaseDetailPage(props: PageProps<"/cases/[caseId]">) {
  const { caseId } = await props.params
  if (!CaseIdSchema.safeParse(caseId).success) notFound()
  const detail = await backend.caseDetail(caseId).catch(() => null)
  if (!detail) notFound()
  const { summary, validacion, payload, confirmacion, documents } = detail
  const pending = confirmacion?.status === "pending"
  const canCreate = summary.status === "ready" || (summary.status === "awaiting_confirmation" && confirmacion?.status === "approved")

  return (
    <>
      <p><Link href="/cases">← Casos</Link></p>
      <div className="detail-head">
        <div>
          <h1>{summary.caseId} · {summary.solicitud_id}</h1>
          <p className="lead">{summary.descripcion}</p>
        </div>
        <StatusBadge status={summary.status} />
      </div>

      <div className="actions">
        <ActionButton action={processCase.bind(null, caseId)} label="Procesar (validar + payload)" variant="primary" />
        {pending && <ActionButton action={resolveConfirmation.bind(null, caseId, true)} label="Aprobar confirmación" variant="ok" />}
        {pending && <ActionButton action={resolveConfirmation.bind(null, caseId, false)} label="Rechazar" variant="danger" />}
        {canCreate && <ActionButton action={createPurchaseOrder.bind(null, caseId)} label="Crear OC en SAP" variant="ok" />}
        {summary.numero_oc && <span className="badge ok">OC {summary.numero_oc}</span>}
      </div>

      <h2>Controles RC1–RC10</h2>
      {validacion ? (
        <div className="two-col">
          <div className="card"><b>Bloqueos</b><FindingList findings={validacion.bloqueos} tone="danger" /></div>
          <div className="card"><b>Confirmaciones</b><FindingList findings={validacion.confirmaciones} tone="warn" />
            {confirmacion?.resolvedBy && (
              <p className="muted">Resuelta por {confirmacion.resolvedBy.channel}:{confirmacion.resolvedBy.who}</p>
            )}
          </div>
        </div>
      ) : (
        <p className="muted">Aún no se ha validado. Usa “Procesar” o pídeselo al asistente.</p>
      )}

      {payload && (
        <>
          <h2>Orden de compra (como quedaría en SAP)</h2>
          <div className="card table-wrap">
            <table>
              <tbody>
                <tr><th>Proveedor</th><td>{payload.orden.proveedor.nombre} ({payload.orden.proveedor.codigo_sap})</td></tr>
                <tr><th>Moneda / condiciones</th><td>{payload.orden.moneda} · {payload.orden.condiciones_pago}</td></tr>
                <tr><th>Aprobador</th><td>{payload.orden.aprobador.email} · {payload.orden.aprobador.fecha_aprobacion}</td></tr>
                <tr><th>Evidencia sha256</th><td><code>{payload.orden.aprobador.evidencia_sha256}</code></td></tr>
                {payload.orden.posiciones.map((p) => (
                  <tr key={p.numero}>
                    <th>Posición {p.numero}</th>
                    <td>{p.descripcion} · {p.cantidad} {p.unidad} × {money(p.precio_unitario, payload.orden.moneda)} · {p.centro_costo}/{p.subarea} · IVA {p.indicador_iva}</td>
                  </tr>
                ))}
                <tr><th>Excepciones</th><td>{payload.orden.excepciones.map((e) => `${e.codigo} (${e.confirmado_por ?? "sin confirmar"})`).join(", ") || "—"}</td></tr>
              </tbody>
            </table>
          </div>
          <h2>Trazabilidad</h2>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Campo</th><th>Fuente</th></tr></thead>
              <tbody>
                {Object.entries(payload.trazabilidad).map(([field, source]) => (
                  <tr key={field}><td><code>{field}</code></td><td>{source}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Documentos del paquete</h2>
      <div className="docs">
        {documents.map((d) => (
          <div key={d.nombre} className="card">
            <b>{d.nombre}</b>
            <pre>{d.contenido}</pre>
          </div>
        ))}
      </div>
    </>
  )
}
