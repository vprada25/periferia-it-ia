import { createHash } from "node:crypto"
import type { RawApproval } from "@oc/contracts"

export type ApprovalEvidence = { content: string; sha256: string; document: string }

/** Canonical text of the approval email; the same input always yields the same hash. */
export function renderApprovalEvidence(approval: RawApproval): ApprovalEvidence {
  const content = [
    `De: ${approval.de}`,
    `Para: ${approval.para ?? ""}`,
    `CC: ${(approval.cc ?? []).join(", ")}`,
    `Fecha: ${approval.fecha}`,
    `Asunto: ${approval.asunto ?? ""}`,
    "",
    approval.cuerpo.replace(/\r\n/g, "\n"),
  ].join("\n")
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex")
  const document = `${content}\n---\nSHA-256 del contenido anterior: ${sha256}\n`
  return { content, sha256, document }
}

export function sha256Of(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")
}
