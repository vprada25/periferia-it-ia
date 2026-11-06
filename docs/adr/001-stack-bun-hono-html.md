# ADR-001 · Stack: Bun + Hono + HTML plano

**Estado:** Reemplazado por [ADR-009](009-stack-v2-express-preact.md) · 2026-11-06 (propuesto 2026-11-05)

## Contexto
El PRD exige TypeScript (Bun o Node 20+), `zod` y un comando único de arranque en menos de 2 minutos. El front es libre. Hay 2 horas para todo, incluido el despliegue.

## Decisión
- **Runtime:** Bun. Ejecuta TypeScript sin compilar, trae `Bun.file`, `Bun.CryptoHasher` y el comando `bun run demo.ts` que pide el PRD.
- **HTTP:** Hono, porque es pequeño, tipado y sirve archivos estáticos con `serveStatic`.
- **Front:** un solo `web/index.html` con JS plano y `marked` desde CDN para las tablas.
- **Dependencias:** `zod`, `@anthropic-ai/sdk`, `hono`. Nada más en P0.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Node + Express + tsx | Un paso más de configuración y sin ventaja para el reto. |
| React/Vite en el front | Build y segundo servidor en desarrollo. Cuesta 15–20 min que no hay. |
| Next.js | Mezcla front y back y complica la separación herramientas/servidor que evalúan. |

## Consecuencias
- (+) Arranque con `bun install && bun run dev` y un solo proceso.
- (+) `demo.ts` importa las herramientas directo, sin servidor.
- (−) El front es básico: sin componentes ni estado complejo. Suficiente para el alcance.
- (−) Bun en algunos hosts gratuitos requiere Docker (ver ADR-007).
