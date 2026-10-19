import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { isMobile, isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { usePermissions, useUser } from '../../hooks/use-user.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { usePaymentHistory, useReceivedPayments, useReceivedPaymentsSummary } from '../../hooks/use-payment-history.js';
import { buildReceiptHtml, receiptFileName } from '../../utils/receipt-html.js';
import { canGoBack, shiftMonth } from '../../utils/payments-summary.js';
// Sin extensión a propósito: hay split .js / .web.js y Metro solo resuelve por
// plataforma cuando el specifier no la trae (quirk en CLAUDE.md).
import { shareReceiptPdf } from '../../services/receipt';
import { RequireAuth } from '../guards/require-auth.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { PaymentsDashboard } from './payments-dashboard.jsx';
import { PaymentsFilters, PaymentsHistoryFilters } from './payments-filters.jsx';
import { PaymentsList } from './payments-list.jsx';

// Cuántos meses corre la ventana del gráfico cada flecha: los mismos que muestra.
const WINDOW_MONTHS = 6;

// Primero Cobros y después Pagos. Las métricas de cobros (dashboard) viven solo
// en la pestaña de Cobros: en Pagos no aplican, son los pagos que hizo él.
const TRAINER_TABS = [
  { id: 'received', label: 'Cobros', icon: 'cash-plus' },
  { id: 'history', label: 'Pagos', icon: 'receipt-text-outline' },
];

function PaymentsScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isWide = isWeb && !isNarrowWeb;
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { user } = useUser(userId);
  const { roles } = usePermissions(userId);
  // El entrenador activo suma sus cobros y el dashboard; cualquier otro usuario
  // ve solo su historial de pagos.
  const isTrainer = activeRole === 'trainer' && roles.some((r) => r.name === 'entrenador');

  const [tab, setTab] = useState('received');
  const activeTab = isTrainer ? tab : 'history';
  const [teamId, setTeamId] = useState('');
  const [receivedStatus, setReceivedStatus] = useState('');
  const [historyType, setHistoryType] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [receiptBusyId, setReceiptBusyId] = useState(null);
  const [amountMode, setAmountMode] = useState('gross');
  // 0 = la ventana termina en el mes actual; 1 = los 6 meses anteriores; etc.
  const [windowOffset, setWindowOffset] = useState(0);

  // `summary` es siempre la ventana que termina hoy (tiles). `windowQuery` solo
  // se pide cuando la ventana del gráfico está corrida hacia atrás.
  const summary = useReceivedPaymentsSummary({ enabled: isTrainer });
  const monthly = summary.summary?.monthly ?? [];
  const currentMonth = monthly[monthly.length - 1]?.month ?? null;
  const until = windowOffset > 0 && currentMonth ? shiftMonth(currentMonth, -WINDOW_MONTHS * windowOffset) : undefined;
  const windowQuery = useReceivedPaymentsSummary({ enabled: isTrainer && Boolean(until), until });
  const windowSummary = until ? windowQuery.summary : summary.summary;
  const received = useReceivedPayments({ teamId, status: receivedStatus, enabled: isTrainer && activeTab === 'received' });
  const history = usePaymentHistory({ type: historyType, status: historyStatus, enabled: activeTab === 'history' });
  const activeList = activeTab === 'received' ? received : history;

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      activeTab === 'received' ? summary.refetch() : null,
      activeTab === 'received' && until ? windowQuery.refetch() : null,
      activeList.refetch(),
    ])
  );

  const selectStatus = (group) => {
    setTab('received');
    setReceivedStatus(group);
  };

  const handleReceipt = async (payment) => {
    setReceiptBusyId(payment.id);
    try {
      const payer = { fullName: [user?.name, user?.surname].filter(Boolean).join(' '), email: user?.email };
      await shareReceiptPdf({ html: buildReceiptHtml({ payment, payer }), fileName: receiptFileName(payment) });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos generar el comprobante', text2: error?.message });
    } finally {
      setReceiptBusyId(null);
    }
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
            {isTrainer ? 'Pagos y cobros' : 'Historial de pagos'}
          </Text>
        </View>

        {isTrainer ? <TabBar active={activeTab} onChange={setTab} scope="payments-screen-tabs" tabs={TRAINER_TABS} /> : null}

        {activeTab === 'received' ? (
          <>
            <PaymentsDashboard
              activeStatus={receivedStatus}
              amountMode={amountMode}
              canNext={windowOffset > 0}
              canPrev={Boolean(windowSummary) && canGoBack(windowSummary.monthly, summary.summary?.earliestMonth)}
              currentMonth={currentMonth}
              failed={summary.failed}
              isWide={isWide}
              loading={summary.loading}
              onChangeAmountMode={setAmountMode}
              onNext={() => setWindowOffset((o) => Math.max(0, o - 1))}
              onPrev={() => setWindowOffset((o) => o + 1)}
              onRetry={() => summary.refetch()}
              onRetryWindow={() => windowQuery.refetch()}
              onSelectStatus={selectStatus}
              summary={summary.summary}
              windowFailed={Boolean(until) && windowQuery.failed}
              windowLoading={Boolean(until) && windowQuery.loading}
              windowSummary={windowSummary}
            />
            <PaymentsFilters
              isWide={isWide}
              onChangeStatus={setReceivedStatus}
              onChangeTeam={setTeamId}
              status={receivedStatus}
              teamId={teamId}
              teams={summary.summary?.byTeam ?? []}
            />
            {receivedStatus === 'pending' || receivedStatus === 'rejected' ? (
              <Text className="mb-3 text-xs leading-4 text-slate-500 dark:text-slate-400" nativeID="payments-screen-attempts-note" testID="payments-screen-attempts-note">
                Se listan todos los intentos de pago. El resumen cuenta cuotas: una cuota que se rechazó y después se pagó no figura como rechazada.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="payments-screen-history-intro" testID="payments-screen-history-intro">
              Tus pagos de suscripción y lo que les pagaste a tus entrenadores. De los pagos aprobados podés descargar el comprobante en PDF.
            </Text>
            <PaymentsHistoryFilters isWide={isWide} onChangeStatus={setHistoryStatus} onChangeType={setHistoryType} status={historyStatus} type={historyType} />
          </>
        )}

        <PaymentsList
          failed={activeList.failed}
          hasMore={activeList.hasMore}
          isWide={isWide}
          items={activeList.items}
          loadMore={activeList.loadMore}
          loading={activeList.loading}
          loadingMore={activeList.loadingMore}
          onReceipt={handleReceipt}
          onRetry={() => activeList.refetch()}
          receiptBusyId={receiptBusyId}
          variant={activeTab}
        />
      </View>
    </ScrollView>
  );
}

// Historial de pagos de cualquier usuario y, con el rol entrenador activo,
// también sus cobros y el dashboard. Se llega desde la tarjeta de Mi perfil.
// Ver docs/superpowers/specs/2026-09-26-trainer-payments-dashboard-design.md.
export function PaymentsScreen() {
  return (
    <RequireAuth>
      <PaymentsScreenContent />
    </RequireAuth>
  );
}
