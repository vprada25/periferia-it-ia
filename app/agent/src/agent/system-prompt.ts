import { join } from "node:path"

/** Behavior (prompt.md) + knowledge (src/knowledge/*.md), kept as separate files per PRD 6.5. */
export async function loadSystemPrompt(agentDir: string): Promise<string> {
  const [behavior, knowledge] = await Promise.all([
    Bun.file(join(agentDir, "prompt.md")).text(),
    Bun.file(join(agentDir, "src/knowledge/ordenes-compra.md")).text(),
  ])
  return `${behavior.trim()}\n\n---\n\n${knowledge.trim()}\n`
}
