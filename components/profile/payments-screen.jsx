import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isMobile, isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { usePermissions } from '../../hooks/use-user.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { useMyTierPayments, useReceivedPayments, useReceivedPaymentsSummary } from '../../hooks/use-payment-history.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { PaymentsDashboard } from './payments-dashboard.jsx';
import { PaymentsFilters } from './payments-filters.jsx';
import { PaymentsList } from './payments-list.jsx';

const TABS = [
  { id: 'received', label: 'Cobros', icon: 'cash-plus' },
  { id: 'mine', label: 'Mis pagos', icon: 'cash-minus' },
];

function PaymentsScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isWide = isWeb && !isNarrowWeb;
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles, loading: rolesLoading } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  const isTrainer = activeRole === 'trainer';

  const [tab, setTab] = useState('received');
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState('');

  const summary = useReceivedPaymentsSummary({ enabled: isTrainer });
  const received = useReceivedPayments({ teamId, status, enabled: isTrainer && tab === 'received' });
  const mine = useMyTierPayments({ enabled: isTrainer && tab === 'mine' });
  const activeList = tab === 'received' ? received : mine;

  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([summary.refetch(), activeList.refetch()]));

  // El rol activo se lee sincrónico del store (useRoleReconciliation lo baja a
  // runner si el rol real no existe). No se redirige por hasTrainerRole
  // mientras los permisos cargan, para evitar un redirect espurio.
  if (!isTrainer) return <Redirect href="/profile" />;

  const selectStatus = (group) => {
    setTab('received');
    setStatus(group);
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="payments-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="payments-screen-scroll"
    >
      <View className={`w-full self-center ${isWide ? 'max-w-5xl' : ''}`} nativeID="payments-screen-container" testID="payments-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="payments-screen-header" testID="payments-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="payments-screen-back-button"
            onPress={() => router.replace('/profile')}
            testID="payments-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="payments-screen-back-label" testID="payments-screen-back-label">Mi perfil</Text>
          </Pressable>
          <Text className="text-sm text-slate-400 dark:text-slate-600" nativeID="payments-screen-breadcrumb-separator" testID="payments-screen-breadcrumb-separator">/</Text>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="payments-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="payments-screen-title">
            Pagos y cobros
          </Text>
        </View>

        {!rolesLoading && !hasTrainerRole ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-surface" nativeID="payments-screen-not-trainer" testID="payments-screen-not-trainer">
            <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="payments-screen-not-trainer-text" testID="payments-screen-not-trainer-text">
              Esta sección es para entrenadores. Activá tu perfil de entrenador para cobrar las mensualidades de tus equipos.
            </Text>
            <Pressable className="self-start rounded-full bg-primary px-5 py-2.5 hover:opacity-90 active:opacity-80" nativeID="payments-screen-not-trainer-back" onPress={() => router.replace('/profile')} testID="payments-screen-not-trainer-back">
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="payments-screen-not-trainer-back-label" testID="payments-screen-not-trainer-back-label">Volver a Mi perfil</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <PaymentsDashboard
              activeStatus={status}
              failed={summary.failed}
              isWide={isWide}
              loading={summary.loading}
              onRetry={() => summary.refetch()}
              onSelectStatus={selectStatus}
              summary={summary.summary}
            />

            <TabBar active={tab} onChange={setTab} scope="payments-screen-tabs" tabs={TABS} />

            {tab === 'received' ? (
              <PaymentsFilters
                isWide={isWide}
                onChangeStatus={setStatus}
                onChangeTeam={setTeamId}
                status={status}
                teamId={teamId}
                teams={summary.summary?.byTeam ?? []}
              />
            ) : null}

            {tab === 'received' && (status === 'pending' || status === 'rejected') ? (
              <Text className="mb-3 text-xs leading-4 text-slate-500 dark:text-slate-400" nativeID="payments-screen-attempts-note" testID="payments-screen-attempts-note">
                Se listan todos los intentos de pago. El resumen cuenta cuotas: una cuota que se rechazó y después se pagó no figura como rechazada.
              </Text>
            ) : null}

            <PaymentsList
              failed={activeList.failed}
              hasMore={activeList.hasMore}
              isWide={isWide}
              items={activeList.items}
              loadMore={activeList.loadMore}
              loading={activeList.loading}
              loadingMore={activeList.loadingMore}
              onRetry={() => activeList.refetch()}
              variant={tab}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

// Detalle de pagos y cobros del entrenador, al que se llega desde la tarjeta
// "Pagos y cobros" de Mi perfil. Ver
// docs/superpowers/specs/2026-09-26-trainer-payments-dashboard-design.md.
export function PaymentsScreen() {
  return (
    <RequireAuth>
      <PaymentsScreenContent />
    </RequireAuth>
  );
}
