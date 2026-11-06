import type { CasePackage, Finding, MasterData, ValidationResult } from "@oc/contracts"
import { approverLimitRule, validApprovalRule } from "./approval"
import { arithmeticRule, quoteMatchRule } from "./amounts"
import { subareaRule } from "./cost-center"
import { approvalDateRule, retroactiveInvoiceRule } from "./dates"
import { paymentTermsRule, vatIndicatorRule } from "./derived"
import type { ControlRule, RuleContext } from "./rule"
import { activeSupplierRule } from "./supplier"

export type { ControlRule } from "./rule"

/** Order matters: RC1 resolves the supplier used by RC6 and RC7. */
export const CONTROL_RULES: readonly ControlRule[] = [
  activeSupplierRule,
  validApprovalRule,
  approverLimitRule,
  subareaRule,
  quoteMatchRule,
  vatIndicatorRule,
  paymentTermsRule,
  retroactiveInvoiceRule,
  approvalDateRule,
  arithmeticRule,
]

/** Runs every rule without short-circuiting, so the analyst sees all findings at once. */
export function validatePackage(pkg: CasePackage, masterData: MasterData): ValidationResult {
  const ctx: RuleContext = { pkg, masterData, derived: {} }
  const blocks: Finding[] = []
  const confirmations: Finding[] = []
  let retroactive = false
  for (const rule of CONTROL_RULES) {
    const outcome = rule.evaluate(ctx)
    blocks.push(...(outcome.blocks ?? []))
    confirmations.push(...(outcome.confirmations ?? []))
    retroactive ||= outcome.retroactive ?? false
  }
  return {
    apta: blocks.length === 0,
    bloqueos: blocks,
    confirmaciones: confirmations,
    derivados: ctx.derived,
    retroactiva: retroactive,
  }
}
