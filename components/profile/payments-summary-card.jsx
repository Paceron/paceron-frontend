import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useReceivedPaymentsSummary } from '../../hooks/use-payment-history.js';
import { formatArs } from '../../utils/currency.js';
import {
  computeMonthOverMonth,
  formatMonthLong,
  formatMonthOverMonth,
  formatNetLabel,
  isSummaryEmpty,
  selectCurrentAndPrevious,
} from '../../utils/payments-summary.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { StatTile } from '../shared/stat-tile.jsx';

// Resumen de cobros en Mi perfil, solo con el rol entrenador activo (el gate
// lo hace ProfileScreen). "Ver todo" lleva al detalle en /profile/payments.
export function PaymentsSummaryCard() {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isWide = isWeb && !isNarrowWeb;
  const { summary, loading, failed, refetch } = useReceivedPaymentsSummary();

  const seeAll = (
    <Pressable
      className="flex-row items-center gap-1 rounded-full px-2 py-1 hover:bg-amber-100 active:opacity-70 dark:hover:bg-amber-900/30"
      nativeID="profile-payments-card-see-all"
      onPress={() => router.push('/profile/payments')}
      testID="profile-payments-card-see-all"
    >
      <Text className="text-sm font-semibold text-amber-700 dark:text-amber-400" nativeID="profile-payments-card-see-all-label" testID="profile-payments-card-see-all-label">
        Ver todo
      </Text>
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
    </Pressable>
  );

  let body;
  if (loading) {
    body = (
      <View className={isWide ? 'flex-row gap-3' : 'gap-3'} nativeID="profile-payments-card-loading" testID="profile-payments-card-loading">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="flex-1" height={96} nativeID={`profile-payments-card-skeleton-${i}`} rounded="rounded-2xl" testID={`profile-payments-card-skeleton-${i}`} />
        ))}
      </View>
    );
  } else if (failed) {
    body = (
      <View className="flex-row items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 dark:bg-rose-900/20" nativeID="profile-payments-card-error" testID="profile-payments-card-error">
        <Text className="flex-1 text-sm text-rose-700 dark:text-rose-300" nativeID="profile-payments-card-error-text" testID="profile-payments-card-error-text">
          No pudimos cargar tus cobros.
        </Text>
        <Pressable className="rounded-full bg-rose-100 px-3 py-1.5 hover:opacity-90 active:opacity-80 dark:bg-rose-900/40" nativeID="profile-payments-card-retry" onPress={() => refetch()} testID="profile-payments-card-retry">
          <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300" nativeID="profile-payments-card-retry-label" testID="profile-payments-card-retry-label">Reintentar</Text>
        </Pressable>
      </View>
    );
  } else if (isSummaryEmpty(summary)) {
    body = (
      <Text className="py-2 text-sm leading-5 text-slate-500 dark:text-slate-400" nativeID="profile-payments-card-empty" testID="profile-payments-card-empty">
        Todavía no recibiste cobros de tus equipos. En «Ver todo» también están tus pagos de suscripción.
      </Text>
    );
  } else {
    const { current, previous } = selectCurrentAndPrevious(summary.monthly);
    const mom = computeMonthOverMonth(current, previous);
    body = (
      <View className={isWide ? 'flex-row gap-3' : 'gap-3'} nativeID="profile-payments-card-stats" testID="profile-payments-card-stats">
        <StatTile
          hint={formatNetLabel(current ?? {})}
          icon="cash-plus"
          idPrefix="profile-payments-stat"
          label={`Cobrado en ${formatMonthLong(current?.month)}`}
          value={formatArs(current?.grossAmount ?? 0)}
        />
        <StatTile
          icon={mom.direction === 'down' ? 'trending-down' : mom.direction === 'up' ? 'trending-up' : 'trending-neutral'}
          idPrefix="profile-payments-stat"
          label={`vs ${formatMonthLong(previous?.month)}`}
          value={formatMonthOverMonth(mom)}
        />
        <StatTile
          icon="alert-circle-outline"
          idPrefix="profile-payments-stat"
          label="Cuotas pendientes · rechazadas"
          value={`${summary.pendingCount} · ${summary.rejectedCount}`}
        />
      </View>
    );
  }

  return (
    <SectionCard headerRight={seeAll} icon="cash-multiple" scope="profile-payments-card" title="Pagos y cobros" variant="amber">
      {body}
    </SectionCard>
  );
}
