# Reto 03 · Agente "Órdenes de Compra SAP"

Agente que lee el paquete de una compra (solicitud, cotización, aprobación y factura), lo valida contra los maestros con los controles RC1–RC10, arma la orden de compra con trazabilidad, guarda la evidencia de aprobación y la crea en un SAP simulado. Las excepciones no se fuerzan: vuelven a la analista para que decida.

- **Web (Next.js, SSR):** el reto, los casos con sus documentos, confirmaciones, SAP/control y maestros, con el chat del agente al lado. Todo se actualiza en vivo.
- **Agente conversacional:** Claude con herramientas `oc_*` (contrato del PRD).
- **MCP:** las mismas herramientas para cualquier host MCP.
- **A2A:** un Agente OC **determinista** (sin LLM) para otros agentes.
- **Embed:** el chat como widget para cualquier sitio.

La explicación de la solución está en [`SOLUCION.md`](SOLUCION.md); la especificación en [`docs/SPEC.md`](docs/SPEC.md) y las decisiones en [`docs/adr/`](docs/adr/README.md).

**Link de prueba:** `https://<servicio>.onrender.com` (se completa al desplegar) · **Clave de acceso:** se entrega con el link si `ACCESS_KEY` está activa.

---

## Requisitos

- [Bun](https://bun.sh) 1.4 o superior
- Node.js 20.9 o superior (lo usa Next.js)
- Una clave de Anthropic **solo para el chat**. `demo.ts`, las pruebas, la web, MCP y A2A funcionan sin clave.

## Levantar en local (un comando)

```bash
bun install
cp .env.example .env      # y completa ANTHROPIC_API_KEY
bun run dev
```

Abre http://localhost:3000. `bun run dev` levanta los tres procesos (web :3000, backend :4000 y agent :4100) y les pasa el `.env`.

## Verificación sin modelo (PRD 6.6)

```bash
bun run demo.ts
```

Procesa los 6 casos llamando a las herramientas directamente, muestra la idempotencia (sol-001 dos veces) y la confirmación explícita (sol-004). La salida es determinista.

```bash
bun test          # reglas RC1–RC10 contra los 6 casos del PRD
bun run typecheck # TypeScript estricto en los 4 paquetes
```

## Variables de entorno

| Variable | Obligatoria | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | Para el chat | Clave del modelo. Solo la lee el proceso del agente. |
| `LLM_MODEL` | No | `claude-sonnet-5-5` por defecto; `claude-opus-5-5` para la defensa. |
| `LLM_EFFORT`, `LLM_TIMEOUT_MS` | No | Esfuerzo de razonamiento y timeout por llamada. |
| `MAX_ITERATIONS`, `MAX_SESSION_TOKENS` | No | Topes de costo por turno y por sesión. |
| `PORT`, `BACKEND_PORT`, `AGENT_PORT`, `BACKEND_URL`, `AGENT_URL` | No | Puertos y URLs internas. |
| `PUBLIC_URL` | En producción | URL pública que publica la Agent Card de A2A. |
| `ACCESS_KEY` | No | Protege la web (login), `/api`, `/mcp` y `/a2a`. |
| `EMBED_ORIGINS` | No | Sitios que pueden embeber el chat. |
| `A2A_ALLOW_CONFIRM` | No | Si un agente A2A puede aprobar confirmaciones (por defecto, no). |

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/chat` | `{ sessionId, message }` → `{ reply, toolCalls[], needsConfirmation, usage }` |
| `GET` | `/api/sessions/:id` | Historial de la sesión |
| `GET` | `/api/health` | Estado del servicio, sin claves |
| `GET` | `/api/state` | Casos, confirmaciones, órdenes, control y actividad |
| `GET` | `/api/events` | Eventos en vivo (SSE) |
| `POST` | `/api/cases/:caso/{process,create}` · `/api/confirmations/:caso` | Operar desde la web o desde otro sistema |

El detalle completo está en `docs/SPEC.md` §9.2.

## Integraciones

**MCP (HTTP):**

```bash
claude mcp add --transport http oc-sap https://<servicio>.onrender.com/mcp --header "Authorization: Bearer <ACCESS_KEY>"
```

**MCP (stdio, local):**

```bash
claude mcp add oc-sap -- bun "$(pwd)/app/backend/src/interfaces/mcp/stdio.ts"
```

**A2A:** Agent Card en `/.well-known/agent-card.json`; JSON-RPC (A2A 1.0) en `/a2a`. Comandos: `{"accion":"procesar|crear|confirmar|estado","caso":"sol-004"}` o el texto `procesar sol-004`.

```bash
bun run a2a:demo     # recorre los 6 casos por A2A
```

**Embed:**

```html
<script src="https://<servicio>.onrender.com/widget.js" data-title="Asistente OC" async></script>
```

**Módulo reutilizable (bonus PRD 9.4):** `bun run modulo` genera `modulo/` desde los mismos archivos que usa la app.

## Despliegue en Render

1. Sube el repositorio a GitHub.
2. En Render: **New → Blueprint** y elige el repositorio (usa `render.yaml`).
3. Carga `ANTHROPIC_API_KEY`, `PUBLIC_URL` (la URL que asigne Render) y, opcionalmente, `ACCESS_KEY`.
4. Abre el link unos minutos antes de la defensa: el plan gratuito se duerme tras 15 minutos sin uso.

## Estructura

```
app/contracts   tipos, esquemas y herramientas oc_* compartidos
app/backend     núcleo hexagonal + REST, SSE, MCP y A2A
app/agent       agente conversacional (Claude) + prompt.md + conocimiento
app/web         Next.js con SSR, chat y embed
scripts/        supervisor de procesos, cliente A2A, generador del módulo
fixtures/       datos del reto (solo lectura)
out/            artefactos generados (se ignora en git)
```
