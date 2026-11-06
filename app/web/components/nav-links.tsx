"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/", label: "Panel" },
  { href: "/cases", label: "Casos" },
  { href: "/confirmations", label: "Confirmaciones" },
  { href: "/sap", label: "SAP y control" },
  { href: "/master-data", label: "Maestros" },
  { href: "/about", label: "Cómo funciona" },
] as const

export function NavLinks({ pendingConfirmations }: { pendingConfirmations: number }) {
  const pathname = usePathname()
  return (
    <>
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
        return (
          <Link key={link.href} href={link.href} className={active ? "nav-link active" : "nav-link"}>
            {link.label}
            {link.href === "/confirmations" && pendingConfirmations > 0 && <span className="badge warn">{pendingConfirmations}</span>}
          </Link>
        )
      })}
    </>
  )
}
