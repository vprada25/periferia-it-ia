import { findCostCenter } from "../master-data"
import type { CasePackage, CostCenter, Derived, Finding, MasterData } from "@oc/contracts"

/** Shared context. `derived` is filled in order: RC1 resolves the supplier that RC6/RC7 use. */
export type RuleContext = {
  readonly pkg: CasePackage
  readonly masterData: MasterData
  readonly derived: Derived
}

export type RuleOutcome = {
  blocks?: Finding[]
  confirmations?: Finding[]
  retroactive?: boolean
}

import type { RuleKind } from "@oc/contracts"

export type { RuleKind } from "@oc/contracts"

/** Strategy: each PRD control (RC1–RC10) is interchangeable and describes itself. */
export interface ControlRule {
  readonly id: string
  readonly description: string
  readonly kind: RuleKind
  evaluate(ctx: RuleContext): RuleOutcome
}

export const NO_FINDINGS: RuleOutcome = {}

export function costCenterOf(ctx: RuleContext): CostCenter | null {
  return findCostCenter(ctx.masterData, ctx.pkg.solicitud.centro_costo)
}

export function approverOf(ctx: RuleContext) {
  const email = ctx.pkg.aprobacion?.de.toLowerCase()
  return costCenterOf(ctx)?.aprobadores.find((a) => a.email.toLowerCase() === email) ?? null
}
