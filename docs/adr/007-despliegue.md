# ADR-007 · Despliegue en Render con Docker

**Estado:** Aceptado · 2026-11-05

## Contexto
Se pide un link público activo durante la defensa. Sin link hay −10 puntos. Hay unos 10 minutos de presupuesto para desplegar.

## Decisión
- **Render**, Web Service desde el repositorio de GitHub con un `Dockerfile` basado en `oven/bun:1`.
- Variables en el panel de Render: `ANTHROPIC_API_KEY`, `LLM_MODEL`, `MAX_ITERATIONS`, `MAX_SESSION_TOKENS`, `ACCESS_KEY`.
- Protección liviana opcional: si existe `ACCESS_KEY`, el front la pide una vez y la envía en el header `x-access-key`. La clave de acceso va en el README (lo permite el PRD). Esto evita que un tercero gaste la clave del modelo.
- **Plan B:** `cloudflared tunnel --url http://localhost:3000` desde la máquina local si Render falla.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Vercel | Funciones serverless con disco de solo lectura y sin estado en memoria entre peticiones; rompe sesiones y `out/`. |
| Fly.io | Funciona bien, pero exige la CLI y una tarjeta; más pasos. |
| Railway | Opción equivalente; queda como alternativa si Render tarda. |

## Consecuencias
- (+) Un proceso persistente: las sesiones en memoria y `out/` viven mientras el servicio esté arriba.
- (−) El plan gratuito se duerme tras inactividad (arranque en frío de ~30–60 s). Mitigación: abrir el link 2 minutos antes de la defensa.
- (−) Disco efímero (ver ADR-006).
- (+) Actualización 2026-11-06: el mismo servicio publica la web, `/api`, `/api/events` (SSE), `/mcp`, `/a2a` y `/.well-known/agent-card.json`. `PUBLIC_URL` debe apuntar al dominio de Render para que la Agent Card publique la URL correcta. El ping SSE cada 25 s (ADR-013) evita que el proxy corte la conexión.
- (+) Actualización 2026-11-06 (ADR-015): la infraestructura se declara en un **Blueprint `render.yaml`** con el Web Service (Docker) y la base Render Postgres (plan gratuito, misma región). `DATABASE_URL` se inyecta con `fromDatabase` (cadena de conexión interna) y la clave del modelo se marca `sync: false` para cargarla a mano en el panel. Un solo "New → Blueprint" crea todo.
