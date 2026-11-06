# ADR-018 · Paquetes ortogonales (web, backend, agent) en un servicio con tres procesos

**Estado:** Aceptado · 2026-11-06 · **Reemplaza parcialmente a ADR-017** (se mantiene Next.js con SSR y TypeScript en todo; cambia quién hospeda la API, MCP y A2A)

## Contexto
Se pide que el proyecto tenga la estructura `app/` con **web**, **backend** y **agent**, cada uno **ortogonal** (independiente, sin importarse entre sí), en TypeScript y cumpliendo el PRD. El ADR-017 ponía todo dentro de Next.js, con lo que la web, el backend y el agente quedaban acoplados en un solo framework.

El despliegue sigue siendo **un servicio en Render** (decisión del candidato entre "un servicio con 3 procesos" y "tres servicios").

## Decisión

### Estructura (workspaces de Bun)

| Paquete | Responsabilidad | Runtime | Depende de |
|---|---|---|---|
| `app/contracts` | Lenguaje publicado: modelo del PRD (zod), `OcPort`, DTO de la API y del chat, eventos y **catálogo de herramientas `oc_*`** | — | `zod` |
| `app/backend` | Núcleo hexagonal (dominio, aplicación, infraestructura, SAP simulado) + adaptadores de entrada: REST, SSE, **MCP** y **A2A** | Bun | `contracts` |
| `app/agent` | Agente conversacional: adaptador LLM, ciclo, sesiones, prompt y conocimiento. Consume `OcPort` **por HTTP** | Bun | `contracts` |
| `app/web` | Next.js 16 con SSR: dashboard, chat, embed. Única entrada pública: hace de proxy de `/api`, `/mcp` y `/a2a` | Node | `contracts` |

**Regla de ortogonalidad:** ningún paquete importa a otro salvo `contracts`. Se comunican solo por HTTP con tipos compartidos. Se puede reemplazar cualquiera (por ejemplo, otro front u otro proveedor de agente) sin tocar los demás.

**¿Por qué las herramientas viven en `contracts`?** Las usan dos consumidores que no pueden importarse entre sí: el agente (con `OcPort` por HTTP) y el servidor MCP del backend (con `OcPort` en proceso). Tenerlas en el contrato garantiza **una sola definición** (ADR-011). `app/agent/src/tools/oc.ts` las reexporta en la ruta que sugiere el PRD.

### Ejecución

```
Render (1 Web Service, Docker)
└─ :PORT web (Next.js)              ← única entrada pública
     ├─ /api/chat, /api/sessions/* ─▶ :4100 agent
     ├─ /api/*  (incluye SSE)      ─▶ :4000 backend
     ├─ /mcp, /a2a                 ─▶ :4000 backend
     └─ /.well-known/agent-card.json ─▶ :4000 backend
```

- `scripts/dev.ts` y `scripts/start.ts` levantan los tres procesos. Si uno muere, se detienen todos y el supervisor sale con error para que Render reinicie el servicio.
- La web reenvía con un route handler (`app/api/[...path]`) y no con *rewrites*. Así agrega la `ACCESS_KEY` del lado del servidor (nunca llega al navegador) y deja pasar el streaming SSE sin buffer.
- Las páginas usan **SSR** contra el backend; los botones usan **server actions** con `refresh()`; el chat y el SSE son componentes cliente.
- `demo.ts` compone el backend en proceso con las herramientas del contrato (no levanta servidores ni necesita clave).

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Todo dentro de Next.js (ADR-017) | Acopla backend y agente al framework web; no cumple "ortogonal". |
| Tres servicios en Render | Tres despliegues, tres configuraciones, CORS y tres servicios que se duermen por separado. Se mantiene como evolución natural: el código ya está separado. |
| El agente importando el backend en proceso | Más rápido, pero rompe la ortogonalidad; el agente quedaría atado al runtime del backend. |
| Duplicar las herramientas en agente y MCP | Dos definiciones que divergen con el primer cambio. |

## Consecuencias
- (+) Cada paquete se entiende, se prueba y se reemplaza solo. El backend se prueba sin web ni LLM; el agente, con un `OcPort` falso; la web, contra cualquier backend que cumpla el contrato.
- (+) Pasar a tres servicios en el futuro es solo despliegue: cambiar `BACKEND_URL` y `AGENT_URL`.
- (+) MCP y A2A no gastan la clave del modelo; solo el chat la usa.
- (−) Un salto HTTP interno entre web, agente y backend (milisegundos en localhost).
- (−) Tres procesos en un contenedor: si uno falla, se reinicia el servicio completo (aceptable para el reto).
- (−) La imagen necesita Bun y Node (Next corre en Node). El Dockerfile copia el binario de Node sobre la imagen de Bun.
