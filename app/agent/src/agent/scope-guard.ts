import { AGENT_PROFILE, agentIntroduction } from "@oc/contracts/agent-profile"

/*
 * Deterministic scope guard (ADR-019). A language model cannot be made deterministic with instructions,
 * so the decision of WHAT the agent answers is taken in code, before the model is called:
 * same message (and same pending state) → same decision, every time, at zero cost.
 */

export type ScopeDecision =
  | { kind: "in_scope" }
  | { kind: "introduction"; reply: string }
  | { kind: "out_of_scope"; reply: string }

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

/** Vocabulary of the purchase-order domain (accent-insensitive). */
const DOMAIN = [
  /\bsol-?\d{1,3}\b/,
  /\bsolicitud(es)?\b/,
  /\bcasos?\b/,
  /\boc\b/,
  /\bordene?s?\b/,
  /\bcompras?\b/,
  /\bsap\b/,
  /\bproveedor(es)?\b/,
  /\bcotizacion(es)?\b/,
  /\bfacturas?\b/,
  /\baproba(cion|ciones|dor|dora|dores|do|da)\b/,
  /\bcentros? de costo\b/,
  /\bsubareas?\b/,
  /\biva\b/,
  /\bcondiciones de pago\b/,
  /\brc\s?\d{1,2}\b/,
  /\bcontrol(es)?\b/,
  /\bvalida(r|cion|ciones|do|da)?\b/,
  /\bbloque(o|os|ada|ado|adas|ados)\b/,
  /\bconfirma(r|cion|ciones|do|da)?\b/,
  /\bretroactiv[ao]s?\b/,
  /\b(payload|evidencia|trazabilidad|maestros?)\b/,
  /\b(procesa|procesar|crea|crear|creala|revisa|revisar)\b/,
  /\bpendientes?\b/,
]

const GREETING = /^(hola|holi|buen[oa]s?( dias| tardes| noches)?|hey|saludos)\b/
const HELP = /\b(quien eres|que eres|como te llamas|que (puedes|sabes) hacer|en que (me )?(puedes )?ayudar|ayuda|help)\b/

const mentionsDomain = (text: string) => DOMAIN.some((pattern) => pattern.test(text))

/**
 * @param hasPendingConfirmation the last turn left a confirmation open, so short replies
 *        such as "sí" or "confirmo" belong to the purchase-order flow.
 */
export function decideScope(message: string, hasPendingConfirmation: boolean): ScopeDecision {
  const text = normalize(message)
  if (mentionsDomain(text)) return { kind: "in_scope" }
  if (hasPendingConfirmation && /\b(si|no|ok|dale|adelante|procede|confirmo|rechazo|cancela|espera)\b/.test(text)) {
    return { kind: "in_scope" }
  }
  if (GREETING.test(text) || HELP.test(text)) return { kind: "introduction", reply: agentIntroduction() }
  return { kind: "out_of_scope", reply: AGENT_PROFILE.outOfScopeReply }
}
