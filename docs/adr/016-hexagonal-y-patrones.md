# ADR-016 · Arquitectura hexagonal explícita y patrones de diseño

**Estado:** Aceptado · 2026-11-06 · **Precisa a ADR-008** (misma idea de puertos y adaptadores, ahora con capas y nombres explícitos)

## Contexto
El ADR-008 definió un monolito modular con puertos y adaptadores, pero con nombres genéricos (`core`, `app`, `channels`). Se pide hacer explícita la arquitectura hexagonal y aplicar buenas prácticas y patrones de diseño reconocibles, de forma que el código se pueda defender pieza por pieza.

Restricciones del PRD que condicionan la estructura:
- La interfaz `SapAdapter` es **obligatoria en `src/sap/adapter.ts`** (PRD 7.4).
- Las herramientas deben estar separadas del servidor e importarse desde `demo.ts` (PRD 6.1).
- El system prompt en `agent/prompt.md` y el conocimiento en `src/knowledge/` (PRD 6.5).

## Decisión

### Capas

| Capa | Carpeta | Regla |
|---|---|---|
| **Dominio** | `src/domain/` | Modelo, reglas RC1–RC10, construcción de la OC y evidencia. **Puro**: no importa nada fuera de `domain/` (solo `zod`), no hace I/O ni usa la hora del sistema. |
| **Aplicación** | `src/application/` | Casos de uso (`OcService`), confirmaciones y **puertos**: de entrada (`OcPort`) y de salida (`DataSource`, `Repository`, `EventPublisher`, `Clock`). Solo depende del dominio y de sus propios puertos. |
| **Adaptadores de salida** | `src/infrastructure/`, `src/sap/`, `src/llm/` | Implementan los puertos de salida: lectura de fixtures, persistencia en `out/` (y Postgres opcional), bus de eventos en memoria, SAP simulado, Claude. `sap/` y `llm/` quedan donde los pide el PRD. |
| **Adaptadores de entrada** | `src/interfaces/` (`http`, `mcp`, `a2a`), `src/tools/`, `src/agent/` | Traducen cada protocolo a llamadas de `OcPort`. Ninguno contiene reglas de negocio. |
| **Raíz de composición** | `src/bootstrap.ts` | Único lugar donde se crean las implementaciones concretas y se inyectan. `server.ts`, `demo.ts`, `mcp/stdio.ts` y los scripts lo usan. |

**Regla de dependencias:** las dependencias apuntan hacia el dominio. Ningún archivo de `domain/` o `application/` importa de `infrastructure/`, `interfaces/`, `sap/mock.ts` ni `llm/anthropic.ts`. Se revisa con un `grep` antes de cada commit.

### Patrones aplicados (solo donde resuelven un problema real)

| Patrón | Dónde | Problema que resuelve |
|---|---|---|
| **Adapter** | `sap/mock.ts`, `llm/anthropic.ts`, `infrastructure/*`, `interfaces/*` | Conectar el núcleo con SAP, el proveedor LLM, el disco y cada protocolo sin que el núcleo los conozca. |
| **Facade** | `application/oc-service.ts` | Una entrada simple (`procesar`, `crear`, `confirmar`, `estado`) que oculta la coordinación entre dominio, SAP, repositorio y eventos. |
| **Strategy** | `domain/rules/` (una `ControlRule` por RC) y `llm/factory.ts` | Agregar o cambiar una regla, o un proveedor LLM, sin tocar a quien las usa. |
| **Builder** | `domain/purchase-order-builder.ts` | Armar la `OrdenCompra` paso a paso, registrando la fuente de cada campo (trazabilidad) y validando al final con `build()`. |
| **Observer** | `application/ports/events.ts` + `infrastructure/events/in-memory-event-bus.ts` → SSE | La web y el log se enteran de cada cambio sin que el caso de uso sepa quién escucha. |
| **Decorator** | `tools/registry.ts` | Envolver cada herramienta con validación zod, captura de errores (nunca lanza), log y evento, sin repetir ese código en las 5 herramientas. |
| **Command** | `interfaces/a2a/commands.ts` | El agente A2A convierte cada mensaje en un comando explícito (`Procesar`, `Crear`, `Confirmar`, `Estado`) o lo rechaza. Esto es lo que lo hace determinista. |
| **State** | `domain/case-state.ts` | El ciclo de vida del caso (`sin_procesar → validado → bloqueado / esperando_confirmacion → oc_creada`) con transiciones permitidas explícitas; una transición inválida es un error. |
| **Factory Method** | `bootstrap.ts`, `llm/factory.ts` | Elegir la implementación (archivos o Postgres, Claude u otro proveedor) a partir de variables de entorno. |
| **Composite** *(opcional, ADR-015)* | `infrastructure/persistence/composite-repository.ts` | Tratar "archivos + Postgres" como un único `Repository`. |
| **Proxy** *(siguiente etapa)* | `A2aOcPort` | Un `OcPort` remoto que habla A2A con el Agente OC cuando se separe del monolito. |

**Patrones descartados a propósito:**
- **Singleton**: el estado compartido se crea una vez en la raíz de composición y se inyecta. Así no hay acoplamiento global y las pruebas pueden crear instancias aisladas.
- **Chain of Responsibility para las reglas**: las reglas no se pasan la petición entre ellas; se evalúan **todas** para mostrar todos los hallazgos de una vez.

### Buenas prácticas
- **SOLID:** responsabilidad única por archivo; abierto/cerrado vía estrategias; inversión de dependencias vía puertos.
- **Inyección de dependencias** por constructor; sin `new` de infraestructura dentro de la aplicación.
- **Errores como valores** en los bordes (`{ ok, data } | { ok: false, error }`); excepciones solo dentro del dominio, capturadas por el decorador.
- **TypeScript estricto** (`strict`, `noUncheckedIndexedAccess`), sin `any`; tipos derivados de los esquemas zod.
- **Funciones cortas** y nombres en español del dominio (ubicuo con el PRD: solicitud, cotización, centro de costo).
- **Determinismo:** la hora llega por el puerto `Clock`; en `demo.ts` y en las pruebas se puede fijar.
- **Pruebas:** `bun test` para las reglas con los 6 casos del PRD (las mismas expectativas de la SPEC §6).

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Mantener la estructura del ADR-008 (`core/app/channels`) | Funciona, pero las capas hexagonales no quedan explícitas y es más difícil defender la regla de dependencias. |
| Mover `sap/` y `llm/` dentro de `infrastructure/` | Más ordenado, pero el PRD exige `src/sap/adapter.ts`. Se respeta el PRD y se documenta la excepción. |
| Clean Architecture completa (entities, use cases, controllers, presenters, gateways) | Más capas y archivos de los que caben en 2 horas, sin beneficio adicional frente a hexagonal. |
| Aplicar todos los patrones posibles | Patrones forzados empeoran la legibilidad. Cada patrón de la tabla responde a un problema concreto del reto. |

## Consecuencias
- (+) Cada pieza se puede explicar por su rol: puerto, adaptador, caso de uso o regla.
- (+) El dominio se prueba sin red, sin disco y sin clave.
- (+) Cambiar SAP simulado por SAP real, archivos por Postgres o Claude por otro proveedor es escribir un adaptador nuevo e inyectarlo en `bootstrap.ts`.
- (−) Más archivos e indirección que un script directo. Se compensa con la tabla de capas y nombres consistentes.
- (−) La excepción de `src/sap` y `src/llm` fuera de `infrastructure/` rompe un poco la simetría; está documentada aquí.

## Convención de nombres (2026-11-06)
- **Todo identificador de código en inglés:** archivos, carpetas, funciones, variables, tipos, códigos de error y variables de entorno.
- **Excepción (contrato del PRD):** se conservan tal cual los identificadores que el PRD fija como contrato, porque son lo que se evalúa: nombres de herramientas `oc_*` y sus argumentos (`caso`, `confirmado`), la interfaz `SapAdapter` (`consultarProveedor`, `crearOrden`, `buscarOrdenPorReferencia`), el método `enviar` del adaptador LLM y los campos JSON de fixtures, paquete normalizado, `OrdenCompra` y `control.csv`.
- Documentación y mensajes para la usuaria, en español.
