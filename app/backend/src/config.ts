import { resolve } from "node:path"
import { z } from "zod"

const EnvSchema = z.object({
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  /** Repository root: holds fixtures/ (read-only) and out/ (artifacts). */
  OC_ROOT_DIR: z.string().default(resolve(import.meta.dir, "../../..")),
  PUBLIC_URL: z.string().default("http://localhost:3000"),
  ACCESS_KEY: z.string().optional(),
  A2A_ALLOW_CONFIRM: z
    .string()
    .optional()
    .transform((v) => v === "true"),
})

export type BackendConfig = z.infer<typeof EnvSchema>

export function loadBackendConfig(env: Record<string, string | undefined> = process.env): BackendConfig {
  const cleaned = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v]))
  return EnvSchema.parse(cleaned)
}
