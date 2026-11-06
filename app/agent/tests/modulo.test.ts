import { describe, expect, test } from "bun:test"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")
const body = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n\n/, "").trim()

// PRD 9.4: the module must use the same pieces as the application, not diverging copies.
describe("modulo/ matches the application sources", () => {
  test("agent.md body is app/agent/prompt.md", async () => {
    const agent = await Bun.file(join(root, "modulo/agent.md")).text()
    expect(body(agent)).toBe((await Bun.file(join(root, "app/agent/prompt.md")).text()).trim())
  })

  test("SKILL.md body is the knowledge file", async () => {
    const skill = await Bun.file(join(root, "modulo/skill/ordenes-compra/SKILL.md")).text()
    expect(body(skill)).toBe((await Bun.file(join(root, "app/agent/src/knowledge/ordenes-compra.md")).text()).trim())
  })

  test("tools/oc.ts re-exports the shared tool catalog", async () => {
    const tools = await Bun.file(join(root, "modulo/tools/oc.ts")).text()
    expect(tools).toContain('export * from "../../app/contracts/src/tools/index"')
  })
})
