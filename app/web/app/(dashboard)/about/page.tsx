import { ActionButton } from "@/components/action-button"
import { resetDemo } from "@/lib/actions"
import { backend } from "@/lib/backend"

export const metadata = { title: "Cómo funciona" }

const ARCHITECTURE = `                    ┌──────────────── Render · 1 servicio, 3 procesos ────────────────┐
 Navegador ────────▶│ web (Next.js, SSR)  :3000   ← única entrada pública              │
 Sitio externo ────▶│   /api/chat, /api/sessions ─▶ agent  (LLM + herramientas oc_*)   │
 (widget.js)        │   /api/*, /mcp, /a2a       ─▶ backend (núcleo hexagonal)         │
 Host MCP ─────────▶│                                                                  │
 Otro agente A2A ──▶│  agent ──OcPort por HTTP──▶ backend ──▶ dominio RC1–RC10         │
                    │                                  └──▶ SAP simulado · out/        │
                    └──────────────────────────────────────────────────────────────────┘
 app/contracts: tipos, esquemas y herramientas oc_* compartidos (único paquete común)`

/** How the solution works: challenge, objectives, architecture and integrations (server-rendered). */
export default async function AboutPage() {
  const snapshot = await backend.snapshot()
  const count = (status: string) => snapshot.cases.filter((c) => c.status === status).length
  const retroactive = snapshot.control.filter((r) => r.resultado === "creada" && r.retroactiva).length
  const created = snapshot.orders.length
  return (
    <>
      <h1>Cómo funciona</h1>
      <p className="lead">
        Cada compra llega por correo con la solicitud, la cotización del proveedor y la aprobación del líder. Este agente lee el paquete, lo valida
        contra los maestros (RC1–RC10), arma la OC con su trazabilidad, guarda la evidencia de aprobación y la crea en un SAP simulado. Las excepciones
        no se fuerzan: se devuelven a la analista para que decida.
      </p>

      <div className="stats">
        <div className="card stat"><b>{snapshot.cases.length}</b><span className="muted">casos en el buzón</span></div>
        <div className="card stat"><b>{created}</b><span className="muted">OC creadas</span></div>
        <div className="card stat"><b>{count("awaiting_confirmation")}</b><span className="muted">esperan confirmación</span></div>
        <div className="card stat"><b>{count("blocked")}</b><span className="muted">bloqueadas</span></div>
        <div className="card stat"><b>{retroactive}</b><span className="muted">OC retroactivas</span></div>
      </div>

      <h2>Objetivos del reto</h2>
      <div className="two-col">
        <div className="card"><b>O1 · Sin digitación</b><p className="muted">sol-001 termina con OC creada sin intervención humana.</p></div>
        <div className="card"><b>O2 · Bloquear lo que no cumple</b><p className="muted">sol-002 (proveedor inexistente) y sol-003 (aprobador sin autoridad) no crean OC.</p></div>
        <div className="card"><b>O3 · Dudas → confirmaciones</b><p className="muted">sol-004 (cotización ≠ solicitud) y sol-006 (IVA no informado) piden confirmación.</p></div>
        <div className="card"><b>O4 · Medir el desvío</b><p className="muted">sol-005 (factura previa) se crea solo con confirmación y queda marcada como retroactiva.</p></div>
      </div>

      <h2>Arquitectura</h2>
      <div className="arch">{ARCHITECTURE}</div>

      <h2>Integraciones</h2>
      <div className="two-col">
        <div className="card">
          <b>MCP</b>
          <p className="muted">Las mismas herramientas oc_* para cualquier host MCP.</p>
          <pre className="block">claude mcp add --transport http oc-sap {"<URL>"}/mcp</pre>
        </div>
        <div className="card">
          <b>A2A · agente determinista</b>
          <p className="muted">Agent Card en /.well-known/agent-card.json. Comandos: procesar, crear, confirmar, estado.</p>
          <pre className="block">{`{"accion":"procesar","caso":"sol-004"}`}</pre>
        </div>
        <div className="card">
          <b>Embeber el chat</b>
          <p className="muted">En cualquier página:</p>
          <pre className="block">{`<script src="<URL>/widget.js" async></script>`}</pre>
        </div>
      </div>

      <h2>Demo</h2>
      <ActionButton action={resetDemo} label="Reiniciar demo (borra out/)" variant="danger" />
    </>
  )
}
