---
name: ordenes-compra
description: Conocimiento del proceso de órdenes de compra de Periferia (actores, controles RC1–RC10, OC retroactivas, glosario SAP).
---

# Conocimiento del proceso: órdenes de compra en Periferia

## Cómo llega una compra

Cada compra llega por correo con tres piezas: la solicitud (Excel), la cotización del proveedor (PDF) y el correo de aprobación del líder. A veces también llega la factura, cuando la compra ya se hizo.

## Actores

- **Solicitante:** necesita comprar algo y envía el paquete.
- **Líder aprobador:** aprueba el gasto respondiendo "Aprobado". Cada centro de costo tiene sus aprobadores, y cada uno tiene un tope.
- **Analista administrativa:** crea la OC en SAP y decide las excepciones.
- **Contabilidad / auditoría:** revisa el log de control (`out/control.csv`).

## Controles (RC1–RC10)

| Regla | Qué revisa | Si falla |
|---|---|---|
| RC1 | El proveedor existe en el maestro (por NIT; si no hay NIT, por nombre) y está activo | Bloqueo: hay que crearlo o reactivarlo en SAP |
| RC2 | La aprobación existe, dice "Aprobado" y viene de un aprobador del centro de costo | Bloqueo: pedir la aprobación correcta |
| RC3 | El valor no supera el tope del aprobador | Bloqueo: pedir aprobación de alguien con tope suficiente |
| RC4 | La subárea pertenece al centro de costo | Bloqueo: corregir la solicitud |
| RC5 | La cotización no difiere más de 2 % de la solicitud | Confirmación: la analista decide; la OC va por el valor de la solicitud |
| RC6 | Si falta el IVA, se toma el predeterminado del proveedor | Confirmación del IVA derivado |
| RC7 | Si faltan las condiciones de pago, se toman las del proveedor | Solo se informa |
| RC8 | Si la factura es anterior a la solicitud, la OC es retroactiva | Confirmación y marca `retroactiva` en el control |
| RC9 | La aprobación es igual o posterior a la solicitud | Confirmación |
| RC10 | cantidad × valor unitario = valor total (± 1) | Bloqueo: corregir la solicitud |

## OC retroactivas

Muchas OC se crean después de que llega la factura, saltándose la cotización. La dirección quiere medirlo: por eso se crean solo con confirmación y quedan marcadas en el control.

## Glosario

- **Centro de costo / subárea:** dónde se imputa el gasto.
- **Indicador de IVA:** C0 excluido, C1 IVA 19 %, C2 IVA 5 %.
- **Condiciones de pago:** Z000 inmediato, Z015, Z030, Z060 (días desde la factura).
- **Número de OC:** lo asigna SAP desde 4500000001. Crear dos veces la misma solicitud devuelve el mismo número.
