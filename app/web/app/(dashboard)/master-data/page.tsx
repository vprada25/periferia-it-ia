import { money } from "@/components/format"
import { backend } from "@/lib/backend"

/** Master data used by the controls (read-only fixtures). */
export default async function MasterDataPage() {
  const { proveedores, centros, iva, condiciones } = await backend.masterData()
  return (
    <>
      <h1>Maestros</h1>
      <p className="lead">Datos de referencia contra los que se valida cada solicitud. Son de solo lectura (fixtures del reto).</p>

      <h2>Proveedores</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Código SAP</th><th>NIT</th><th>Nombre</th><th>Cond. pago</th><th>IVA</th><th>Activo</th></tr></thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.codigo_sap}>
                <td>{p.codigo_sap}</td><td>{p.nit}</td><td>{p.nombre}</td><td>{p.condiciones_pago_default}</td><td>{p.indicador_iva_default}</td>
                <td>{p.activo ? <span className="badge ok">sí</span> : <span className="badge danger">no</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Centros de costo y aprobadores</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Centro</th><th>Subáreas</th><th>Aprobadores (tope)</th></tr></thead>
          <tbody>
            {centros.map((c) => (
              <tr key={c.centro_costo}>
                <td><b>{c.centro_costo}</b> {c.nombre}</td>
                <td>{c.subareas.join(", ")}</td>
                <td>{c.aprobadores.map((a) => `${a.nombre} <${a.email}> (${money(a.tope)})`).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="two-col">
        <div>
          <h2>Indicadores de IVA</h2>
          <div className="card table-wrap">
            <table><tbody>{iva.map((i) => <tr key={i.codigo}><td><b>{i.codigo}</b></td><td>{i.descripcion}</td></tr>)}</tbody></table>
          </div>
        </div>
        <div>
          <h2>Condiciones de pago</h2>
          <div className="card table-wrap">
            <table><tbody>{condiciones.map((c) => <tr key={c.codigo}><td><b>{c.codigo}</b></td><td>{c.descripcion}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>
    </>
  )
}
