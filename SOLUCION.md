# SOLUCIÓN · Reto 03 · Agente "Órdenes de Compra SAP"

## 1. Problema en una frase

La analista administrativa digita a mano en SAP cada orden de compra y valida de memoria quién puede aprobar qué; eso le cuesta tiempo, produce errores que aparecen en el cierre contable y deja sin medir cuántas OC se crean después de la factura.

Le duele a la analista (retrabajo), a contabilidad y auditoría (control débil) y a la dirección (no sabe cuántas compras se saltan el proceso).

## 2. Arquitectura

Cuatro paquetes TypeScript bajo `app/`. Son **ortogonales**: ninguno importa a otro salvo `contracts`, y se hablan por HTTP con tipos compartidos. Se despliegan como un solo servicio en Render que corre tres procesos (ADR-018).

```
Navegador / sitio externo / host MCP / otro agente
                     │
                     ▼
        app/web  (Next.js 16, SSR)  :PORT  ← única entrada pública
          ├─ /api/chat, /api/sessions ─▶ app/agent   :4100  (Claude + ciclo + herramientas oc_*)
          ├─ /api/* (+ SSE)           ─▶ app/backend :4000
          ├─ /mcp                     ─▶ app/backend  (MCP: mismas herramientas)
          └─ /a2a, agent-card         ─▶ app/backend  (Agente OC determinista)

app/agent ──OcPort por HTTP──▶ app/backend
                                 ├─ domain/          RC1–RC10, builder de la OC, evidencia, ciclo del caso
                                 ├─ application/     OcService (fachada) + puertos + confirmaciones
                                 ├─ infrastructure/  fixtures (lectura) · out/ (escritura) · bus de eventos
                                 └─ sap/             SapAdapter (interfaz del PRD) · SapMock
app/contracts: modelo del PRD (zod), OcPort, eventos y catálogo de herramientas oc_*
```

El backend sigue **arquitectura hexagonal** (ADR-016): el dominio no hace I/O, la aplicación define puertos y cada protocolo es un adaptador delgado.

- **Comportamiento:** `app/agent/prompt.md`.
- **Conocimiento:** `app/agent/src/knowledge/ordenes-compra.md`.
- **Ejecución:** herramientas `oc_*` en `app/contracts/src/tools`, reexportadas en `app/agent/src/tools/oc.ts`, sobre los casos de uso del backend.

Patrones usados y por qué:

| Patrón | Dónde | Para qué |
|---|---|---|
| Adapter | SAP simulado, Claude, archivos, REST, MCP, A2A | Que el núcleo no conozca a nadie de afuera. |
| Facade | `OcService` | Una sola entrada a los casos de uso para todos los canales. |
| Strategy | Una `ControlRule` por cada RC; fábrica de LLM | Agregar una regla o un proveedor sin tocar a quien los usa. |
| Builder | `PurchaseOrderBuilder` | Armar la OC paso a paso, registrando la fuente de cada campo. |
| Observer | Bus de eventos → SSE | La web se entera de todo sin que el caso de uso sepa quién escucha. |
| Decorator | Registro de herramientas | Validación zod, errores como valores y log en un solo lugar. |
| Command | Agente A2A | Cada mensaje se vuelve un comando explícito o se rechaza. |
| State | Ciclo de vida del caso | Transiciones permitidas explícitas. |

### Dependencias y por qué (PRD 8)

| Dependencia | Paquete | Para qué | Alternativa descartada |
|---|---|---|---|
| `zod` (obligatoria) | todos | Esquemas de argumentos, del modelo del PRD y de la OC; tipos derivados | — |
| `@anthropic-ai/sdk` | agent | Cliente oficial de Claude (errores tipados, reintentos, caché) | `fetch` a mano: más código y sin tipos |
| `@modelcontextprotocol/sdk` | backend | Servidor MCP estándar (HTTP y stdio) | Implementar el protocolo a mano |
| `@a2a-js/sdk` | backend | Servidor A2A 1.0 (Agent Card, tareas, JSON-RPC) | Implementar el protocolo a mano |
| `next`, `react`, `react-dom` | web | Web con SSR y server actions (pedido explícito) | Front sin build: no cumplía "Next.js + TypeScript" |
| `marked` | web | Renderizar las tablas en markdown que responde Hermes (con el HTML escapado antes) | Mostrar texto plano: ilegible para tablas |
| `typescript`, `@types/*` | dev | Typecheck estricto | — |

Sin framework HTTP en backend ni agente: `Bun.serve` con manejadores estándar `Request → Response`. Sin librería de gráficas: las gráficas son componentes propios renderizados en el servidor.

## 3. Ciclo del agente

`app/agent/src/agent/loop.ts` implementa el ciclo a mano sobre un puerto propio, `LlmAdapter.enviar(mensajes, herramientas, opciones)`:

1. Envía el historial y las herramientas al modelo.
2. Si el modelo pide herramientas, valida los argumentos con zod, las ejecuta y devuelve todos los resultados en un solo mensaje.
3. Repite hasta que el modelo responde sin herramientas o hasta llegar a `MAX_ITERATIONS` (25). En la última vuelta se agrega una nota para que cierre con lo que tiene.
4. Suma los tokens de la sesión y corta al pasar `MAX_SESSION_TOKENS`.
5. Los errores del proveedor (timeout, 429, clave inválida) vuelven como un mensaje claro y la sesión sigue viva.

**Confirmación humana con doble candado (ADR-005 y ADR-012).** El argumento `confirmado=true` no basta. Las confirmaciones viven en un registro central **por caso**, y `crear()` solo procede si la confirmación está *aprobada* en ese registro. La aprueba una persona: con su siguiente mensaje en el chat ("confirmo", o el botón Confirmar) o con el botón Aprobar en la web. Si el modelo intenta crear la OC sin esa aprobación, el backend lo rechaza aunque el prompt falle. Desde MCP o A2A tampoco se puede auto-aprobar; por defecto, esas confirmaciones se resuelven en la web.

**Alcance determinista (ADR-019).** Antes de llamar al modelo, un guardarraíl en código decide si el mensaje es del dominio. Si no lo es (por ejemplo, "¿cuánto es 2 + 2?"), Hermes responde un texto fijo sin llamar al modelo; los saludos reciben su presentación fija. Mismo mensaje, misma decisión, y costo cero. El prompt agrega una segunda capa para mensajes mixtos.

**Integridad de los montos.** Las herramientas reciben solo `caso` y recalculan todo desde los fixtures. El modelo nunca tiene en sus manos un payload que luego llegue a SAP. Es una desviación consciente de la tabla del PRD, que pasaba `paquete` y `payload` como argumentos.

## 4. Elección del modelo

- **Proveedor:** Anthropic, con el SDK oficial.
- **Modelo:** `claude-sonnet-5-5` en desarrollo y `claude-opus-5-5` para la defensa si alcanza el saldo. Se cambia solo con `LLM_MODEL`.
- **Por qué:** sigue bien un flujo fijo de herramientas y respeta las pausas de confirmación. El trabajo pesado (reglas, montos, fechas) lo hacen las herramientas, así que basta con `effort: low`.
- **Resguardos:** caché de prompt sobre el system prompt, y *fallback* del servidor activado para que un rechazo del modelo no corte la conversación.

**Costo estimado por caso procesado** (unas 6 vueltas al modelo, ~5.000 tokens de entrada por vuelta y ~2.500 de salida en total):

| Modelo | Entrada | Salida | Total por caso |
|---|---|---|---|
| Sonnet 5.5 (USD 2 / 10 por MTok) | 30.000 × 2/1M | 2.500 × 10/1M | **≈ USD 0,085** |
| Opus 5.5 (USD 4 / 20 por MTok) | 30.000 × 4/1M | 2.500 × 20/1M | **≈ USD 0,17** |

**Costo medido** (Sonnet 5.5, prompt del PRD para sol-004 + "Confirmo", 2 turnos y 5 llamadas a herramientas): 27.356 tokens de entrada y 1.203 de salida. Cobrando toda la entrada a precio completo da **≤ USD 0,067 por caso**. El costo real es algo menor, porque parte de la entrada se lee de caché. Cada turno lo informa en el campo `usage` de `/api/chat`. MCP y A2A no consumen la clave.

## 5. Matriz de controles

Cada control es una estrategia en `app/backend/src/domain/rules/`. Se evalúan **todos**, sin cortar en el primer error, para que la analista vea el panorama completo de una vez.

| # | Implementación | Tipo |
|---|---|---|
| RC1 | Busca por NIT normalizado (sin puntos ni dígito de verificación); si no hay NIT, por nombre normalizado (sin tildes ni sufijos societarios). Debe estar activo. | Bloqueo |
| RC2 | Hay aprobación, contiene "aprobado/aprobada" y el remitente está entre los aprobadores del centro de costo. | Bloqueo |
| RC3 | Valor ≤ tope del aprobador. Si el aprobador no está autorizado, compara contra el mayor tope del centro como agravante. | Bloqueo |
| RC4 | La subárea pertenece al centro (y el centro existe). | Bloqueo |
| RC5 | Diferencia entre cotización y solicitud ≤ 2 %; sin cotización también pide confirmación. Muestra ambos valores. | Confirmación |
| RC6 | Sin IVA → toma el del proveedor y pide confirmación. | Confirmación + derivado |
| RC7 | Sin condiciones de pago → toma las del proveedor. | Derivado |
| RC8 | Factura anterior a la solicitud → `retroactiva` + confirmación. | Confirmación |
| RC9 | Aprobación anterior a la solicitud → confirmación. | Confirmación |
| RC10 | cantidad × valor unitario = total ± 1. | Bloqueo |

`bun test` verifica los 6 casos contra la tabla esperada: sol-001 se crea; sol-002 bloquea por RC1; sol-003 por RC2 y RC3; sol-004 confirma RC5 (6 %); sol-005 confirma RC8 y queda retroactiva; sol-006 resuelve el proveedor por nombre y confirma RC6.

**La más difícil fue RC2/RC3 en sol-003.** Las dos reglas se cruzan: quien aprobó (Felipe Vargas, de CC-3030) no es aprobador de CC-2020, así que no hay "su tope" contra el cual comparar. Decidí reportar RC2 como causa principal y evaluar RC3 contra el mayor tope del centro como agravante, porque los 74 millones superan incluso el tope de la aprobadora correcta. Así la analista sabe que no basta con pedir la firma a otra persona: también necesita a alguien con tope suficiente.

## 6. Diseño del adaptador SAP real

El puerto `SapAdapter` (`consultarProveedor`, `crearOrden`, `buscarOrdenPorReferencia`) es la frontera. Pasar a SAP real es escribir otra implementación e inyectarla en `bootstrap.ts`; nada más cambia.

**Opción elegida: OData `API_PURCHASEORDER_PROCESS_SRV` a través de SAP Integration Suite (o el API Management de BTP).** Es la API estándar y publicada de S/4HANA para órdenes de compra, funciona sobre HTTP y JSON (encaja con el payload que ya generamos), y pasar por Integration Suite agrega trazas, reintentos y desacople de la red interna de SAP. Si el SAP es ECC on-premise sin OData, la alternativa es `BAPI_PO_CREATE1` por RFC detrás de un pequeño servicio puente.

**Mapeo del payload:**

| Payload (PRD 7.4) | OData `A_PurchaseOrder` |
|---|---|
| `sociedad`, `organizacion_compras` | `CompanyCode`, `PurchasingOrganization` (+ `PurchasingGroup` por configuración) |
| `proveedor.codigo_sap` | `Supplier` |
| `moneda`, `condiciones_pago` | `DocumentCurrency`, `PaymentTerms` |
| `referencia.solicitud_id` | `CorrespondenceExternalReference` (o un campo Z), que también sirve para la idempotencia |
| `posiciones[]` | `to_PurchaseOrderItem`: `PurchaseOrderItemText`, `OrderQuantity`, `PurchaseOrderQuantityUnit`, `NetPriceAmount`, `TaxCode`, `AccountAssignmentCategory = K` |
| `centro_costo`, `subarea` | `to_AccountAssignment.CostCenter` (la subárea se mapea a un objeto CO o a un texto según la configuración) |
| `aprobador.evidencia_sha256` + `aprobacion.txt` | Adjunto con el servicio de Attachments (GOS) y hash en las notas de la OC |

**Credenciales:** usuario técnico con permisos solo de creación de OC, autenticado con OAuth 2.0 *client credentials* contra BTP. El secreto vive en un gestor de secretos (Render, Azure Key Vault o similar) y lo lee **solo** el adaptador SAP en el backend. Nunca está en el prompt, en el agente ni en los logs.

**Idempotencia y errores parciales:** antes de crear se busca por la referencia de la solicitud (`buscarOrdenPorReferencia`), igual que hace el simulado. Ante un timeout o un 5xx **no se reintenta a ciegas**: primero se consulta por referencia; si la OC existe, se devuelve su número; si no, se reintenta con backoff. Si SAP crea la cabecera y falla una posición, la respuesta OData lo indica y la OC queda marcada para revisión manual en el control, sin crear otra.

**Plan B si la conexión no es viable:** el agente sigue ahorrando casi todo el trabajo. Valida, arma la OC y deja dos salidas: (1) una ficha lista para copiar en ME21N, con la trazabilidad de cada campo, y (2) un archivo de carga masiva (CSV/LSMW) por lote. La analista solo pega y confirma; el control y la medición de retroactivas siguen igual.

## 7. Lectura del proceso: OC retroactivas

Lo que le diría a la dirección: las OC retroactivas no son un problema de digitación sino de proceso. La compra ya se hizo cuando llega la orden, así que la OC deja de ser un control y se vuelve un trámite para poder radicar la factura. En el reto, sol-005 llega con la factura del 10 de agosto y una solicitud del 27; la cotización ni siquiera se usó para decidir.

El agente ya deja medido el fenómeno: cada OC retroactiva queda marcada en `out/control.csv` y la web muestra el porcentaje. Con un mes de datos se puede ver qué áreas, proveedores o montos concentran el problema.

Propondría la regla **"sin OC no se radica la factura"** (*no PO, no pay*), aplicada en dos etapas. Durante uno o dos meses el agente solo marca y reporta, sin bloquear, para no frenar pagos a proveedores. Después, las retroactivas pasan a requerir aprobación de un nivel superior además de la confirmación de la analista. La meta es que el indicador baje mes a mes; si no baja, el problema está en el tiempo que toma pedir una OC, y ahí el agente es justamente lo que lo acorta.

## 8. Decisiones y trade-offs

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Confirmación central por caso, aprobada por una persona (ADR-012) | Solo el argumento `confirmado=true` | Con solo el argumento, el modelo (o un host MCP ajeno) puede auto-aprobar. El costo es más estado en el servidor. |
| Herramientas que reciben solo `caso` y recalculan | Pasar `paquete` y `payload` entre herramientas, como sugiere el PRD | Evita que el modelo altere montos entre llamadas. El costo es recalcular, algo barato. |
| Paquetes ortogonales en un servicio con 3 procesos (ADR-018) | Todo dentro de Next.js, o tres servicios en Render | Independencia real sin multiplicar despliegues. El costo es un salto HTTP interno y un supervisor de procesos. |
| Agente A2A determinista sin LLM (ADR-010) | Exponer por A2A el agente con LLM | Otro agente necesita resultados reproducibles y no debería gastar la clave. El costo es que solo entiende una gramática fija. |
| Catálogo de herramientas en `contracts` (ADR-011/018) | Definirlas en el agente y duplicarlas en MCP | Una sola definición para el chat y MCP. El costo es que `contracts` incluye algo de comportamiento. |
| Archivos en `out/`; Postgres diseñado pero no implementado (ADR-015) | Implementar Postgres en el reto | El PRD pide archivos y no puntúa la base; el puerto `Repository` deja lista la extensión. |
| Guardarraíl de alcance en código antes del modelo (ADR-019) | Solo instrucciones en el prompt | Un LLM no es determinista con instrucciones; el código sí, y además no gasta tokens. El costo es que una pregunta válida sin vocabulario del dominio se rechaza con una sugerencia. |
| Ciclo propio sobre `LlmAdapter` (ADR-002) | Tool Runner del SDK o Agent SDK | El PRD exige que cambiar de proveedor no toque el ciclo, y el ciclo se puede explicar completo. |

## 9. Supuestos

- Las herramientas reciben solo `caso` (ver §3); el payload usa cantidad y precio de la **solicitud**, que es lo aprobado, y las diferencias con la cotización se confirman.
- Las fechas se comparan por día calendario (`YYYY-MM-DD`), con la fecha local tal como viene en el correo.
- En sol-003 se reporta RC2 como causa principal y RC3 como agravante.
- Una posición por solicitud (así vienen todos los fixtures; el esquema admite varias).
- La unidad se deriva de la descripción: "hora(s)" → `H`, "mensual" → `MES`, si no `UN`.
- Trazabilidad (HU-3) con el vocabulario del PRD: `solicitud`, `cotizacion`, `maestro.proveedores` o `derivado`. Los derivados indican su origen (`derivado:aprobacion`, `derivado:constante`…).
- Las confirmaciones son globales al servidor (una sola analista, como en el PRD).
- El estado en memoria y `out/` se pierden si Render reinicia el servicio. Para la demo se acepta; Postgres es la siguiente etapa.
- El PRD habla de una rúbrica en la "sección 10", pero esa sección es de riesgos; asumí que se evalúa contra las historias de usuario y la sección 9.

## 10. Cobertura

| Historia | Estado | Comentario / qué falta para producción |
|---|---|---|
| HU-1 Leer el paquete | Hecho | Lectura de `.xlsx` y `.pdf` reales (P1) pendiente; hoy se leen los fixtures normalizados. |
| HU-2 Validar contra maestros | Hecho | Maestros consultados en SAP en tiempo real. |
| HU-3 Construir el payload | Hecho | Validado con zod + `trazabilidad.json`. |
| HU-4 Evidencia de aprobación | Hecho (P0 `.txt`) | El PDF (P1) no está implementado. |
| HU-5 Crear la OC en SAP simulado | Hecho | Secuencia desde 4500000001, idempotencia y `control.csv` por intento. Falta el adaptador SAP real (§6). |
| HU-6 Manejo de errores | Hecho | Errores legibles; la herramienta nunca lanza; un caso malo no detiene el resto. |
| Chat con el modelo real | Hecho | Verificado con el prompt del PRD (sol-004): 4 herramientas, pregunta de confirmación y, tras "Confirmo", OC creada con canal `chat` en el control. |
| MCP, A2A, embed, `modulo/` | Hecho | Fuera del PRD (salvo el bonus); probados de punta a punta, también en el despliegue. |
| Link público | Hecho | https://oc-sap-reto03.onrender.com |
| Postgres | Diseñado (ADR-015) | Implementar el adaptador `PostgresRepository`. |

Para producción faltaría además: autenticación de usuarios (hoy hay una clave compartida opcional), multiusuario y un broker de eventos si se escala a varias instancias.

## 11. Uso de IA

Usé **Claude Code** (Anthropic) como asistente durante todo el reto:

- **Análisis:** comparar los tres retos, leer el PRD y calcular a mano el resultado esperado de cada caso contra los fixtures, antes de escribir código.
- **Diseño:** redactar la SPEC y los ADR a partir de mis decisiones (hexagonal, paquetes ortogonales, A2A, MCP, Next.js con SSR).
- **Código:** generar los paquetes por bloques, cada uno con su verificación (typecheck, `bun test`, `demo.ts`, pruebas con curl y en el navegador) antes del commit.
- **Documentación de APIs:** revisar los tipos de los SDK instalados (MCP 1.32, A2A 1.3, Next 16) en vez de suponerlos.

**Lo que se descartó** de lo propuesto en el camino, y por qué:

- **Hono y luego Express.** Los SDK de MCP y A2A ya traen manejadores web estándar, así que se usa `Bun.serve` sin framework HTTP.
- **Preact sin build.** No cumplía "Next.js" ni "TypeScript en todo".
- **Poner todo dentro de Next.js (ADR-017).** Acoplaba web, backend y agente; se reemplazó por paquetes ortogonales.
- **Duplicar las herramientas para MCP.** Se movieron al contrato.
- **Implementar Postgres en el reto.** Quedó diseñado.
- **Una migración a `node:fs`.** Dejó de hacer falta al volver el backend a Bun.

Cada archivo lo revisé antes de cada commit y puedo explicarlo línea por línea.

## 12. Riesgos de llevar esto a producción

| Riesgo | Mitigación |
|---|---|
| El modelo intenta crear la OC sin confirmación o "arregla" montos | Confirmación central aprobada por una persona; herramientas que recalculan desde la fuente. |
| Formatos reales de cotización y factura distintos a los fixtures (los parsers usan expresiones regulares) | Leer el PDF con extracción estructurada y marcar "requiere revisión" cuando falte un campo, en vez de adivinar. |
| Conexión a SAP no viable a corto plazo | Plan B de §6: ficha para ME21N o carga masiva. |
| Estado en memoria y disco efímero en Render | Postgres (ADR-015) y un broker de eventos al escalar. |
| La clave compartida no identifica a quién aprobó en la web | SSO corporativo y registrar al usuario en `confirmado_por`. |
| Costo del modelo si el chat embebido se abusa | `ACCESS_KEY`, `EMBED_ORIGINS`, topes de iteraciones y tokens; MCP y A2A no gastan la clave. |
| Dependencia de SDK jóvenes (MCP, A2A) cuyas APIs cambian | Versiones fijas y uso aislado en `interfaces/`. |
| Plan gratuito de Render se duerme | Abrir el link antes de la defensa; plan pago en producción. |
