import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useUpcomingPayments } from '../../hooks/use-payment-history.js';
import { homeDuePayments, payRouteFor } from '../../utils/payment-due.js';
import { PaymentsUpcomingCard } from '../profile/payments-upcoming-card.jsx';
import { SkeletonBlock, SkeletonPulse } from '../shared/skeleton.jsx';
import { HomeReveal } from './home-reveal.jsx';

// Aviso del Home con las cuotas vencidas o que vencen en los próximos días
// (utils/payment-due.js#HOME_DUE_WINDOW_DAYS), cada una con su "Pagar", que
// abre el pago directo. Es la misma tarjeta de "Próximos vencimientos" de
// Pagos, recortada (roja con alguna vencida, ámbar si solo hay por vencer,
// igual que allá). Sin nada para avisar no ocupa lugar.
export function HomePaymentsDueCard() {
  const router = useRouter();
  const { items, loading } = useUpcomingPayments();
  const due = homeDuePayments(items);
  if (due.length === 0 && loading) {
    return (
      <View className="mb-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="home-payments-due-loading" testID="home-payments-due-loading">
        <SkeletonPulse nativeID="home-payments-due-skeleton" testID="home-payments-due-skeleton">
          <SkeletonBlock height={18} nativeID="home-payments-due-skeleton-title" testID="home-payments-due-skeleton-title" width="42%" />
          <SkeletonBlock
            className="mt-3"
            height={46}
            nativeID="home-payments-due-skeleton-row"
            testID="home-payments-due-skeleton-row"
            width="100%"
          />
        </SkeletonPulse>
      </View>
    );
  }
  if (due.length === 0) return null;
  const anyOverdue = due.some((item) => item.overdue);

  return (
    <HomeReveal delay={20} idPrefix="home-payments-due-reveal">
      <PaymentsUpcomingCard
        compact
        items={due}
        onPay={(item) => {
          const route = payRouteFor(item);
          if (route) router.push(route);
        }}
        scope="home-payments-due"
        title={anyOverdue ? 'Tenés cuotas vencidas' : 'Cuotas por vencer'}
      />
    </HomeReveal>
  );
}
