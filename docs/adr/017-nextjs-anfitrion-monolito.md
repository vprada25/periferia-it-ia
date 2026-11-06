# ADR-017 · Next.js como anfitrión del monolito, con SSR y TypeScript en todo

**Estado:** Reemplazado parcialmente por [ADR-018](018-paquetes-ortogonales-tres-procesos.md) · 2026-11-06 (sigue vigente: Next.js con SSR y TypeScript en todo; ya no hospeda la API, MCP ni A2A)

## Contexto
Se pide que la web esté en **Next.js**, con **SSR donde haga falta** y **TypeScript tipado en todo** (front incluido). Siguen vigentes el monolito de un solo despliegue (ADR-008/016), los canales MCP y A2A, y el `demo.ts` que importa las herramientas sin servidor (PRD 6.6).

Al revisar los SDK instalados se confirmó que no dependen de Express:
- MCP (`@modelcontextprotocol/sdk` 1.32): `WebStandardStreamableHTTPServerTransport`, que recibe un `Request` y devuelve un `Response`.
- A2A (`@a2a-js/sdk` 1.3): `JsonRpcTransportHandler.handle(body, context)`, independiente del framework.

## Decisión
**Next.js 16 (App Router) es el único proceso HTTP del monolito.**

| Pieza | Dónde | Cómo |
|---|---|---|
| Páginas | `app/(dashboard)/**/page.tsx` | **Server components con SSR**: leen el estado llamando a `OcPort` en el servidor, así la primera carga llega con datos y sin parpadeo. |
| Partes interactivas | `app/_components/*.tsx` (`"use client"`) | Chat, botones de procesar/aprobar y la suscripción en vivo (SSE → `router.refresh()`). |
| API del PRD y del dashboard | `app/api/**/route.ts` | Route handlers delgados que delegan en `src/interfaces/http/*` (funciones `Request → Response`, sin depender de Next). |
| SSE | `app/api/events/route.ts` | `ReadableStream` con ping cada 25 s (ADR-013). |
| MCP | `app/mcp/route.ts` | Transporte web estándar del SDK. |
| A2A | `app/a2a/route.ts` y `app/.well-known/agent-card.json/route.ts` | `JsonRpcTransportHandler` + Agent Card. |
| Embed | `app/embed/page.tsx` + `public/widget.js` | El mismo componente de chat. |

**Raíz de composición compartida:** Next puede cargar el mismo módulo en varias capas (RSC, route handlers), y eso duplicaría el estado en memoria (confirmaciones, sesiones). `src/bootstrap.ts` expone `getContainer()`, que guarda **una** instancia por proceso en `globalThis`. Es el patrón que Next recomienda para clientes de base de datos. No es un Singleton de negocio: el contenedor sigue construyéndose por inyección y las pruebas y `demo.ts` crean el suyo con `createContainer()`.

**Runtime:** Node.js, el runtime estándar de Next. El código del núcleo deja de usar APIs exclusivas de Bun (`Bun.file`, `Bun.write`, `import.meta.dir`) y usa `node:fs/promises`. Así corre igual en Next (Node), en `bun test` y en `bun run demo.ts`. Bun se mantiene como gestor de paquetes y para pruebas y scripts.

**TypeScript en todo:** `.ts`/`.tsx` en back y front, `strict` + `noUncheckedIndexedAccess`, sin `any`. Los tipos de la API los comparten servidor y cliente (`src/application/ports/oc-port.ts`), así el front no redefine contratos.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Next.js para el front + Express/Bun para el back (dos procesos) | Dos procesos y dos puertos en un mismo contenedor, proxy entre ellos y CORS. Rompe la idea de un solo proceso. |
| Servidor custom (Express que delega en Next) | Next desaconseja el servidor custom (se pierden optimizaciones) y bajo Bun es frágil. |
| Next con SSR también para el chat | El chat es interactivo por naturaleza; renderizarlo en el servidor no aporta. Se hace SSR del historial y del estado, y lo interactivo es componente cliente. |
| Mantener Preact/htm sin build | No cumple "Next.js" ni "TypeScript en todo". |

## Consecuencias
- (+) Un solo framework y un solo proceso para web, API, SSE, MCP y A2A.
- (+) Primera carga con datos (SSR) y actualización en vivo por SSE.
- (+) Tipos compartidos de punta a punta: un cambio de contrato rompe la compilación del front.
- (+) Los handlers de `src/interfaces/http` son `Request → Response` puros: se prueban sin Next y se podrían montar en otro servidor.
- (−) Next agrega un paso de build (`next build`) y más peso al despliegue. Aceptable en Render.
- (−) Estado en memoria compartido vía `globalThis`: válido con una instancia (igual que ADR-006/013); con varias instancias se necesita Postgres (ADR-015) y un broker.
- (−) Se reescribe la capa HTTP hecha en Express. El dominio, la aplicación, las herramientas y el agente no cambian, lo cual valida la separación hexagonal.
