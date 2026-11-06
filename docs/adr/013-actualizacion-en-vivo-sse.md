# ADR-013 · Actualización en vivo con bus de eventos y SSE

**Estado:** Aceptado · 2026-11-06

## Contexto
Lo que el agente haga (desde el chat, MCP o A2A) debe verse en la web sin recargar: estado de cada caso, confirmaciones pendientes, órdenes creadas y log de herramientas.

## Decisión
- `app/events.ts`: un `EventBus` tipado en memoria (sobre `EventEmitter`). `OcService` emite un evento por cada cambio de estado (SPEC §4).
- `channels/http/sse.ts`: `GET /api/events` con **Server-Sent Events**. Cada evento viaja como `event: <tipo>` + `data: <json>`, con un ping cada 25 s para que el proxy de Render no corte la conexión.
- La web carga `/api/estado` al abrir y luego aplica los eventos. Al reconectar, vuelve a pedir `/api/estado` para no perder nada.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| WebSockets | Bidireccional, pero aquí solo el servidor empuja. SSE es HTTP normal, reconecta solo y no necesita librería. |
| Polling cada N segundos | Simple, pero con retraso visible en la demo y peticiones inútiles. |
| Redis / broker de mensajes | Necesario con varias instancias; en un monolito de una instancia es sobreingeniería. |

## Consecuencias
- (+) La demo es muy visual: se escribe en el chat (o en Claude Code vía MCP) y la tarjeta del caso cambia en el momento.
- (+) Cero dependencias nuevas.
- (−) El bus en memoria solo funciona con una instancia. Para escalar, se reemplaza por un broker sin tocar `OcService` (emite contra la interfaz del bus).
