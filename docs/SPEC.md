# SPEC — Agente "Órdenes de Compra SAP" (Reto 03) · v2

> Versión 2.0 · 2026-11-06 · Fuente: `reto-03/PRD.md` + requisitos adicionales del candidato
> v2 agrega: monolito modular con app web en vivo, agente determinista expuesto por **A2A**, herramientas expuestas por **MCP** y agente **embebible** en otros sitios. Las decisiones están en `docs/adr/` (ADR-008 a ADR-014).

---

## 1. Visión

Un solo despliegue (monolito) con tres caras sobre **el mismo núcleo**:

1. **App web**: muestra todo el reto (contexto, casos, documentos, maestros, reglas, SAP simulado, control) y trae el agente conversacional embebido. Lo que el agente hace se ve **en vivo** en la web.
2. **Agente conversacional** (LLM): la analista le pide acciones en lenguaje natural. Cumple todo el PRD.
3. **Canales de integración** para las siguientes etapas:
   - **A2A**: el *Agente OC* determinista (sin LLM) para que otros agentes le deleguen trabajo.
   - **MCP**: las herramientas `oc_*` para que cualquier host MCP (Claude Desktop, Claude Code, Cursor, otros agentes) las use.
   - **Embed**: el chat como widget (`<script>`) o iframe para otros sitios.
   - **Módulo** (`modulo/`): el bonus del PRD 9.4, agente empaquetado para plataformas de agentes.

**Principio rector:** hay una sola implementación de cada regla y cada caso de uso. Los canales son adaptadores delgados. Da igual por dónde entre la orden (chat, web, MCP o A2A): el resultado es el mismo y la web lo muestra.

---

## 2. Alcance y prioridades

| Prioridad | Qué | Por qué |
|---|---|---|
| **P0 · PRD** | Núcleo RC1–RC10, 5 herramientas `oc_*`, SAP simulado, `demo.ts`, ciclo del agente, chat, link, README, SOLUCION | Es lo que califican. No se negocia. |
| **P0 · Visión** | App web con información del reto, estado de casos en vivo (SSE) y chat embebido | Es el front del PRD, solo que más completo. |
| **P0 (decisión)** | Servidor MCP (`/mcp` HTTP + `bun run mcp` stdio) | Obligatorio por decisión del candidato. Reusa las herramientas. |
| **P0 (decisión)** | Agente OC determinista por A2A (`/a2a` + Agent Card) | Obligatorio por decisión del candidato. Integración agente a agente. |
| **Opcional** | Postgres en Render (ADR-015) | Diseñado; se implementa solo si sobra tiempo. |
| **P2** | Widget embebible (`/widget.js`, `/embed`) | Pocas líneas una vez existe el chat. |
| **P2** | `modulo/` (bonus PRD +10) | Generado desde los mismos archivos. |
| **Fuera** | PDF de evidencia, `oc_leer_excel`, streaming de tokens, push notifications A2A | Solo si sobra tiempo. |

---

## 3. Arquitectura (monolito modular, puertos y adaptadores)

```
                         ┌────────────────────────── Monolito (un proceso Bun) ──────────────────────────┐
 Navegador ─ web app ───▶│ channels/http   /  /api/*  /api/events (SSE)  /embed  /widget.js             │
 Otros sitios (widget) ─▶│      │                                                                        │
                         │      ▼                                                                        │
                         │ agent/  (LLM)  loop + sesiones ──▶ tools/oc.ts (zod, contrato PRD) ──┐       │
 Host MCP ──────────────▶│ channels/mcp   /mcp · stdio  ───▶ tools/oc.ts ─────────────────────┤       │
 Otro agente (A2A) ─────▶│ channels/a2a   /a2a · agent-card  (determinista, sin LLM) ─────────┤       │
                         │                                                                    ▼       │
                         │                    app/OcService (casos de uso) ◀── ConfirmationStore    │
                         │                         │            │                    EventBus ──▶ SSE │
                         │                         ▼            ▼                                      │
                         │                    core/ (reglas puras)   sap/SapAdapter → sap/mock         │
                         └───────────────────────────────┬────────────────────────────────────────────┘
                                          fixtures/ (solo lectura)   out/ (escritura)
```

| Capa | Responsabilidad | Depende de |
|---|---|---|
| `core/` | Tipos zod, maestros, parsers, RC1–RC10, payload, evidencia. **Funciones puras.** | nada |
| `app/` | `OcService` (casos de uso), `ConfirmationStore`, `EventBus`, repositorios en `out/` | `core/`, `sap/` |
| `sap/` | `SapAdapter` (interfaz PRD) + `mock.ts` | — |
| `tools/` | Contrato PRD 6.2: `{ description, args, execute }` sobre `OcService` | `app/` |
| `agent/`, `llm/` | Ciclo conversacional y adaptador de proveedor | `tools/` |
| `channels/http` | API, SSE, archivos web, embed | `agent/`, `app/` |
| `channels/mcp` | Registra `tools/oc.ts` como herramientas MCP | `tools/` |
| `channels/a2a` | Agent Card + ejecutor determinista | `app/` |

**Regla de dependencias:** las flechas solo apuntan hacia adentro. `core/` no importa nada del proyecto. Ningún canal importa a otro canal.

**Separación del PRD (la evalúan):** comportamiento → `agent/prompt.md`; conocimiento → `src/knowledge/ordenes-compra.md`; ejecución → `src/tools/` + `src/app/` + `src/core/`.

### 3.1 Estructura del repositorio (hexagonal, ADR-016)

```
reto-03-prada/
├── agent/prompt.md                         comportamiento del agente conversacional (PRD)
├── src/
│   ├── domain/                             DOMINIO · puro, sin I/O
│   │   ├── model.ts                       esquemas zod y tipos (PRD 7.1, 7.2, 7.4)
│   │   ├── normalize.ts · parsers.ts      NIT, nombres, montos, cotización, factura
│   │   ├── master-data.ts                     búsquedas puras sobre los maestros
│   │   ├── rules/                         una estrategia ControlRule por RC + validar()
│   │   ├── purchase-order-builder.ts                construcción de la OC con trazabilidad
│   │   ├── evidence.ts                    texto canónico + sha256
│   │   └── case-state.ts                  máquina de estados del caso
│   ├── application/                        APLICACIÓN
│   │   ├── ports/                          entrada: oc-port.ts · salida: data-source.ts, repository.ts, events.ts, clock.ts
│   │   ├── oc-service.ts                   casos de uso (fachada que implementa OcPort)
│   │   └── confirmations.ts               registro central por caso (ADR-012)
│   ├── infrastructure/                     ADAPTADORES DE SALIDA
│   │   ├── fixtures/fixture-data-source.ts     lee paquetes y maestros de fixtures/
│   │   ├── persistence/file-repository.ts   artefactos del PRD en out/  [postgres-repository.ts opcional]
│   │   ├── events/in-memory-event-bus.ts          publicador/observador en memoria
│   │   └── system-clock.ts
│   ├── sap/adapter.ts · sap/mock.ts        puerto SAP + adaptador simulado (ubicación exigida por el PRD)
│   ├── llm/adapter.ts · anthropic.ts · factory.ts   puerto LLM + adaptador Claude
│   ├── interfaces/                         ADAPTADORES DE ENTRADA
│   │   ├── http/  (api.ts, sse.ts, embed.ts)
│   │   ├── mcp/   (server.ts, stdio.ts)
│   │   └── a2a/   (agent-card.ts, commands.ts, executor.ts)
│   ├── tools/oc.ts · tools/registry.ts     adaptador de entrada con el contrato del PRD (oc_<export>)
│   ├── agent/loop.ts · agent/session.ts    agente conversacional
│   ├── knowledge/ordenes-compra.md         conocimiento del proceso (PRD)
│   ├── bootstrap.ts                        raíz de composición: crea e inyecta las implementaciones
│   └── server.ts                           arranque HTTP (usa bootstrap)
├── web/  index.html · app.js · chat.js · embed.html · widget.js · styles.css
├── modulo/                                 bonus PRD 9.4 (generado)
├── scripts/  a2a-client.ts · build-modulo.ts
├── tests/rules.test.ts                    los 6 casos del PRD con bun test
├── fixtures/reto-03/...                    sin modificar
├── docs/  SPEC.md · PLAN.md · PRD.md · adr/
├── demo.ts · Dockerfile · render.yaml · .env.example · package.json · tsconfig.json · bunfig.toml
├── README.md · SOLUCION.md
```

**Patrones aplicados** (detalle y justificación en ADR-016): Adapter (todos los adaptadores), Facade (`OcService`), Strategy (reglas y proveedor LLM), Builder (orden de compra), Observer (eventos → SSE), Decorator (envoltura de herramientas), Command (agente A2A), State (ciclo del caso), Factory Method (composición). Sin Singleton: todo se inyecta desde `bootstrap.ts`.

---

## 4. Casos de uso (`application/oc-service.ts`)

| Método | Hace | Evento emitido |
|---|---|---|
| `leerPaquete(caso)` | Carga y normaliza el paquete (PRD 7.2) | `caso.leido` |
| `validar(caso)` | Corre RC1–RC10 sin cortocircuito; si hay confirmaciones, las registra como `pendiente` | `caso.validado`, `confirmacion.pendiente` |
| `generarEvidencia(caso)` | Escribe `aprobacion.txt` + sha256 | `evidencia.generada` |
| `construirPayload(caso)` | Arma `OrdenCompra`, la valida con zod, guarda `payload.json` + `trazabilidad.json` | `payload.construido` |
| `crear(caso, { confirmado, canal })` | Idempotencia → revalida → exige confirmación **aprobada en el store** → verifica hash → SAP | `oc.creada` / `oc.idempotente` / `oc.rechazada` |
| `confirmar(caso, { canal, por, aprobar })` | Aprueba o rechaza la confirmación pendiente | `confirmacion.resuelta` |
| `estado()` | Instantánea para la web: casos, órdenes, control, confirmaciones, últimas trazas | — |
| `procesar(caso)` | Atajo: leer → validar → evidencia → payload (sin crear) | los anteriores |

Cada llamada a una herramienta también emite `herramienta.llamada` con `{ canal, herramienta, caso, ok, resumen }`, que alimenta el log en vivo.

**Estado de un caso** (lo que pinta la web):

```
sin_procesar → validado ─┬─▶ bloqueado
                         ├─▶ esperando_confirmacion ─▶ confirmado ─▶ oc_creada
                         └─────────────────────────────────────────▶ oc_creada
```

---

## 5. Reglas de control (sin cambios respecto a v1)

Normalizaciones: NIT sin puntos ni dígito de verificación; nombre en minúsculas, sin tildes, puntuación ni sufijos societarios; fechas comparadas como `YYYY-MM-DD`; aprobación con `/\baprobad[oa]\b/i`.

| # | Regla | Tipo | Código |
|---|---|---|---|
| RC1 | Proveedor existe (por NIT, o por nombre si no hay NIT) y está activo | Bloqueo | `SUPPLIER_NOT_FOUND` / `SUPPLIER_INACTIVE` |
| RC2 | Aprobación existe, dice "Aprobado" y viene de un aprobador del centro de costo | Bloqueo | `APPROVAL_MISSING` / `APPROVAL_TEXT_MISSING` / `APPROVER_NOT_AUTHORIZED` |
| RC3 | `valor_total ≤ tope` del aprobador (si RC2 falló, contra el tope máximo del centro) | Bloqueo | `APPROVER_LIMIT_EXCEEDED` |
| RC4 | La subárea pertenece al centro de costo | Bloqueo | `SUBAREA_INVALID` / `COST_CENTER_NOT_FOUND` |
| RC5 | Cotización vs solicitud ≤ 2 %; sin cotización también confirma | Confirmación | `QUOTE_MISMATCH` / `QUOTE_MISSING` |
| RC6 | IVA ausente → deriva del proveedor + confirmación | Confirmación + derivado | `VAT_DERIVED` |
| RC7 | Condiciones de pago ausentes → deriva del proveedor | Derivado | — |
| RC8 | Factura anterior a la solicitud → `retroactiva` + confirmación | Confirmación | `RETROACTIVE_PO` |
| RC9 | Aprobación anterior a la solicitud → confirmación | Confirmación | `APPROVAL_BEFORE_REQUEST` |
| RC10 | `cantidad × valor_unitario = valor_total ± 1` | Bloqueo | `ARITHMETIC_MISMATCH` |

---

## 6. Resultados esperados por caso

`demo.ts` y `scripts/a2a-client.ts` deben reproducir esta tabla. Que coincidan los dos es la prueba de que el agente A2A es determinista.

| Caso | Hallazgos | `apta` | Confirmación | `retroactiva` | Resultado |
|---|---|---|---|---|---|
| `sol-001` | Todo cuadra | ✅ | — | no | OC `4500000001`. Repetir devuelve el mismo número (`idempotente`). |
| `sol-002` | NIT `901999000` no está en el maestro | ❌ | — | no | Bloqueado RC1 → pedir creación del proveedor. |
| `sol-003` | Aprobó fvargas (CC-3030), no rtorres (CC-2020); 74 M > tope 30 M | ❌ | — | no | Bloqueado RC2 (+RC3). |
| `sol-004` | Solicitud 25 M vs cotización 26,5 M (6 %) | ✅ | RC5 | no | Confirmación con ambos valores → OC `4500000002`. |
| `sol-005` | Factura 2026-08-10 < solicitud 2026-08-27 | ✅ | RC8 | **sí** | Confirmación → OC `4500000003`, `retroactiva=true`. |
| `sol-006` | Sin NIT (por nombre), sin IVA (`C1`), sin condiciones (`Z030`) | ✅ | RC6 | no | Confirmación del IVA → OC `4500000004`. |

---

## 7. Payload, evidencia, SAP simulado y control

- **Payload:** esquema PRD 7.4 validado con zod. Valores de cantidad y precio tomados de la solicitud (no de la cotización). `sociedad` y `organizacion_compras` = `"1000"`. Proveedor desde el maestro. `cotizacion_ref` sale de la primera línea de la cotización. Una posición `10`. Descripción recortada a 40 caracteres. Unidad derivada: `H` si dice "hora(s)", `MES` si es mensual, si no `UN`. IVA y condiciones de la solicitud o derivados (RC6/RC7). `aprobador.evidencia_sha256` = hash de la evidencia. `excepciones[]` con una entrada por confirmación y `confirmado_por = "<canal>:<quién>"`. `trazabilidad.json` con la fuente de cada campo: `solicitud | cotizacion | aprobacion | maestro.<nombre> | derivado | constante`.
- **Evidencia:** `out/<caso>/aprobacion.txt` con encabezados, cuerpo y sha256 del contenido canónico.
- **SAP simulado:** secuencia desde `4500000001` en `out/sap/`, idempotencia por `solicitud_id` con `buscarOrdenPorReferencia` antes de crear.
- **Control:** `out/control.csv` = `solicitud_id,resultado,numero_oc,retroactiva,bloqueos,confirmaciones,ts` con `resultado ∈ creada | idempotente | bloqueada | pendiente`. Se agrega la columna `canal` al final.

---

## 8. Confirmaciones centralizadas (ADR-012)

Las confirmaciones viven en el servidor, **por caso** y no por sesión de chat, para que cualquier canal pueda verlas y resolverlas.

```ts
type Confirmacion = {
  caso: string
  codigos: string[]                    // ["QUOTE_MISMATCH"]
  detalle: Finding[]
  estado: "pendiente" | "aprobada" | "rechazada"
  resuelta_por?: { canal: "chat" | "web" | "a2a" | "mcp"; quien: string; ts: string }
}
```

| Canal | Cómo se aprueba | Quién es el humano |
|---|---|---|
| Chat | El **siguiente** mensaje del usuario es afirmativo (regex) o pulsa el botón Confirmar | La analista en el chat |
| Web | Botón **Aprobar / Rechazar** en el panel "Confirmaciones pendientes" | La analista en la web |
| MCP | `oc_crear` va marcada `destructiveHint`, así que el host pide permiso al usuario. Si el host soporta *elicitation*, el servidor pregunta directo. Si no, la confirmación debe aprobarse en la web. | El usuario del host MCP, o la analista en la web |
| A2A | La tarea queda en `input-required`. Por defecto (`A2A_ALLOW_CONFIRM=false`) se resuelve en la web y el cliente vuelve a consultar. Con `true`, el agente cliente puede confirmar respondiendo `{ "confirmar": true }`. | La analista en la web, o el agente cliente si se le delega |

`crear()` solo procede si la confirmación del caso está en `aprobada`. El argumento `confirmado` del PRD se mantiene como primer candado. Se conserva la integridad del ADR-005: las herramientas reciben solo `caso` y `crear()` verifica el hash del payload guardado.

---

## 9. Canal web (app + API + SSE)

### 9.1 Vistas de la app (`web/`)

| Vista | Contenido | Se actualiza en vivo |
|---|---|---|
| **El reto** | Problema, actores, objetivos O1–O4, arquitectura (el diagrama §3), cómo integrarse (MCP, A2A, embed) | — |
| **Casos** | Tarjeta por caso: estado (§4), proveedor, centro, valor, chips de bloqueos/confirmaciones. Al abrirla: documentos originales (correo, solicitud, cotización, aprobación, factura), tabla RC1–RC10, payload, trazabilidad y evidencia | ✅ |
| **Confirmaciones** | Pendientes con valores en conflicto y botones Aprobar / Rechazar | ✅ |
| **Maestros** | Proveedores, centros de costo con aprobadores y topes, IVA, condiciones de pago | — |
| **SAP y control** | Órdenes creadas (`ordenes.jsonl`), `control.csv` con % de retroactivas, log de herramientas con canal de origen | ✅ |
| **Panel del agente** | Chat fijo a la derecha en todas las vistas: tool calls como tarjetas, estado de confirmación resaltado | ✅ |

### 9.2 API

| Método | Ruta | Contrato |
|---|---|---|
| `POST` | `/api/chat` | `{ sessionId, message }` → `{ reply, toolCalls[], needsConfirmation, usage }` (PRD 6.4) |
| `GET` | `/api/sessions/:id` | Historial de la sesión (PRD 6.4) |
| `GET` | `/api/health` | `{ ok, provider, model, canales: ["http","mcp","a2a"] }` sin claves (PRD 6.4) |
| `GET` | `/api/estado` | Instantánea de `OcService.estado()` |
| `GET` | `/api/casos/:caso` | Documentos + último resultado de validación, payload y trazabilidad |
| `GET` | `/api/maestros` | Los 4 maestros |
| `POST` | `/api/confirmaciones/:caso` | `{ aprobar: boolean }` → resuelve desde la web |
| `POST` | `/api/reset` | Limpia `out/` (para repetir la demo) |
| `GET` | `/api/events` | SSE: `herramienta.llamada`, `caso.validado`, `confirmacion.*`, `oc.*` |

La web carga `/api/estado` al abrir y luego aplica los eventos SSE. Si la conexión SSE se cae, el navegador reconecta solo y vuelve a pedir `/api/estado`.

---

## 10. Canal MCP (ADR-011)

- SDK oficial `@modelcontextprotocol/sdk`. Mismo `McpServer` con dos transportes:
  - **Streamable HTTP** en `/mcp` (para hosts remotos y el link desplegado).
  - **stdio** con `bun run mcp` (para Claude Desktop / Claude Code en local).
- Herramientas: las 5 de `tools/oc.ts`, **mismos nombres, descripciones y esquemas zod**. No hay una segunda definición.
- Anotaciones: `oc_leer_paquete`, `oc_validar` → `readOnlyHint`. `oc_crear` → `destructiveHint`, `idempotentHint`.
- Recurso opcional: `oc://conocimiento` con `src/knowledge/ordenes-compra.md`. Prompt opcional: `procesar_solicitud(caso)` con el texto de `agent/prompt.md`.
- Las acciones por MCP pasan por `OcService`, así que **aparecen en vivo en la web** con `canal: "mcp"`.
- **No consume la clave del modelo:** el razonamiento lo pone el host MCP.
- Seguridad: si existe `ACCESS_KEY`, `/mcp` exige `Authorization: Bearer <ACCESS_KEY>`.

Ejemplo de conexión (README):

```bash
claude mcp add --transport http oc-sap https://<app>.onrender.com/mcp --header "Authorization: Bearer <ACCESS_KEY>"
```

---

## 11. Canal A2A: Agente OC determinista (ADR-010)

- **Determinista:** no usa LLM. Misma entrada, mismo resultado. Interpreta un comando estructurado; si no lo entiende, rechaza la tarea con ayuda. No adivina.
- SDK `@a2a-js/sdk`. JSON-RPC 2.0 en `/a2a`. Agent Card en `/.well-known/agent-card.json`.
- **Entrada** (en orden de preferencia):
  - `DataPart`: `{ "accion": "procesar" | "crear" | "estado" | "confirmar", "caso": "sol-004", "confirmar"?: boolean }`
  - `TextPart` con gramática fija: `^(procesar|crear|estado|confirmar)\s+(sol-\d{3})$` (sin distinguir mayúsculas).
- **Skills** de la Agent Card:

| id | Qué hace | Salida |
|---|---|---|
| `procesar-solicitud` | leer → validar → evidencia → payload | Artifact `resultado-validacion` (DataPart) + `payload-oc` (DataPart) |
| `crear-orden` | `crear()` con las reglas de confirmación §8 | Artifact `orden-creada` `{ numero_oc, fecha, idempotente }` |
| `consultar-estado` | Estado de un caso o de todos | Artifact `estado` |

- **Ciclo de la tarea:** `submitted → working →` uno de:
  - `completed`, con artifacts
  - `input-required`, si hay confirmación pendiente; el mensaje del agente lista los hallazgos
  - `rejected`, por comando inválido o caso inexistente
  - `failed`, por error interno, con un mensaje legible
- Seguridad: la Agent Card declara esquema `bearer` si existe `ACCESS_KEY`.
- `scripts/a2a-client.ts` recorre los 6 casos por A2A y compara contra la tabla §6.

---

## 12. Canal embed (ADR-014)

| Pieza | Uso en el sitio externo |
|---|---|
| `/widget.js` | `<script src="https://<app>/widget.js" data-titulo="Asistente OC" async></script>` → botón flotante que abre el chat en un iframe |
| `/embed` | `<iframe src="https://<app>/embed?key=...">` para incrustarlo directo |

- `web/chat.js` es **el mismo componente** que usa la app, así que hay una sola implementación del chat.
- `EMBED_ORIGINS` (lista separada por comas) controla `Content-Security-Policy: frame-ancestors` y CORS de `/api/chat`.
- Las acciones hechas desde un sitio externo también aparecen en vivo en la app web.

**`modulo/` (bonus PRD 9.4):** `scripts/build-modulo.ts` genera `modulo/agent.md` (frontmatter + `agent/prompt.md`), `modulo/tools/oc.ts` (reexporta `src/tools/oc.ts`) y `modulo/skill/ordenes-compra/SKILL.md` (frontmatter + `src/knowledge/ordenes-compra.md`). Son los mismos archivos, no copias que puedan divergir.

---

## 13. Agente conversacional (sin cambios de fondo respecto a v1)

- Ciclo propio sobre `LlmAdapter` (ADR-002), Claude Sonnet 5.5 en desarrollo y Opus 5.5 en la defensa (ADR-003).
- `MAX_ITERATIONS`, `MAX_SESSION_TOKENS`, `LLM_TIMEOUT_MS`.
- Las herramientas llaman a `OcService` **en proceso**, no por A2A (ADR-010 explica por qué y cómo cambiarlo en la siguiente etapa).
- `agent/prompt.md`: flujo de 5 pasos, prohibido inventar valores, tabla de validaciones, terminar con una pregunta cuando hay confirmación. Además: "si la confirmación ya fue resuelta en la web, informa y continúa".

---

## 14. `demo.ts`

Igual que en v1, sin clave: limpia `out/`, recorre los 6 casos con las herramientas, ejecuta `sol-001` dos veces e imprime la tabla §6. Para las confirmaciones llama a `OcService.confirmar(caso, { canal: "demo", aprobar: true })`, lo mismo que haría la web.

---

## 15. Variables de entorno (agregadas en v2)

| Variable | Defecto | Uso |
|---|---|---|
| `ACCESS_KEY` | vacía | Protege la web, `/api/*`, `/mcp` y `/a2a` |
| `EMBED_ORIGINS` | vacía (solo mismo origen) | Sitios que pueden embeber el chat |
| `A2A_ALLOW_CONFIRM` | `false` | Si un agente cliente A2A puede aprobar confirmaciones |
| `PUBLIC_URL` | `http://localhost:3000` | URL que publica la Agent Card |

---

## 16. Criterios de aceptación

**PRD (P0)**
- [ ] HU-1 a HU-6 como en v1; `demo.ts` reproduce la tabla §6.
- [ ] CA1–CA5 con el prompt de ejemplo de `sol-004`.
- [ ] Clave solo en env; link público; `SOLUCION.md` con 12 secciones.

**Visión (P0)**
- [ ] La web muestra el reto, los 6 casos con sus documentos, los maestros, SAP y control.
- [ ] Al procesar un caso desde el chat, su tarjeta cambia de estado **sin recargar**.
- [ ] Una confirmación pendiente puede aprobarse desde la web y el chat lo refleja.

**Integración (P1–P2)**
- [ ] MCP: `claude mcp add` + "procesa sol-001" crea la OC y la web la muestra con `canal: mcp`.
- [ ] A2A: `scripts/a2a-client.ts` reproduce la tabla §6; `sol-004` queda en `input-required` hasta aprobarse.
- [ ] Embed: una página HTML externa con `widget.js` abre el chat y opera.
- [ ] `modulo/` generado desde los mismos archivos.

---

## 17. Supuestos y preguntas abiertas

| # | Supuesto / pregunta |
|---|---|
| S1–S5 | Iguales a v1: herramientas reciben solo `caso`; payload con valores de la solicitud; fechas por día; sol-003 = RC2 + RC3; un ítem por solicitud. |
| S6 | "Determinista" aplica al **Agente OC** (A2A) y a todo el núcleo. La capa conversacional usa un LLM y por naturaleza no es determinista, pero no puede cambiar ningún resultado: solo decide qué herramienta llamar y redacta. |
| S7 | Las confirmaciones son por caso y globales al servidor (una sola analista, como dice el PRD). Multiusuario queda fuera. |
| S8 | Las sesiones, el store de confirmaciones y `out/` se pierden en cada reinicio de Render (ADR-006). |
| P1 | La rúbrica no está en el PRD. MCP, A2A y embed probablemente **no suman puntos directos** salvo el bonus de `modulo/`. Por eso van después de asegurar el P0. |
| P2 | Las versiones exactas de `@a2a-js/sdk` y `@modelcontextprotocol/sdk` se fijan y verifican al implementar (sus APIs cambian entre versiones). |
