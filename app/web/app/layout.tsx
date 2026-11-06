import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

// The tab icon comes from app/icon.svg (Hermes' face), Next's file convention.
export const metadata: Metadata = {
  title: { default: "Hermes", template: "%s · Hermes" },
  description: "Hermes, el asistente que prepara y crea órdenes de compra en SAP aplicando los controles RC1–RC10.",
  applicationName: "Hermes",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
