import { describe, expect, test } from "bun:test"
import { decideScope } from "../src/agent/scope-guard"

describe("deterministic scope guard", () => {
  test.each([
    "¿Cuánto es 2 más 2?",
    "Cuéntame un chiste",
    "Escríbeme una función en Python",
    "¿Quién ganó el mundial?",
    "traduce hello al español",
  ])("rejects off-topic: %s", (message) => {
    expect(decideScope(message, false).kind).toBe("out_of_scope")
  })

  test.each([
    "Procesa la solicitud sol-004",
    "¿Por qué está bloqueado sol-003?",
    "Crea la OC de SOL-001",
    "¿Qué confirmaciones están pendientes?",
    "Revisa el proveedor de la cotización",
    "¿Qué controles validas?",
  ])("accepts purchase-order requests: %s", (message) => {
    expect(decideScope(message, false).kind).toBe("in_scope")
  })

  test.each(["Hola", "Buenos días", "¿Quién eres?", "¿Qué puedes hacer?"])("introduces itself: %s", (message) => {
    const decision = decideScope(message, false)
    expect(decision.kind).toBe("introduction")
  })

  test("short confirmation replies count only when a confirmation is pending", () => {
    expect(decideScope("sí, dale", true).kind).toBe("in_scope")
    expect(decideScope("sí, dale", false).kind).toBe("out_of_scope")
  })

  test("is deterministic: same input, same decision", () => {
    const runs = Array.from({ length: 50 }, () => JSON.stringify(decideScope("¿Cuánto es 2 más 2?", false)))
    expect(new Set(runs).size).toBe(1)
  })
})
