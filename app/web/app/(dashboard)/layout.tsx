import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AGENT_PROFILE } from "@oc/contracts"
import { AgentAvatar } from "@/components/chat"
import { FloatingAssistant } from "@/components/floating-assistant"
import { LiveRefresh } from "@/components/live-refresh"
import { NavLinks } from "@/components/nav-links"
import { hasWebAccess } from "@/lib/auth"
import { backend } from "@/lib/backend"

export const dynamic = "force-dynamic"

/** Dashboard shell: navigation, server-rendered content and Hermes floating at the bottom-right. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!(await hasWebAccess())) redirect("/login")
  const snapshot = await backend.snapshot().catch(() => null)
  const pending = snapshot?.confirmations.filter((c) => c.status === "pending").length ?? 0
  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <AgentAvatar size={34} />
          <span>
            {AGENT_PROFILE.name}
            <small>Órdenes de compra · SAP</small>
          </span>
        </div>
        <NavLinks pendingConfirmations={pending} />
        <div className="spacer" />
        <LiveRefresh />
      </nav>
      <main className="main">
        {snapshot ? children : <p className="danger-text">El backend no responde. Revisa que esté levantado.</p>}
      </main>
      <FloatingAssistant />
    </div>
  )
}
