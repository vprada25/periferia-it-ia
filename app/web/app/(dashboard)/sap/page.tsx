import { money } from "@/components/format"
import { backend } from "@/lib/backend"

const KIND_LABEL = { block: "Bloqueo", confirmation: "Confirmación", derived: "Derivado" } as const

/** SAP mock orders, audit control log (control.csv), activity log (log.jsonl) and the control matrix. */
export default async function SapPage() {
  const { orders, control, activity, rules } = await backend.snapshot()
  const created = control.filter((r) => r.resultado === "creada")
  const retroactivePct = created.length ? Math.round((created.filter((r) => r.retroactiva).length / created.length) * 100) : 0
  return (
    <>
      <h1>SAP y control</h1>
      <p className="lead">Órdenes creadas en el SAP simulado, el log de control que consume auditoría y la actividad de todos los canales.</p>

      <h2>Órdenes en SAP ({orders.length})</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Número</th><th>Fecha</th><th>Solicitud</th><th>Proveedor</th><th>Valor</th><th>Excepciones</th></tr></thead>
          <tbody>
            {orders.map((o) => {
              const total = o.orden.posiciones.reduce((sum, p) => sum + p.cantidad * p.precio_unitario, 0)
              return (
                <tr key={o.numero_oc}>
                  <td><b>{o.numero_oc}</b></td>
                  <td>{o.fecha}</td>
                  <td>{o.solicitud_id}</td>
                  <td>{o.orden.proveedor.nombre}</td>
                  <td>{money(total, o.orden.moneda)}</td>
                  <td>{o.orden.excepciones.map((e) => e.codigo).join(", ") || "—"}</td>
                </tr>
              )
            })}
            {orders.length === 0 && <tr><td colSpan={6} className="muted">Aún no hay órdenes.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Control (out/control.csv) · OC retroactivas: {retroactivePct} %</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Solicitud</th><th>Resultado</th><th>OC</th><th>Retroactiva</th><th>Bloqueos</th><th>Confirmaciones</th><th>Canal</th><th>Hora</th></tr></thead>
          <tbody>
            {[...control].reverse().map((r, i) => (
              <tr key={`${r.ts}-${i}`}>
                <td>{r.solicitud_id}</td>
                <td>{r.resultado}</td>
                <td>{r.numero_oc ?? "—"}</td>
                <td>{r.retroactiva ? "sí" : "no"}</td>
                <td>{r.bloqueos.join(", ") || "—"}</td>
                <td>{r.confirmaciones.join(", ") || "—"}</td>
                <td>{r.canal}</td>
                <td className="muted">{r.ts.slice(11, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Actividad (out/log.jsonl)</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Hora</th><th>Canal</th><th>Herramienta</th><th>Caso</th><th>OK</th><th>Resumen</th></tr></thead>
          <tbody>
            {[...activity].reverse().map((a, i) => (
              <tr key={`${a.ts}-${i}`}>
                <td className="muted">{a.ts.slice(11, 19)}</td>
                <td>{a.canal}</td>
                <td><code>{a.herramienta}</code></td>
                <td>{a.caso ?? "—"}</td>
                <td>{a.ok ? "✅" : "⛔"}</td>
                <td className="muted">{a.resumen.slice(0, 120)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Matriz de controles</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Regla</th><th>Tipo</th><th>Descripción</th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}><td><b>{r.id}</b></td><td>{KIND_LABEL[r.kind]}</td><td>{r.description}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
