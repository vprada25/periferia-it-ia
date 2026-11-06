import { A2A_PROTOCOL_VERSION, type AgentCard } from "@a2a-js/sdk"
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
  UnauthenticatedUser,
  defaultServerCallContextBuilder,
} from "@a2a-js/sdk/server"
import type { OcPort } from "@oc/contracts"
import { json } from "../http/responses"
import { OcAgentExecutor } from "./executor"

export type A2aOptions = { publicUrl: string; allowConfirm: boolean; protectedByKey: boolean }

export function buildAgentCard(options: A2aOptions): AgentCard {
  const skill = (id: string, name: string, description: string, examples: string[]) => ({
    id,
    name,
    description,
    tags: ["compras", "sap", "ordenes-de-compra"],
    examples,
    inputModes: ["application/json", "text/plain"],
    outputModes: ["application/json", "text/plain"],
    securityRequirements: [],
  })
  return {
    name: "Agente OC (determinista)",
    description:
      "Prepara y crea órdenes de compra en SAP aplicando los controles RC1–RC10. Determinista: no usa modelo de lenguaje; la misma entrada siempre produce el mismo resultado.",
    supportedInterfaces: [
      { url: `${options.publicUrl}/a2a`, protocolBinding: "JSONRPC", tenant: "", protocolVersion: A2A_PROTOCOL_VERSION },
    ],
    provider: { organization: "Reto 03 · Periferia IT Group", url: options.publicUrl },
    version: "1.0.0",
    capabilities: { streaming: false, pushNotifications: false, extensions: [], extendedAgentCard: false },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: [
      skill("procesar-solicitud", "Procesar solicitud", "Lee, valida (RC1–RC10), genera evidencia y arma el payload de la OC sin crearla.", [
        '{"accion":"procesar","caso":"sol-004"}',
        "procesar sol-004",
      ]),
      skill("crear-orden", "Crear orden de compra", "Crea la OC en el SAP simulado si es apta y su confirmación fue aprobada; idempotente por solicitud.", [
        '{"accion":"crear","caso":"sol-001"}',
        "crear sol-001",
      ]),
      skill("consultar-estado", "Consultar estado", "Devuelve el estado de un caso o de todos.", ['{"accion":"estado"}', "estado sol-005"]),
    ],
    signatures: [],
  }
}

/** Inbound A2A adapter (JSON-RPC over HTTP, A2A 1.0) built on the SDK's framework-agnostic transport handler. */
export function createA2aHandlers(oc: OcPort, options: A2aOptions) {
  const card = buildAgentCard(options)
  const requestHandler = new DefaultRequestHandler(card, new InMemoryTaskStore(), new OcAgentExecutor(oc, options))
  const transport = new JsonRpcTransportHandler(requestHandler)

  return {
    card: async (): Promise<Response> => json(card),
    rpc: async (req: Request): Promise<Response> => {
      let body: Record<string, unknown>
      try {
        body = (await req.json()) as Record<string, unknown>
      } catch {
        return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })
      }
      const context = defaultServerCallContextBuilder({
        extensions: undefined,
        user: new UnauthenticatedUser(),
        headers: Object.fromEntries(req.headers),
        requestedVersion: req.headers.get("A2A-Version") ?? A2A_PROTOCOL_VERSION,
      })
      const result = await transport.handle(body, context)
      if (typeof (result as AsyncGenerator<unknown>)[Symbol.asyncIterator] === "function") {
        return json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32004, message: "Streaming no soportado por este agente." } })
      }
      return json(result)
    },
  }
}
