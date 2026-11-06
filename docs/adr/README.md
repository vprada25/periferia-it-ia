# Registro de decisiones de arquitectura (ADR)

Formato: Contexto → Decisión → Alternativas descartadas → Consecuencias. Estado: Propuesto | Aceptado | Modificado | Reemplazado.
Un ADR no se reescribe: si una decisión cambia, se escribe uno nuevo y el anterior se marca como reemplazado o modificado.

| ADR | Título | Estado |
|---|---|---|
| [001](001-stack-bun-hono-html.md) | Stack: Bun + Hono + HTML plano | Reemplazado por 009 |
| [002](002-ciclo-agente-manual.md) | Ciclo del agente propio con adaptador LLM | Aceptado |
| [003](003-modelo-claude.md) | Proveedor y modelo: Anthropic Claude (Sonnet 5.5 / Opus 5.5) | Aceptado |
| [004](004-reglas-dominio-puro.md) | Reglas de control como dominio puro y determinista | Aceptado |
| [005](005-confirmacion-e-integridad.md) | Confirmación humana con doble candado e integridad del payload | Modificado por 012 |
| [006](006-persistencia-archivos-idempotencia.md) | Persistencia en archivos e idempotencia del SAP simulado | Aceptado |
| [007](007-despliegue.md) | Despliegue en Render con Docker | Aceptado |
| [008](008-monolito-modular-hexagonal.md) | Monolito modular con puertos y adaptadores | Precisado por 016 |
| [009](009-stack-v2-express-preact.md) | Stack v2: Bun + Express + Preact/htm sin build | Reemplazado por 017 |
| [010](010-agente-oc-determinista-a2a.md) | Agente OC determinista expuesto por A2A | Aceptado |
| [011](011-servidor-mcp.md) | Servidor MCP con las mismas herramientas | Aceptado |
| [012](012-confirmaciones-centralizadas.md) | Confirmaciones centralizadas y multicanal | Aceptado |
| [013](013-actualizacion-en-vivo-sse.md) | Actualización en vivo con bus de eventos y SSE | Aceptado |
| [014](014-embebido-y-modulo.md) | Agente embebible: widget, iframe y módulo reutilizable | Aceptado |
| [015](015-postgres-en-render.md) | Postgres en Render como almacén de estado (diseño; implementación opcional) | Aceptado como diseño |
| [016](016-hexagonal-y-patrones.md) | Arquitectura hexagonal explícita y patrones de diseño | Aceptado |
| [017](017-nextjs-anfitrion-monolito.md) | Next.js como anfitrión del monolito, con SSR y TypeScript en todo | Reemplazado parcialmente por 018 |
| [018](018-paquetes-ortogonales-tres-procesos.md) | Paquetes ortogonales (web, backend, agent) en un servicio con tres procesos | Aceptado |
| [019](019-guardarrail-de-alcance.md) | Guardarraíl de alcance determinista antes del modelo | Aceptado |

Los trade-offs de estos ADR alimentan directamente la sección 8 de `SOLUCION.md` ("Decisiones y trade-offs, mínimo 3"). Los más fuertes para la defensa: 005/012 (confirmación real), 016 (hexagonal y patrones), 018 (paquetes ortogonales), 010 (determinismo por A2A), 011 (MCP con una sola definición de herramientas).
