"use client"

import { useActionState } from "react"
import type { ActionState } from "@/lib/actions"

type Variant = "primary" | "ok" | "danger" | "default"

/** Button bound to a server action; shows pending state and the action's result message. */
export function ActionButton(props: {
  action: (prev: ActionState) => Promise<ActionState>
  label: string
  variant?: Variant
}) {
  const [state, formAction, pending] = useActionState(props.action, null)
  return (
    <form action={formAction} className="action-form">
      <button className={props.variant ?? "default"} disabled={pending}>
        {pending ? "Procesando…" : props.label}
      </button>
      {state && <span className={state.ok ? "hint ok-text" : "hint danger-text"}>{state.message}</span>}
    </form>
  )
}
