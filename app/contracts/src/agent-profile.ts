/** Identity and fixed texts of the conversational agent, shared by the web (chat, widget) and the agent's scope guard. */
export const AGENT_PROFILE = {
  name: "Hermes",
  role: "Asistente de órdenes de compra",
  /** Served by the web from /public. */
  avatarPath: "/hermes-avatar.svg",
  greeting: "Hola, soy Hermes 👋",
  capabilities: [
    "Proceso solicitudes de compra (sol-001 … sol-006)",
    "Valido los controles RC1–RC10 contra los maestros",
    "Te muestro la OC tal como quedaría en SAP",
    "Creo la OC en SAP solo con tu confirmación",
    "Te explico por qué un caso quedó bloqueado",
  ],
  /** Deterministic answer for anything outside purchase orders (never sent to the model). */
  outOfScopeReply:
    "Solo puedo ayudarte con órdenes de compra: procesar y validar solicitudes, explicar bloqueos y crear la OC en SAP. Prueba, por ejemplo, con «Procesa la solicitud sol-004».",
} as const

export type AgentProfile = typeof AGENT_PROFILE

/** Deterministic introduction used for greetings and "what can you do?" questions. */
export function agentIntroduction(): string {
  const items = AGENT_PROFILE.capabilities.map((c) => `- ${c}`).join("\n")
  return `${AGENT_PROFILE.greeting}. Soy el ${AGENT_PROFILE.role.toLowerCase()}. Esto es lo que puedo hacer:\n\n${items}\n\nDime qué solicitud quieres revisar, por ejemplo «Procesa sol-004».`
}
