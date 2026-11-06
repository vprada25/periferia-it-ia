# Plan de trabajo — Reto 03 · v2 · 2 horas

> Referencias: `docs/SPEC.md` (qué construir) y `docs/adr/` (por qué así).
> v2 agrega web en vivo, MCP, A2A y embed. **El alcance completo no cabe con holgura en 2 horas**, así que el plan se ordena por valor:
> primero lo que califica el PRD, después lo que suma a la visión. Cada bloque deja algo funcionando y con commit.

---

## Presupuesto de tiempo

| Paquete | Minutos | Prioridad |
|---|---|---|
| Núcleo + herramientas + `demo.ts` | 35 | P0 PRD |
| Agente conversacional + API + SSE | 16 | P0 PRD |
| App web en vivo + chat embebido | 18 | P0 PRD + visión |
| Despliegue | 8 | P0 PRD (−10 si falta) |
| MCP | 10 | **Obligatorio** |
| A2A | 12 | **Obligatorio** |
| Embed + `modulo/` | 6 | P2 (bonus +10) |
| Postgres (ADR-015) | +10 | Opcional, fuera de los 120 |
| Documentación | 10 | P0 PRD |
| Arranque | 5 | — |
| **Total** | **120** | **sin holgura** |

**Lectura honesta:** no hay margen. Cualquier tropiezo se paga recortando desde abajo (ver "Qué recortar"). El P0 completo cabe en 92 minutos; con eso ya se aprueba el PRD y se tiene la web en vivo.

---

## Línea de tiempo

| # | Bloque | Reloj | Entregable al cerrar | Commit |
|---|---|---|---|---|
| 0 | **Arranque** | 0:00–0:05 | Bun + Express + deps, `tsconfig` estricto, fixtures copiados, `.gitignore`, `.env`, repo en GitHub. | `chore: scaffold project` |
| 1 | **Núcleo** | 0:05–0:30 | `core/` (tipos, maestros, parsers, RC1–RC10, payload, evidencia), `sap/` (adapter + mock), `app/` (`OcService`, `ConfirmationStore`, `EventBus`, repositorio). | `feat: core rules, OcService and SAP mock` |
| 2 | **Herramientas + demo** | 0:30–0:40 | `tools/oc.ts` + `registry.ts`, `demo.ts`. **Salida = SPEC §6.** | `feat: oc tools and demo` ✅ **CP1** |
| 3 | **Agente + API** | 0:40–0:56 | `llm/`, `agent/` (loop + sesión), `agent/prompt.md`, `knowledge/`, `channels/http` (`/api/*`, SSE), `server.ts`. Probar `sol-004` con curl. | `feat: agent loop, API and SSE` |
| 4 | **App web** | 0:56–1:14 | Vistas: El reto, Casos (+ detalle), Confirmaciones, Maestros, SAP y control. Panel de chat (`chat.js`). Estado en vivo por SSE. | `feat: web app with live state and chat` ✅ **CP2** |
| 5 | **Despliegue** | 1:14–1:22 | `Dockerfile`, push, Render con variables. Probar `sol-004` en el link. | `chore: deploy` ✅ **CP3 (link)** |
| 6 | **MCP** | 1:22–1:32 | `channels/mcp` (HTTP + stdio). Prueba: `claude mcp add` y "procesa sol-001" → la web cambia en vivo. | `feat: MCP server` |
| 7 | **A2A** | 1:32–1:44 | `channels/a2a` (Agent Card + ejecutor), `scripts/a2a-client.ts` = tabla §6. | `feat: deterministic A2A agent` |
| 8 | **Embed + módulo** | 1:44–1:50 | `/embed`, `widget.js`, `scripts/build-modulo.ts` → `modulo/`. | `feat: embeddable widget and module` |
| 9 | **Documentación** | 1:50–2:00 | `README.md` y `SOLUCION.md` (12 secciones), armadas desde SPEC + ADR + costo medido. Push final (Render redespliega solo). | `docs: solution write-up` · tag `v1.0` |

**¿Por qué el despliegue va antes de MCP y A2A?** Porque sin link se pierden 10 puntos seguros, mientras que MCP y A2A probablemente no puntúan directo (SPEC §17-P1). Una vez desplegado, cada push posterior redespliega solo.

---

## Detalle por bloque

### Bloque 1 · Núcleo (25 min), el corazón
1. `core/tipos.ts`: esquemas zod copiados del PRD 7.1, 7.2 y 7.4 + `Finding`.
2. `core/master-data.ts`, `core/parsers.ts` (montos colombianos: quitar `.` de miles).
3. `core/reglas.ts`: `REGLAS: Regla[]` y `validar()`.
4. `core/evidence.ts`, `core/payload.ts`.
5. `sap/mock.ts`, `app/repository.ts`, `app/events.ts`, `app/confirmations.ts`.
6. `app/oc-service.ts`: los casos de uso de la SPEC §4, cada uno emitiendo su evento.

### Bloque 2 · Herramientas + demo (10 min)
Las herramientas son delgadas: validan args, llaman a `OcService` y serializan `{ ok, data }`. Si `demo.ts` no reproduce la tabla §6, **se arregla aquí** antes de seguir. Todo lo que viene después depende de esto.

### Bloque 3 · Agente + API (16 min)
- Ciclo del ADR-002 con topes de iteraciones y de tokens.
- La sesión detecta la confirmación en el siguiente mensaje y llama a `OcService.confirmar(caso, { canal: "chat" })`.
- `/api/events`: suscribe al `EventBus`, ping cada 25 s.
- Primera llamada real → anotar `usage` para el costo de SOLUCION §4.

### Bloque 4 · App web (18 min)
- `index.html` + `app.js` (Preact + htm desde CDN, versión fija) + `styles.css`.
- Layout: navegación a la izquierda, contenido al centro y chat fijo a la derecha.
- Un solo store en el cliente: `/api/estado` al cargar y luego los eventos SSE.
- Demo esperada: "procesa sol-004" en el chat → la tarjeta pasa a *esperando confirmación* → "Aprobar" en la web → el chat lo ve → la tarjeta pasa a *OC creada*.

### Bloque 6 · MCP (10 min)
Un bucle que registra cada herramienta de `tools/oc.ts` en el `McpServer`. Montar el transporte HTTP en `/mcp` y crear `channels/mcp/stdio.ts` para `bun run mcp`.

### Bloque 7 · A2A (12 min)
`AgentExecutor` que interpreta el comando (DataPart o gramática fija), llama a `OcService` y publica el estado de la tarea. Agent Card con las 3 skills. `scripts/a2a-client.ts` imprime la misma tabla que `demo.ts`.

### Bloque 9 · Documentación (10 min)

| Sección SOLUCION.md | Fuente |
|---|---|
| 1 Problema | PRD §1 en una frase |
| 2 Arquitectura | SPEC §3 (diagrama y capas) + ADR-008 |
| 3 Ciclo del agente | ADR-002 + ADR-012 |
| 4 Modelo y costo | ADR-003 + `usage` medido en el bloque 3 |
| 5 Matriz de controles | SPEC §5; la más difícil: RC2/RC3 en sol-003 |
| 6 Adaptador SAP real | Preparado de antemano (ver abajo) |
| 7 Lectura del proceso | Preparado de antemano |
| 8 Decisiones y trade-offs | ADR-005/012, 008, 010, 011 |
| 9 Supuestos | SPEC §17 |
| 10 Cobertura | SPEC §16 marcada |
| 11 Uso de IA | Claude Code: análisis del PRD, SPEC/ADR, generación de código; qué se descartó (p. ej., Hono → Express, ADR-009) |
| 12 Riesgos | Consecuencias negativas de los ADR |

---

## Trabajo previo (antes de que arranque el reloj, si las reglas lo permiten)

Lo que no es código y no depende de nada. Esto es lo que hace viable el plan:
- **Cuentas listas:** Anthropic (clave en `.env`), GitHub, Render. Bun instalado ✅.
- **SOLUCION §6 Adaptador SAP real:** OData `API_PURCHASEORDER_PROCESS_SRV` vía SAP Integration Suite como opción principal; `BAPI_PO_CREATE1` por RFC como alternativa on-premise; credenciales en un vault, nunca en el agente; idempotencia por `solicitud_id` en el campo de referencia + búsqueda previa; error parcial → consultar por referencia antes de reintentar; plan B: archivo de carga masiva o la OC lista para ME21N. Mencionar que `SapAdapter` es el puerto: solo cambia el adaptador.
- **SOLUCION §7 OC retroactivas:** porcentaje desde `control.csv`, regla "sin OC no se radica factura" con transición en la que el agente marca pero no bloquea.
- **Textos:** `agent/prompt.md` y `src/knowledge/ordenes-compra.md`.
- **Guion de la defensa** (5 min): web → chat sol-001 (OC directa) → sol-004 (confirmación desde la web) → sol-003 (bloqueo explicado) → Claude Code por MCP procesa sol-006 y la web cambia → `a2a-client.ts` muestra el mismo resultado que `demo.ts`.

---

## Qué recortar si el tiempo se va (en este orden)

| Orden | Recorte | Qué se pierde |
|---|---|---|
| 1 | `widget.js` (dejar solo `/embed`) | Comodidad de embebido; el iframe sigue sirviendo. |
| 2 | `modulo/` | Bonus +10. |
| 3 | MCP stdio (dejar solo HTTP) | Uso local; el remoto sigue. |
| 4 | Postgres (ADR-015) | Queda como diseño; ya es opcional desde el inicio. |
| 5 | Vista Maestros y El reto como texto estático | Pulido visual. |
| 6 | Tope de tokens por sesión (dejar solo iteraciones) | Un requisito no funcional menor; documentarlo. |
| **Nunca** | CP1 (`demo.ts`), CP2 (chat + web en vivo), CP3 (link), **MCP por HTTP**, **A2A con las 3 skills**, SOLUCION.md con 12 secciones | — |

**Decisión 2026-11-06:** MCP y A2A son obligatorios. La base de datos queda diseñada (ADR-015) y se implementa solo si sobran 10 minutos al final. Si el tiempo aprieta, se recorta pulido de la web, no MCP ni A2A.

---

## Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| El alcance no cabe | Orden por valor + regla de corte. El P0 cabe en 92 minutos. |
| Las APIs de los SDK de MCP o A2A cambiaron | Fijar versión al instalar, leer su README antes de escribir y aislarlas en `channels/`. Si se traban más de 5 minutos, recortar. |
| El modelo crea la OC sin confirmación | Confirmación central (ADR-012): el backend lo impide aunque el prompt falle. |
| Render tarda o falla | Túnel `cloudflared` a los 5 minutos de intentar. |
| La clave llega a git | `.env` en `.gitignore` desde el minuto 0; revisar `git log -p \| grep sk-ant` antes de entregar. |
| Preguntan por una línea generada por IA | Leer el diff de cada bloque antes del commit. |
| Saldo de USD 5 | Sonnet 5.5 en desarrollo; probar la lógica con `demo.ts`, no con el chat; MCP y A2A no gastan la clave. |
