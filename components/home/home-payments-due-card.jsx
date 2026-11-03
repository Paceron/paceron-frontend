import { useRouter } from 'expo-router';
import { useUpcomingPayments } from '../../hooks/use-payment-history.js';
import { homeDuePayments, payRouteFor } from '../../utils/payment-due.js';
import { PaymentsUpcomingCard } from '../profile/payments-upcoming-card.jsx';

// Aviso del Home con las cuotas vencidas o que vencen en los próximos días
// (utils/payment-due.js#HOME_DUE_WINDOW_DAYS), cada una con su "Pagar", que
// abre el pago directo. Es la misma tarjeta de "Próximos vencimientos" de
// Pagos, recortada. Sin nada para avisar no ocupa lugar, y tampoco mientras
// carga o si falla: en el Home un esqueleto o un error de pagos sería ruido.
export function HomePaymentsDueCard() {
  const router = useRouter();
  const { items } = useUpcomingPayments();
  const due = homeDuePayments(items);
  if (due.length === 0) return null;
  const anyOverdue = due.some((item) => item.overdue);

  return (
    <PaymentsUpcomingCard
      items={due}
      onPay={(item) => {
        const route = payRouteFor(item);
        if (route) router.push(route);
      }}
      scope="home-payments-due"
      title={anyOverdue ? 'Tenés cuotas vencidas' : 'Cuotas por vencer'}
    />
  );
}
