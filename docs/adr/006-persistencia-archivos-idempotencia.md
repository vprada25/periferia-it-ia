# ADR-006 · Persistencia en archivos e idempotencia del SAP simulado

**Estado:** Aceptado · 2026-11-05 · Se extenderá con [ADR-015](015-postgres-en-render.md) si se implementa Postgres. El repositorio se construye detrás de un puerto para permitirlo.

## Contexto
Sin base de datos (PRD §6.1). El SAP simulado debe numerar desde `4500000001`, escribir en `out/sap/ordenes.jsonl` y no crear dos OC para el mismo `solicitud_id`. Contabilidad consume `out/control.csv`.

## Decisión
- `SapMock implements SapAdapter` (interfaz del PRD, sin cambios).
- Secuencia en `out/sap/secuencia.json`. Órdenes en JSONL, una por línea.
- `crearOrden` primero llama a `buscarOrdenPorReferencia(solicitud_id)`. Si existe, devuelve el número existente e `idempotente: true`.
- Escrituras serializadas con una cola en memoria (`Promise` encadenada) para evitar condiciones de carrera entre dos peticiones simultáneas.
- `control.csv` con una fila por intento (`creada | idempotente | bloqueada | pendiente`). Sesiones del chat en memoria (`Map`).
- `fixtures/` nunca se escribe. `demo.ts` borra `out/` al inicio.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| SQLite (`bun:sqlite`) | Trae transacciones gratis, pero el PRD pide archivos y auditoría legible a simple vista. |
| Idempotencia por hash del payload | Un reintento con un payload corregido crearía otra OC. La referencia de negocio (`solicitud_id`) es la clave correcta, igual que en SAP real. |

## Consecuencias
- (+) Todo es inspeccionable con `cat` durante la defensa.
- (−) En Render el disco es efímero: `out/` se pierde en cada redeploy. Se acepta para la demo y se documenta.
- (−) La cola en memoria no sirve con varias instancias. En producción la idempotencia la da SAP o una base de datos (SOLUCION.md §6).
