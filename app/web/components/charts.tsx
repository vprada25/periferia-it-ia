import type { ReactNode } from "react"

/*
 * Small, dependency-free chart components (server-rendered).
 * Encoding rules: one hue for magnitude (ranked bars), status colors only for states and always with
 * icon + label, one baseline per chart, values in text ink, a table view under every chart.
 */

export function StatTile(props: { label: string; value: string; hint?: string; tone?: "default" | "good" | "warning" | "critical" }) {
  return (
    <div className={`card stat-tile ${props.tone ?? "default"}`}>
      <span className="stat-label">{props.label}</span>
      <b className="stat-value">{props.value}</b>
      {props.hint && <span className="stat-hint">{props.hint}</span>}
    </div>
  )
}

export function ChartCard(props: { title: string; subtitle?: string; children: ReactNode; table?: ReactNode }) {
  return (
    <section className="card chart-card">
      <header>
        <h3>{props.title}</h3>
        {props.subtitle && <p className="muted">{props.subtitle}</p>}
      </header>
      {props.children}
      {props.table && (
        <details className="chart-table">
          <summary>Ver tabla</summary>
          {props.table}
        </details>
      )}
    </section>
  )
}

export type Segment = { key: string; label: string; icon: string; value: number; tone: string }

/** Tall segmented bar: how one whole splits, at a glance (≤ 6 parts), with a legend of names + icons. */
export function SegmentedBar({ segments, unit }: { segments: Segment[]; unit: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const visible = segments.filter((s) => s.value > 0)
  return (
    <div>
      <div className="segbar" role="img" aria-label={visible.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        {visible.map((s) => (
          <div key={s.key} className={`seg tone-${s.tone}`} style={{ flexGrow: s.value }} title={`${s.label}: ${s.value} ${unit}`}>
            <span className="seg-value">
              {s.icon} {s.value}
            </span>
          </div>
        ))}
        {total === 0 && <div className="seg tone-neutral" style={{ flexGrow: 1 }} />}
      </div>
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.key}>
            <span className={`swatch tone-${s.tone}`} aria-hidden />
            {s.icon} {s.label} <span className="muted">({s.value})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export type BarDatum = { key: string; label: string; value: number; display: string; detail?: string; emphasis?: boolean }

/** Ranked horizontal bars on one baseline, one hue (magnitude), largest first. */
export function RankedBars({ data, emptyText = "Sin datos todavía." }: { data: BarDatum[]; emptyText?: string }) {
  const max = Math.max(0, ...data.map((d) => d.value))
  if (data.length === 0 || max === 0) return <p className="muted">{emptyText}</p>
  const sorted = [...data].sort((a, b) => b.value - a.value)
  return (
    <ul className="bars">
      {sorted.map((d) => (
        <li key={d.key} className="bar-row" title={d.detail ? `${d.label}: ${d.display} · ${d.detail}` : `${d.label}: ${d.display}`}>
          <span className="bar-label">{d.label}</span>
          <span className="bar-track">
            <span className={d.emphasis ? "bar-fill emphasis" : "bar-fill"} style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{d.display}</span>
        </li>
      ))}
    </ul>
  )
}

export type DumbbellDatum = { key: string; label: string; a: number; b: number | null; display: string; flagged: boolean }

/** Before → after per item (request vs quote) on one shared axis. */
export function Dumbbell({ data, aLabel, bLabel }: { data: DumbbellDatum[]; aLabel: string; bLabel: string }) {
  const values = data.flatMap((d) => (d.b === null ? [d.a] : [d.a, d.b]))
  const max = Math.max(...values) * 1.05
  const pos = (v: number) => `${(v / max) * 100}%`
  return (
    <div>
      <ul className="legend">
        <li><span className="dot-mark a" aria-hidden /> {aLabel}</li>
        <li><span className="dot-mark b" aria-hidden /> {bLabel}</li>
      </ul>
      <ul className="dumbbells">
        {data.map((d) => {
          const lo = d.b === null ? d.a : Math.min(d.a, d.b)
          const hi = d.b === null ? d.a : Math.max(d.a, d.b)
          return (
            <li key={d.key} className="bar-row" title={`${d.label}: ${d.display}`}>
              <span className="bar-label">{d.label}</span>
              <span className="db-track">
                <span className={d.flagged ? "db-line flagged" : "db-line"} style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
                <span className="dot-mark a" style={{ left: pos(d.a) }} />
                {d.b !== null && <span className="dot-mark b" style={{ left: pos(d.b) }} />}
              </span>
              <span className={d.flagged ? "bar-value warn-text" : "bar-value"}>{d.display}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
