# Matriz de cumplimiento del PRD · Reto 03

Revisión punto por punto del PRD contra lo construido. Cada fila dice **dónde** está y **cómo verificarlo**.
Estado: ✅ cumple · ⚠️ cumple con desviación documentada · ⏳ pendiente · ➕ extra (fuera del PRD).

## 0–3. Ficha, objetivos

| Requisito | Estado | Evidencia |
|---|---|---|
| TypeScript (Bun/Node) en backend y herramientas | ✅ | `app/*`, `bun run typecheck` (strict, sin `any`) |
| Modelo con clave solo en variable de entorno | ✅ | `ANTHROPIC_API_KEY` solo la lee `app/agent`; `/api/health` no la expone |
| O1 · sol-001 crea OC sin intervención | ✅ | `bun run demo.ts` → `OC 4500000001` |
| O2 · sol-002 y sol-003 no crean OC, con razón y acción | ✅ | `demo.ts`; `tests/rules.test.ts` |
| O3 · sol-004 y sol-006 piden confirmación | ✅ | `demo.ts` (rechazo sin confirmar, luego OC) |
| O4 · sol-005 solo con confirmación y `retroactiva = true` en control | ✅ | `out/control.csv` |

## 5. Historias de usuario

| HU | Criterio | Estado | Evidencia |
|---|---|---|---|
| HU-1 | `oc_leer_paquete` → `{ correo, solicitud, cotizacion, aprobacion, factura? }` | ✅ | `app/backend/src/domain/case-package.ts` |
| HU-1 | Adjunto ausente → `null` con el nombre de lo que falta, sin excepción | ✅ | campo `faltantes` |
| HU-2 | `oc_validar` → `{ apta, bloqueos[], confirmaciones[], derivados, retroactiva }` | ✅ | `app/backend/src/domain/rules/` |
| HU-2 | Bloqueos impiden; confirmaciones solo con `confirmado = true`; derivados informados | ✅ | `OcService.create` + `ConfirmationStore` |
| HU-3 | Payload válido contra esquema zod | ✅ | `PurchaseOrderSchema.parse` en el builder |
| HU-3 | Trazabilidad en `out/<caso>/trazabilidad.json` con fuente por valor | ✅ | vocabulario `solicitud / cotizacion / maestro.<nombre> / derivado[:origen]` |
| HU-4 | P0 `aprobacion.txt` con encabezados, cuerpo y sha256 | ✅ | `out/<caso>/aprobacion.txt` |
| HU-4 | P1 `aprobacion.pdf` | ⏳ | no implementado (P1) |
| HU-5 | Solo si apta y (sin confirmaciones o `confirmado = true`) | ✅ | además exige aprobación humana registrada (ADR-012) |
| HU-5 | Secuencia desde 4500000001 en `out/sap/ordenes.jsonl` → `{ numero_oc, fecha }` | ✅ | `app/backend/src/sap/mock.ts` |
| HU-5 | Idempotencia por `solicitud_id` | ✅ | `demo.ts` (sol-001 dos veces) |
| HU-5 | Cada intento → fila en `out/control.csv` (`solicitud_id, resultado, numero_oc, retroactiva, bloqueos, confirmaciones, ts`) | ✅ | más columna `canal` al final |
| HU-6 | Paquete incompleto, JSON malformado, monto no numérico → `{ ok: false, error }` legible | ✅ | `case-package.ts`, decorador de herramientas |

## 6. Arquitectura

| Requisito | Estado | Evidencia |
|---|---|---|
| Front: historial, entrada, "pensando", cada tool call (nombre, args, resumen), confirmación resaltada | ✅ | `app/web/components/chat.tsx` (Hermes) |
| Backend con API, ciclo con tope de iteraciones y sesión | ✅ | `app/agent/src/agent/loop.ts`, `session.ts` |
| Herramientas con zod, separadas del servidor, importables desde `demo.ts` | ✅ | `app/contracts/src/tools`, reexportadas en `app/agent/src/tools/oc.ts` |
| Nombre `<archivo>_<export>`, `description` de una frase, `.describe()` en cada arg, `execute` devuelve string y nunca lanza | ✅ | `registry.ts` (decorador) |
| Firmas de la tabla 6.2 (`paquete`, `derivados`, `payload` como argumentos) | ⚠️ | las herramientas reciben solo `caso` y recalculan: el modelo no puede alterar montos (ADR-005, SOLUCION §3) |
| `ctx.directory` = raíz del proyecto | ✅ | `app/agent/src/bootstrap.ts`, MCP |
| Adaptador LLM propio `enviar(mensajes, herramientas)` | ✅ | `app/agent/src/llm/adapter.ts` |
| System prompt en Markdown aparte | ✅ | `app/agent/prompt.md` |
| CA1 tope de iteraciones | ✅ | `MAX_ITERATIONS` (25) |
| CA2 no afirmar valores fuera de herramientas | ✅ | prompt + herramientas que recalculan |
| CA3 confirmación en el turno siguiente, resaltada en el front | ✅ | registro central + botones Confirmar/Rechazar |
| CA4 cada tool call visible y en `out/log.jsonl` | ✅ | `{ ts, herramienta, ok, resumen }` + caso y canal |
| CA5 errores del LLM claros, la sesión no muere | ✅ | verificado con la clave sin workspace |
| API `POST /api/chat`, `GET /api/sessions/:id`, `GET /api/health` → `{ ok, provider, model }` | ✅ | `curl /api/health` |
| Separación comportamiento / conocimiento / ejecución | ✅ | `prompt.md` / `src/knowledge/` / herramientas |
| `SapAdapter` con la interfaz exacta en `src/sap/adapter.ts` | ✅ | `app/backend/src/sap/adapter.ts` |
| `demo.ts` sin clave: 6 casos, idempotencia, confirmación de sol-004 | ✅ | `bun run demo.ts` |

## 7. Requisitos funcionales

| Requisito | Estado | Evidencia |
|---|---|---|
| RC1–RC10 con sus tipos | ✅ | una estrategia por regla; `bun test` |
| Payload 7.4 (sociedad, posiciones, descripción ≤ 40, unidad, IVA, excepciones) | ✅ | builder |
| 7.5 Diseño del adaptador SAP real (opción, mapeo, credenciales, idempotencia, plan B) | ✅ | SOLUCION §6 |

## 8. No funcionales

| Requisito | Estado | Evidencia |
|---|---|---|
| Un comando levanta todo (< 2 min) | ✅ | `bun run dev` |
| Determinismo de `demo.ts`; `out/` se limpia | ✅ | reloj fijo, `reset()` |
| Seguridad: clave solo en el backend del agente; herramientas sin shell | ✅ | grep sin `spawn`/`exec` en herramientas |
| Topes de iteraciones y tokens configurables | ✅ | `MAX_ITERATIONS`, `MAX_SESSION_TOKENS` |
| Timeout al LLM con mensaje claro; un caso malo no detiene el siguiente | ✅ | `LLM_TIMEOUT_MS`; errores como valores |
| TypeScript sin `any` | ✅ | `bun run typecheck` |
| Dependencias justificadas | ✅ | SOLUCION §2 "Dependencias y por qué" |

## 9. Entregables

| Requisito | Estado | Evidencia |
|---|---|---|
| `SOLUCION.md` con las 12 secciones | ✅ | `SOLUCION.md` |
| `README.md` (un comando, variables, demo, link, clave) | ⏳ | el link se completa al desplegar |
| Link público activo | ⏳ | despliegue en Render (`render.yaml`) |
| Bonus `modulo/` con las mismas piezas que la app | ✅ | `bun run modulo`; `app/agent/tests/modulo.test.ts` |
| Entrega sin `node_modules/`, `out/`, `.env` | ✅ | `.gitignore` |

## Extras (fuera del PRD)

| Extra | Dónde |
|---|---|
| ➕ Panel con gráficas, dashboard en vivo (SSE) y consola de aprobación web | `app/web` |
| ➕ MCP (HTTP + stdio) con las mismas herramientas | `app/backend/src/interfaces/mcp` |
| ➕ Agente A2A determinista | `app/backend/src/interfaces/a2a`, `bun run a2a:demo` |
| ➕ Guardarraíl de alcance determinista (Hermes no responde fuera de tema) | `app/agent/src/agent/scope-guard.ts` |
| ➕ Chat embebible (`widget.js`) | `app/web/widget` |
| ➕ Navegación guiada: Hermes lleva a la pantalla de la acción | `app/web/components/floating-assistant.tsx` |
