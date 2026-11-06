import type { Subprocess } from "bun"

export type ProcessSpec = { name: string; cmd: string[]; cwd: string; env?: Record<string, string> }

const COLORS = { backend: "\x1b[36m", agent: "\x1b[35m", web: "\x1b[32m" } as const
const RESET = "\x1b[0m"

/**
 * Runs the three orthogonal services as one unit (one Render service, three processes).
 * If any of them dies, the others are stopped and the supervisor exits non-zero so the platform restarts it.
 */
export async function runAll(specs: ProcessSpec[]): Promise<never> {
  const children: Subprocess[] = []
  const stopAll = (code: number) => {
    for (const child of children) child.kill()
    process.exit(code)
  }
  for (const spec of specs) {
    const color = COLORS[spec.name as keyof typeof COLORS] ?? ""
    const child = Bun.spawn(spec.cmd, {
      cwd: spec.cwd,
      env: { ...process.env, ...spec.env },
      stdout: "pipe",
      stderr: "pipe",
    })
    children.push(child)
    for (const stream of [child.stdout, child.stderr]) {
      void (async () => {
        const decoder = new TextDecoder()
        for await (const chunk of stream) {
          for (const line of decoder.decode(chunk).split("\n").filter(Boolean)) console.log(`${color}[${spec.name}]${RESET} ${line}`)
        }
      })()
    }
    void child.exited.then((code) => {
      console.error(`[${spec.name}] exited with code ${code}; stopping all services.`)
      stopAll(code === 0 ? 1 : code)
    })
  }
  process.on("SIGINT", () => stopAll(0))
  process.on("SIGTERM", () => stopAll(0))
  return new Promise<never>(() => {})
}
