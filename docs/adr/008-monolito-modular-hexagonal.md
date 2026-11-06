# ADR-008 · Monolito modular con puertos y adaptadores

**Estado:** Aceptado · 2026-11-06 · **Precisado por [ADR-016](016-hexagonal-y-patrones.md)** (capas y nombres hexagonales explícitos)

## Contexto
Además del PRD, se quiere: una app web que muestre el reto y refleje en vivo lo que hace el agente, el agente usable desde otros sitios (MCP, embed) y otros agentes (A2A), y dejar el camino abierto a "siguientes etapas". Todo debe salir en 2 horas y en un solo despliegue.

## Decisión
Un **monolito modular**: un proceso, un despliegue y un núcleo, con varios canales de entrada.

- `core/`: reglas y modelo de dominio, funciones puras (ADR-004).
- `app/OcService`: los casos de uso. **Única puerta** al núcleo. Emite eventos (ADR-013).
- `channels/*` (http, mcp, a2a) y `agent/`: adaptadores delgados que traducen su protocolo a llamadas de `OcService`.
- Las dependencias apuntan solo hacia adentro. Un canal nunca importa a otro.

El seam para las siguientes etapas es un puerto `OcPort` (la interfaz pública de `OcService`). Hoy lo implementa `OcService` en proceso. Mañana, si el Agente OC se separa en su propio servicio, se agrega `A2aOcPort` (un cliente A2A) y el resto no cambia.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Microservicios (web, agente LLM y agente OC separados) | Tres despliegues y comunicación por red en 2 horas. Más puntos de falla en la defensa sin ganar nada hoy. |
| Monolito sin capas (todo en `server.ts`) | Rápido de empezar, pero MCP y A2A duplicarían lógica, y el PRD evalúa la separación entre comportamiento, conocimiento y ejecución. |
| Que los canales llamen a las herramientas del PRD en vez de a `OcService` | Las herramientas devuelven strings JSON (contrato del PRD). Parsear JSON entre capas propias es frágil. Las herramientas son un canal más. |

## Consecuencias
- (+) Una regla se corrige en un lugar y queda corregida en chat, web, MCP y A2A.
- (+) La web se entera de todo lo que pasa sin importar el canal, porque todos pasan por `OcService`.
- (+) Se puede dividir después sin reescribir: el límite ya está dibujado.
- (−) Un proceso: si cae, caen todos los canales. Aceptable para el reto.
- (−) Más carpetas que un script simple; se compensa con nombres claros y la tabla de capas en la SPEC §3.
