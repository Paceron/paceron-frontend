# Cobros pendientes, vencimientos y neto por comisión

**Fecha:** 2026-11-02 · **Rama:** `feature/payments-view-fixes` · **Backend:** change de OpenSpec `cobros-pendientes-y-vencimientos` (rama `feature/vista-cobros-pagos`)

La vista de Pagos y cobros suma lo que falta cobrar, los próximos vencimientos y un neto que siempre existe. Las decisiones de producto y el contrato están en el `design.md` del change del backend. Acá va solo lo que decide el front.

## Decisiones del equipo (2026-11-02)

- **Neto = bruto − comisión de Paceron.** Ya no es el neto que informa Mercado Pago, que llegaba solo por webhook y descontaba además el costo de MP. Todo cobro aprobado trae neto, así que desaparecen "Neto no disponible", "neto parcial" y "s/d".
- **Los cobros de tier son de Paceron.** El entrenador no los ve en Cobros. Cada usuario ve sus propios pagos de tier en la pestaña Pagos (ya era así).
- **Vencido = pasó el vencimiento,** en hora argentina. Los 7 días de gracia no cuentan.
- **Las cuotas esperadas las calcula el backend.** El motor de cuotas crea la N+1 recién cuando se paga la N, así que lo que un corredor todavía debe no está en ninguna tabla. El front no calcula obligaciones: muestra lo que devuelven `/payments/received/summary` y `/payments/upcoming`.

## Cobros (entrenador)

1. **Gráfico mensual:** junto a la barra de lo cobrado, una segunda barra por mes con lo pendiente (`pending_amount` o `pending_net_amount`, según bruto o neto), con leyenda "Cobrado / Pendiente". Pendiente = cuotas sin pagar que vencen en ese mes. Se navega con las mismas flechas.
2. **"Por cobrar este mes":** una tarjeta nueva con dos columnas.
   - "A vencer": desde hoy hasta fin de mes (`due_this_month`).
   - "Vencidos": todo lo que ya venció sin pagar, de este mes o de meses anteriores (`overdue`). Una cuota de octubre que no se pagó se sigue debiendo en noviembre.

   Cada columna muestra el total, la cantidad y la lista: corredor, equipo, número de cuota, monto y vencimiento.
3. **Cada cobro muestra su comisión:** "Neto $X · comisión 5%" (`fee_amount`, `fee_percent`).

## Pagos (cualquier rol)

- **"Próximos vencimientos":** una tarjeta arriba del historial, con la próxima cuota de cada equipo que paga (con su entrenador) y de cada tier. Es la respuesta de `/payments/upcoming`, ordenada por vencimiento. Una cuota vencida se marca en rojo con "vencida" y, si hay más de una, "N cuotas vencidas".
- Sin nada que pagar, la tarjeta no se muestra.

## Piezas

- `services/payment-history.js#getUpcomingPayments` + mock.
- Normalizers `toReceivedPaymentModel` (comisión), `toReceivedSummaryModel` (pendientes y bloques) y `toUpcomingPaymentModel`.
- `hooks/use-payment-history.js#useUpcomingPayments`.
- `utils/payments-summary.js#pendingFor` y `utils/payments-chart.js#buildMonthlyBars` con la barra de pendiente, con tests.
- Componentes: `payments-monthly-chart.jsx` (dos series), `payments-due-card.jsx` (por cobrar este mes) y `payments-upcoming-card.jsx` (próximos vencimientos).

Sin módulos nativos nuevos.
