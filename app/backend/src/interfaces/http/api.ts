import { CaseIdSchema, type OcPort } from "@oc/contracts"
import { z } from "zod"
import type { EventPublisher } from "../../application/ports/events"
import { json, readJson, safely } from "./responses"
import { eventStream } from "./sse"

const ChannelSchema = z.enum(["chat", "web", "mcp", "a2a", "demo"])
const ActorSchema = z.object({ channel: ChannelSchema.default("web"), who: z.string().max(80).optional() })
const CreateSchema = ActorSchema.extend({ confirmed: z.boolean().default(false) })
const ConfirmSchema = ActorSchema.extend({ approve: z.boolean() })
const ActivitySchema = z.object({
  herramienta: z.string().max(80),
  caso: z.string().max(40).nullable(),
  ok: z.boolean(),
  resumen: z.string().max(400),
  canal: ChannelSchema,
})

type RouteRequest = Request & { params: Record<string, string> }
type Handler = (req: RouteRequest) => Promise<Response>
export type RouteTable = Record<string, Partial<Record<"GET" | "POST", Handler>>>

const caseIdOf = (req: RouteRequest) => CaseIdSchema.parse(req.params.caseId)

/**
 * Inbound HTTP adapter of the backend. Every handler is a thin translation
 * Request → OcPort call → Response; no business rule lives here.
 */
export function createApiRoutes(oc: OcPort, events: EventPublisher, channels: string[]): RouteTable {
  const handle = (fn: Handler): Handler => (req) => safely(() => fn(req))
  return {
    "/api/health": { GET: async () => json({ ok: true, service: "backend", channels }) },
    "/api/state": { GET: handle(async () => json(await oc.snapshot())) },
    "/api/master-data": { GET: handle(async () => json(await oc.masterData())) },
    "/api/cases": { GET: handle(async () => json(await oc.listCases())) },
    "/api/cases/:caseId": { GET: handle(async (req) => json(await oc.caseDetail(caseIdOf(req)))) },
    "/api/cases/:caseId/package": { GET: handle(async (req) => json(await oc.readPackage(caseIdOf(req)))) },
    "/api/cases/:caseId/validate": {
      POST: handle(async (req) => json(await oc.validate(caseIdOf(req), ActorSchema.parse(await readJson(req))))),
    },
    "/api/cases/:caseId/evidence": { POST: handle(async (req) => json(await oc.generateEvidence(caseIdOf(req)))) },
    "/api/cases/:caseId/payload": { POST: handle(async (req) => json(await oc.buildPayload(caseIdOf(req)))) },
    "/api/cases/:caseId/process": {
      POST: handle(async (req) => json(await oc.process(caseIdOf(req), ActorSchema.parse(await readJson(req))))),
    },
    "/api/cases/:caseId/create": {
      POST: handle(async (req) => json(await oc.create(caseIdOf(req), CreateSchema.parse(await readJson(req))))),
    },
    "/api/confirmations/:caseId": {
      GET: handle(async (req) => json(await oc.getConfirmation(caseIdOf(req)))),
      POST: handle(async (req) => {
        const body = ConfirmSchema.parse(await readJson(req))
        return json(await oc.confirm(caseIdOf(req), { approved: body.approve, channel: body.channel, who: body.who ?? "analista" }))
      }),
    },
    "/api/activity": {
      POST: handle(async (req) => {
        await oc.recordActivity(ActivitySchema.parse(await readJson(req)))
        return json({ ok: true })
      }),
    },
    "/api/reset": {
      POST: handle(async () => {
        await oc.reset()
        return json({ ok: true })
      }),
    },
    "/api/events": { GET: async (req) => eventStream(events, req.signal) },
  }
}
