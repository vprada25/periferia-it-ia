# ADR-009 · Stack v2: Bun + Express + Preact/htm sin build

**Estado:** Reemplazado por [ADR-017](017-nextjs-anfitrion-monolito.md) · 2026-11-06 (reemplazaba a ADR-001)

## Contexto
El ADR-001 eligió Hono y HTML plano para un chat sencillo. Con v2 cambian dos cosas:
1. Los SDK oficiales de MCP (`StreamableHTTPServerTransport`) y A2A (`A2AExpressApp`) traen integración directa con el modelo `req/res` de Node/Express.
2. La web ya no es solo un chat: tiene 5 vistas, estado en vivo y un chat reutilizable para embed.

## Decisión
- **Runtime:** Bun (sin cambios). Ejecuta Express sin problema gracias a su compatibilidad con `node:http`.
- **HTTP:** **Express 5**. Un solo `app` donde se montan `/api`, `/mcp`, `/a2a` y los estáticos.
- **Front:** **Preact + htm** cargados como módulos ES desde CDN con versión fija. Componentes con sintaxis parecida a JSX, **sin paso de build**. `web/chat.js` es un componente compartido entre la app y `/embed`.
- **Dependencias:** `zod`, `@anthropic-ai/sdk`, `express`, `@modelcontextprotocol/sdk`, `@a2a-js/sdk`. Versiones exactas en `package.json`, verificadas al instalar.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Mantener Hono | Habría que escribir puentes entre Hono y los transportes de MCP/A2A. Son 15–20 min de riesgo en un reto de 2 horas. |
| React + Vite | Segundo servidor en desarrollo y paso de build en Docker. Preact/htm da componentes sin eso. |
| HTML + JS plano | Con 5 vistas y estado en vivo, el código de manipulación del DOM crece rápido y es difícil de explicar en la defensa. |

## Consecuencias
- (+) MCP y A2A se montan en unas pocas líneas cada uno.
- (+) Sin build: `bun run dev` levanta todo en un comando, como pide el PRD.
- (−) Express es más pesado que Hono; irrelevante a esta escala.
- (−) Preact desde CDN depende de la red del navegador. Mitigación: versión fija y, si sobra tiempo, copiar los archivos a `web/vendor/`.
