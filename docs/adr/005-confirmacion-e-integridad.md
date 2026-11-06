# ADR-005 · Confirmación humana con doble candado e integridad del payload

**Estado:** Aceptado · 2026-11-05 · **Modificado por [ADR-012](012-confirmaciones-centralizadas.md)** (el "candado 2" pasa de la sesión del chat a un registro central por caso; la integridad del payload sigue igual)

## Contexto
El PRD exige que `oc_crear` solo proceda con confirmaciones si `confirmado = true` (HU-5) y que el agente solo actúe si **el siguiente mensaje del usuario** confirma (CA3). También advierte que el modelo podría alterar un monto para que cuadre (§10). Si `confirmado` fuera solo un argumento, el modelo podría ponerlo en `true` sin que nadie confirmara, y si el payload viajara como argumento, el modelo podría editarlo.

## Decisión
**Candado 1, el argumento:** `oc_crear({ caso, confirmado })` rechaza si hay confirmaciones y `confirmado !== true`.

**Candado 2, el backend:** la sesión guarda `pendiente = { caso, codigos }` cuando una herramienta pide confirmación. Solo cuando el **siguiente** mensaje del usuario es afirmativo, el servidor agrega el caso a `ctx.confirmados`. `oc_crear` exige `confirmado === true` **y** `ctx.confirmados.has(caso)`. Si el usuario cambia de tema, el pendiente se descarta.

**Integridad:** las herramientas reciben solo `caso`. `construir_payload` guarda `out/<caso>/payload.json` y su `sha256`; `oc_crear` lee ese archivo, recalcula la validación y verifica el hash antes de crear. El modelo nunca tiene en sus manos un payload que luego se escriba en SAP.

El front muestra el estado `needsConfirmation` con borde ámbar y botones Confirmar / Cancelar.

## Alternativas descartadas
| Alternativa | Por qué no |
|---|---|
| Solo el argumento `confirmado` | El modelo puede auto-confirmar. Es justo lo que el PRD quiere evitar. |
| Pasar `paquete`/`payload` como argumentos (como sugiere la tabla del PRD) | Permite que el modelo cambie montos entre llamadas. Se documenta como desviación consciente. |
| Endpoint separado `/api/confirmar` sin pasar por el modelo | Más robusto, pero rompe la experiencia conversacional que pide el PRD. Se deja como mejora. |

## Consecuencias
- (+) La confirmación es real y auditable: queda en el log quién y cuándo confirmó.
- (+) Defensa clara ante el riesgo "el modelo arregla el monto".
- (−) El contexto `ctx` de las herramientas se amplía con `confirmados`. `demo.ts` lo simula pasando un `Set`.
- (−) Detectar la afirmación con regex puede fallar con frases raras. Mitigación: los botones del front envían un texto fijo ("confirmo").
