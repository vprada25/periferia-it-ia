# ADR-012 · Confirmaciones centralizadas y multicanal; la web como consola de aprobación

**Estado:** Aceptado · 2026-11-06 · **Modifica a ADR-005** (reemplaza el "candado 2"; la parte de integridad del payload sigue vigente)

## Contexto
En el ADR-005 la confirmación vivía en la sesión del chat. Con MCP y A2A, la orden puede llegar por canales que no tienen sesión de chat, y el humano que confirma puede estar en otro lugar (por ejemplo, la analista en la web aprobando lo que pidió un agente externo).

## Decisión
- Un `ConfirmationStore` en el servidor, **por caso**: `pendiente → aprobada | rechazada`, con canal, quién y cuándo (SPEC §8).
- `validar()` registra la confirmación como `pendiente`. `crear()` solo procede si está `aprobada`, sin importar el canal que llame.
- Formas de aprobar:
  - **Chat:** siguiente mensaje afirmativo, o botón Confirmar.
  - **Web:** panel "Confirmaciones pendientes" con Aprobar / Rechazar.
  - **MCP:** *elicitation* si el host la soporta; si no, desde la web.
  - **A2A:** la tarea queda en `input-required`. Por defecto la aprobación se hace en la web; con `A2A_ALLOW_CONFIRM=true`, el agente cliente puede confirmar (delegación explícita y configurable).
- Cada resolución emite `confirmacion.resuelta`; el chat y la web se actualizan.
- El argumento `confirmado` del PRD se mantiene como primer candado (lo pide HU-5).

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Mantener la confirmación en la sesión del chat | MCP y A2A no tendrían cómo confirmar, o confirmarían sin humano. |
| Dejar que cualquier canal confirme con `confirmado=true` | Un LLM ajeno (host MCP) podría auto-aprobar; es el riesgo que el PRD quiere evitar. |
| Tokens de confirmación firmados enviados al humano | Más seguro en producción, pero requiere un canal hacia el humano (correo, Teams) fuera del alcance. Se deja como evolución. |

## Consecuencias
- (+) Una sola regla de aprobación para todos los canales, auditable en `control.csv` (`confirmado_por = canal:quién`).
- (+) La web se convierte en la consola de aprobación de la analista, que es lo que pasaría en la operación real.
- (−) Estado global en memoria: con varias instancias o reinicios se pierde (ADR-006). Aceptado para el reto.
- (−) Sin autenticación de usuarios no se sabe *quién* aprobó en la web, solo el canal. Se registra como riesgo en SOLUCION.md §12.
