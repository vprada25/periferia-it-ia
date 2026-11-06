import { resolve } from "node:path"
import { runAll } from "./processes"

const root = resolve(import.meta.dir, "..")

await runAll([
  { name: "backend", cmd: ["bun", "--watch", "src/main.ts"], cwd: `${root}/app/backend` },
  { name: "agent", cmd: ["bun", "--watch", "src/main.ts"], cwd: `${root}/app/agent` },
  { name: "web", cmd: ["bun", "run", "dev"], cwd: `${root}/app/web` },
])
