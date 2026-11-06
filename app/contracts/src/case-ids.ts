import { z } from "zod"

export const CaseIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/, "Identificador de caso inválido")
