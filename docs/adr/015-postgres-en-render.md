# ADR-015 · Postgres en Render como almacén de estado, con los archivos del PRD como artefactos

**Estado:** Aceptado como diseño · implementación opcional (solo si sobra tiempo en el reto) · 2026-11-06. Mientras no se implemente, rige ADR-006 con el puerto `port.ts` + `FileRepository`.

## Contexto
- El despliegue es en **Render**, plan gratuito. Ese plan apaga el servicio tras unos 15 minutos sin tráfico y su disco es efímero: al despertar, `out/` está vacío y se pierden órdenes, confirmaciones, sesiones y la secuencia de OC. En la defensa eso se nota.
- El PRD (§3.2) no pide base de datos, pero tampoco la prohíbe. Sí exige archivos concretos: `out/sap/ordenes.jsonl`, `out/control.csv`, `out/<caso>/trazabilidad.json`, `aprobacion.txt` y `out/log.jsonl`.
- `demo.ts` debe correr sin clave y de forma determinista; no debería depender de una base.
- Con MCP, A2A y la web operando a la vez, la idempotencia con una cola en memoria (ADR-006) es frágil.

## Decisión
**Repositorio con un puerto y tres adaptadores** (`src/app/repo/`):

| Adaptador | Cuándo se usa | Qué hace |
|---|---|---|
| `FileRepository` | Siempre | Escribe los artefactos que exige el PRD en `out/`. |
| `PostgresRepositorysitory` | Si existe `DATABASE_URL` | Guarda el estado: órdenes, secuencia, control, confirmaciones, casos, eventos y sesiones. |
| `CompositeRepository` | Si existe `DATABASE_URL` | Escribe en los dos. **Lee de Postgres**, que es la fuente de verdad. |

- `demo.ts` y el desarrollo local sin base usan solo `FileRepository`. Mismo comportamiento, cero dependencias.
- Base: **Render Postgres** (plan gratuito), en la misma región que el servicio y conectada por la *Internal Database URL*.
- Cliente: el Postgres nativo de Bun (`import { sql } from "bun"`), sin dependencias nuevas. Si da problemas, se cambia por el paquete `postgres`.
- Esquema en `db/schema.sql` con `CREATE … IF NOT EXISTS`, aplicado al arrancar. Sin herramienta de migraciones.
- **Idempotencia real:** `UNIQUE (solicitud_id)` en `ordenes` + `INSERT … ON CONFLICT DO NOTHING RETURNING`. La secuencia de Postgres `oc_numero START 4500000001` reemplaza a `secuencia.json`.
- Los maestros y los fixtures siguen siendo archivos de solo lectura (son la entrada del PRD).
- `POST /api/reset` limpia las tablas y `out/` para repetir la demo.

### Esquema

| Tabla | Contenido | Clave |
|---|---|---|
| `ordenes` | numero_oc, solicitud_id, caso, payload (jsonb), fecha | PK numero_oc · UNIQUE solicitud_id |
| `control` | solicitud_id, resultado, numero_oc, retroactiva, bloqueos[], confirmaciones[], canal, ts | id serial |
| `confirmaciones` | caso, codigos[], detalle (jsonb), estado, canal, quien, resuelta_en | PK caso |
| `casos` | caso, estado, validacion, payload, payload_sha, trazabilidad, evidencia_sha, actualizado_en | PK caso |
| `eventos` | ts, canal, tipo, caso, ok, resumen, datos (jsonb) | id serial |
| `sesiones` | id, mensajes (jsonb), tokens_usados, actualizado_en | PK id |

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Solo archivos (ADR-006 original) | Se pierden en cada sueño o redeploy de Render. |
| SQLite en un disco persistente de Render | Los discos persistentes son de planes pagos. |
| Neon o Supabase (Postgres gratuito externo) | Funcionan igual y no vencen, pero suman otra cuenta. Quedan como plan B: solo cambia `DATABASE_URL`. |
| Reemplazar los archivos por la base | Incumple HU-5 y deja a `demo.ts` dependiendo de una base. |
| ORM (Prisma, Drizzle) | Generación de código y migraciones que no caben en 2 horas para 6 tablas. |

## Consecuencias
- (+) El estado sobrevive al sueño y a los redeploys de Render; la defensa no depende de que el servicio esté despierto.
- (+) La idempotencia la garantiza la base, también con peticiones simultáneas desde chat, MCP y A2A.
- (+) `eventos` y `control` quedan consultables con SQL, que es lo que pediría auditoría.
- (+) Se cumplen los archivos del PRD sin cambiar nada de lo que se evalúa.
- (−) Escritura doble. Si falla la escritura del archivo después de la base, el archivo queda atrasado. Se acepta: la base es la fuente de verdad y los archivos se pueden regenerar.
- (−) Al arrancar, `out/` está vacío aunque la base tenga datos. Mitigación: al iniciar, `CompositeRepository` regenera `ordenes.jsonl` y `control.csv` desde la base.
- (−) Render Postgres gratuito tiene fecha de vencimiento (hoy, unos 30 días después de crearlo; verificarlo al crear la base). Alcanza para el proceso de selección; si no, Neon.
- (−) Unos 10 minutos más de desarrollo (ver PLAN).
