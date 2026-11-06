import type { CaseStatus, Finding } from "@oc/contracts"
import { STATUS_LABEL } from "@oc/contracts"

export const money = (value: number, currency = "COP") =>
  `${currency} ${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`

export function StatusBadge({ status }: { status: CaseStatus }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
}

export function FindingList({ findings, tone }: { findings: Finding[]; tone: "danger" | "warn" }) {
  if (findings.length === 0) return <span className="muted">—</span>
  return (
    <ul>
      {findings.map((f) => (
        <li key={`${f.rule}-${f.code}`}>
          <span className={`badge ${tone}`}>
            {f.rule} · {f.code}
          </span>{" "}
          {f.detail}
        </li>
      ))}
    </ul>
  )
}
