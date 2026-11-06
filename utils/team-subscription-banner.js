import { formatArs } from './currency.js';
import { formatDueDate } from './payments-summary.js';

// Textos y variante del aviso de cuota en el detalle de un equipo, para el
// corredor que lo integra. Hay tres casos y en los tres hay acceso al pago:
// - `debt`: la cuota venció.
// - `pending`: falta el primer pago (o hay una cuota abierta sin vencer, si el
//   backend todavía no marcó la membresía como activa).
// - `current`: al día. Antes el aviso se ocultaba y no quedaba ningún camino al
//   pago desde el equipo, aunque la cuota siguiente ya se puede pagar.
export function teamSubscriptionBannerContent({ hasDebt, isPendingFirstPayment, nextInstallment, membershipFee }) {
  const amount = formatArs(nextInstallment?.installmentAmount ?? membershipFee);
  const number = nextInstallment?.installmentNumber;

  if (hasDebt || isPendingFirstPayment) {
    return {
      variant: hasDebt ? 'debt' : 'pending',
      title: hasDebt ? 'Tu cuota está vencida' : 'Tenés un pago pendiente',
      amountLabel: amount === null ? null : `${amount} por mes`,
      detail: number === 1
        ? 'Completá la primera cuota para activar tu membresía.'
        : 'Pagá tu cuota para mantener la membresía al día.',
      buttonLabel: 'Completar pago',
    };
  }

  const due = formatDueDate(nextInstallment?.nextDueDate);
  return {
    variant: 'current',
    title: 'Membresía al día',
    amountLabel: nextInstallment && amount !== null ? `Próxima cuota #${number} · ${amount}` : null,
    detail: nextInstallment
      ? (due ? `Vence el ${due}. Podés pagarla antes si querés.` : 'Podés pagarla antes de que venza.')
      : 'No tenés cuotas pendientes por ahora.',
    buttonLabel: nextInstallment ? 'Pagar cuota' : 'Ver cuota',
  };
}
