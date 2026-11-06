import { resolve } from "node:path"
import { runAll } from "./processes"

const root = resolve(import.meta.dir, "..")
const port = process.env.PORT ?? "3000"

// Only the web process listens on the public PORT; backend and agent stay on internal ports.
await runAll([
  { name: "backend", cmd: ["bun", "src/main.ts"], cwd: `${root}/app/backend` },
  { name: "agent", cmd: ["bun", "src/main.ts"], cwd: `${root}/app/agent` },
  { name: "web", cmd: ["bun", "run", "start"], cwd: `${root}/app/web`, env: { PORT: port } },
])
