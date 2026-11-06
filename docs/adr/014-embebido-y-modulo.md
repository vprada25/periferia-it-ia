# ADR-014 · Agente embebible: widget, iframe y módulo reutilizable

**Estado:** Aceptado · 2026-11-06

## Contexto
El agente debe poder vivir en otros sitios en siguientes etapas. Hay tres tipos de "otro sitio":
1. **Una página web** (intranet, portal de compras) donde una persona chatea.
2. **Un host de IA** que se conecta a herramientas (cubierto por MCP, ADR-011).
3. **Una plataforma de agentes** que carga la definición del agente desde archivos (lo que pide el bonus 9.4 del PRD).

## Decisión
**Para páginas web:**
- `/embed`: el chat solo, pensado para iframe.
- `/widget.js`: un script de unas 40 líneas que agrega un botón flotante y abre `/embed` en un iframe. Uso: `<script src="https://<app>/widget.js" async></script>`.
- `web/chat.js` es el mismo componente en la app y en el embed.
- `EMBED_ORIGINS` controla `frame-ancestors` y CORS. Si existe `ACCESS_KEY`, se pasa como parámetro del widget.

**Para plataformas de agentes (bonus PRD):**
- `scripts/build-modulo.ts` genera `modulo/` desde los archivos fuente: `agent/prompt.md` → `modulo/agent.md` (con frontmatter), `src/knowledge/ordenes-compra.md` → `modulo/skill/ordenes-compra/SKILL.md`, y `modulo/tools/oc.ts` reexporta `src/tools/oc.ts`.
- El PRD evalúa que sean las mismas piezas que usa la app, no copias divergentes. Generarlas lo garantiza.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Web Component con Shadow DOM | Más integrado al sitio anfitrión, pero hay que resolver estilos, CORS y estado por cuenta propia. El iframe aísla todo gratis. |
| Paquete npm del chat | Obliga al sitio anfitrión a tener build. Un `<script>` sirve en cualquier página. |
| Copiar a mano los archivos de `modulo/` | Divergen con el primer cambio; el PRD lo penaliza. |

## Consecuencias
- (+) Tres formas de reutilizar con muy poco código adicional sobre lo que ya existe.
- (+) El bonus del PRD sale casi gratis.
- (−) El iframe no comparte sesión con el sitio anfitrión (no sabe quién es el usuario). Suficiente para esta etapa; en la siguiente se pasaría un token de identidad.
- (−) Cada sitio que embeba el chat gasta la clave del modelo. Mitigación: `ACCESS_KEY`, `MAX_SESSION_TOKENS` y `EMBED_ORIGINS`.
