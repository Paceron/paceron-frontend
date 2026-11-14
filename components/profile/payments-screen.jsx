import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { isMobile, isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { usePermissions, useUser } from '../../hooks/use-user.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { PAYMENT_HISTORY_KEYS, usePaymentHistory, useReceivedPayments, useReceivedPaymentsSummary, useUpcomingPayments } from '../../hooks/use-payment-history.js';
import { buildReceiptHtml, receiptFileName } from '../../utils/receipt-html.js';
import { canGoBack, shiftMonth } from '../../utils/payments-summary.js';
import { toISODate } from '../../utils/date-field-format.js';
import { createPreference } from '../../services/payments.js';
import { getCurrentSubscription } from '../../services/tier-subscriptions.js';
import { getTeamSubscription } from '../../services/team-subscriptions.js';
import { toCreatePreferencePayload, toPreferenceResponseModel, toSubscriptionModel, toTeamSubscriptionModel } from '../../services/normalizers.js';
// Sin extensión a propósito: hay split .js / .web.js y Metro solo resuelve por
// plataforma cuando el specifier no la trae (quirk en CLAUDE.md).
import { shareReceiptPdf } from '../../services/receipt';
import { RequireAuth } from '../guards/require-auth.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { ScreenCard } from '../shared/screen-card.jsx';
import { CheckoutFlow } from '../payments/checkout-flow';
import { PaymentsDashboard } from './payments-dashboard.jsx';
import { PaymentsFilters, PaymentsHistoryFilters } from './payments-filters.jsx';
import { PaymentsList } from './payments-list.jsx';
import { PaymentsUpcomingCard } from './payments-upcoming-card.jsx';

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
  const queryClient = useQueryClient();
  const { from } = useLocalSearchParams();
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
  const [payerId, setPayerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [receivedStatus, setReceivedStatus] = useState('');
  const [historyType, setHistoryType] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [receiptBusyId, setReceiptBusyId] = useState(null);
  // 0 = la ventana termina en el mes actual; 1 = los 6 meses anteriores; etc.
  const [windowOffset, setWindowOffset] = useState(0);
  // Pago de una cuota de "Próximos vencimientos" sin salir de la pantalla:
  // `checkoutData` es la preferencia ya creada, `payingKey` la fila que está
  // preparando el pago y `confirmingKey` la que espera que el backend refleje
  // la cuota paga (mismo patrón que Mi perfil y team-subscription-screen).
  const [checkoutData, setCheckoutData] = useState(null);
  const [payingKey, setPayingKey] = useState(null);
  const [confirmingKey, setConfirmingKey] = useState(null);

  // `summary` es siempre la ventana que termina hoy (tiles). `windowQuery` solo
  // se pide cuando la ventana del gráfico está corrida hacia atrás.
  const summary = useReceivedPaymentsSummary({ enabled: isTrainer });
  const monthly = summary.summary?.monthly ?? [];
  const currentMonth = monthly[monthly.length - 1]?.month ?? null;
  const until = windowOffset > 0 && currentMonth ? shiftMonth(currentMonth, -WINDOW_MONTHS * windowOffset) : undefined;
  const windowQuery = useReceivedPaymentsSummary({ enabled: isTrainer && Boolean(until), until });
  const windowSummary = until ? windowQuery.summary : summary.summary;
  const received = useReceivedPayments({
    teamId,
    status: receivedStatus,
    payerId,
    from: toISODate(dateFrom),
    to: toISODate(dateTo),
    enabled: isTrainer && activeTab === 'received',
  });
  const history = usePaymentHistory({ type: historyType, status: historyStatus, enabled: activeTab === 'history' });
  const upcoming = useUpcomingPayments({ enabled: activeTab === 'history' });
  const activeList = activeTab === 'received' ? received : history;

  // "Pagar" de Próximos vencimientos: el listado no trae `installment_id`, así
  // que primero se pide la suscripción real de esa cuota (tier o equipo) y
  // recién con eso se crea la preferencia. El botón de la fila muestra la
  // ruedita mientras tanto (`payingKey`).
  const startUpcomingCheckout = async (item) => {
    if (!item || payingKey || confirmingKey) return;
    setPayingKey(item.key);
    try {
      let data;
      if (item.type === 'subscription') {
        const roleName = item.tierRoleName ?? 'entrenador';
        const roleId = roles.find((r) => r.name === roleName)?.id;
        if (!roleId) throw new Error('No encontramos el rol de esa suscripción.');
        const subscription = toSubscriptionModel(await getCurrentSubscription(userId, roleId));
        if (!subscription?.installmentId) throw new Error('No hay una cuota pendiente para pagar.');
        data = {
          amount: subscription.installmentAmount,
          installmentId: subscription.installmentId,
          kind: 'tier',
          paidBefore: subscription.paidInstallments ?? 0,
          roleId,
          rowKey: item.key,
        };
      } else {
        if (item.teamId == null) throw new Error('No encontramos el equipo de esa cuota.');
        const subscription = toTeamSubscriptionModel(await getTeamSubscription(userId, item.teamId));
        const next = subscription?.nextInstallment;
        if (!next?.installmentId) throw new Error('No hay una cuota pendiente para pagar.');
        data = {
          amount: next.installmentAmount,
          installmentId: next.installmentId,
          kind: 'team',
          paidBefore: subscription?.membership?.paidInstallments ?? 0,
          rowKey: item.key,
          teamId: item.teamId,
          teamName: subscription?.team?.name ?? item.title ?? 'el equipo',
        };
      }

      const payload = data.kind === 'tier'
        ? toCreatePreferencePayload({
          concept: 'subscription',
          description: 'Cuota de suscripción de tier',
          items: [{ title: 'Cuota mensual de tier', quantity: 1, unitPrice: data.amount }],
          installmentId: data.installmentId,
        })
        : toCreatePreferencePayload({
          // `concept: 'team_subscription'` hace que el backend cobre con el
          // access token del entrenador (split) — mismo criterio que
          // team-subscription-screen.jsx.
          concept: 'team_subscription',
          description: `Cuota mensual de membresía a ${data.teamName}`,
          items: [{ title: `Participación en ${data.teamName}`, quantity: 1, unitPrice: data.amount }],
          installmentId: data.installmentId,
        });
      const preference = toPreferenceResponseModel(await createPreference(payload));
      if (!preference?.preferenceId || !preference?.publicKey) {
        throw new Error('La preferencia de pago vino incompleta.');
      }
      setCheckoutData({ ...data, preferenceId: preference.preferenceId, publicKey: preference.publicKey });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos iniciar el pago', text2: error?.message });
    } finally {
      setPayingKey(null);
    }
  };

  // Confirmación post-pago: el webhook de MP es asíncrono, así que se mide por
  // paid_installments (mismo criterio que Mi perfil y team-subscription).
  const handleUpcomingApproved = async () => {
    const data = checkoutData;
    if (!data) return;
    setCheckoutData(null);
    setConfirmingKey(data.rowKey);
    let paid = false;
    try {
      for (let attempt = 0; attempt < 2 && !paid; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (data.kind === 'tier') {
          const subscription = toSubscriptionModel(await getCurrentSubscription(userId, data.roleId));
          paid = (subscription?.paidInstallments ?? 0) > data.paidBefore;
        } else {
          const subscription = toTeamSubscriptionModel(await getTeamSubscription(userId, data.teamId));
          paid = (subscription?.membership?.paidInstallments ?? 0) > data.paidBefore;
        }
      }
    } catch {
      // Un fallo al verificar no significa que el pago no haya entrado: se
      // informa como "recibido" y el próximo refresh lo termina de reflejar.
    } finally {
      setConfirmingKey(null);
      queryClient.invalidateQueries({ queryKey: PAYMENT_HISTORY_KEYS.upcoming(userId) });
      queryClient.invalidateQueries({ queryKey: PAYMENT_HISTORY_KEYS.history(userId) });
      queryClient.invalidateQueries({ queryKey: ['subscription-current', userId] });
      upcoming.refetch();
    }
    if (paid) {
      Toast.show({
        type: 'success',
        text1: 'Pago confirmado',
        text2: data.kind === 'team' ? `Tu membresía a ${data.teamName} está al día.` : 'Tu suscripción sigue activa.',
      });
    } else {
      Toast.show({ type: 'info', text1: 'Tu pago fue recibido', text2: 'Puede tardar unos minutos en reflejarse.' });
    }
  };

  const handleUpcomingCheckoutError = (error) => {
    setCheckoutData(null);
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };

  const handleUpcomingCheckoutCancel = () => setCheckoutData(null);

  const { refreshing, onRefresh } = usePullToRefresh(() =>
    Promise.all([
      activeTab === 'received' ? summary.refetch() : null,
      activeTab === 'received' && until ? windowQuery.refetch() : null,
      activeTab === 'history' ? upcoming.refetch() : null,
      activeList.refetch(),
    ])
  );

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
      <ScreenCard maxWidthClassName="max-w-5xl" nativeID="payments-screen-container" testID="payments-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="payments-screen-header" testID="payments-screen-header">
          {from === 'profile' ? (
            <>
              <Pressable
                className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
                nativeID="payments-screen-back-button"
                onPress={() => router.back()}
                testID="payments-screen-back-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="payments-screen-back-label" testID="payments-screen-back-label">Mi perfil</Text>
              </Pressable>
              <Text className="text-sm text-slate-400 dark:text-slate-600" nativeID="payments-screen-breadcrumb-separator" testID="payments-screen-breadcrumb-separator">/</Text>
            </>
          ) : null}
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="payments-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="payments-screen-title">
            {isTrainer ? 'Finanzas' : 'Historial de pagos'}
          </Text>
        </View>

        {isTrainer ? <TabBar active={activeTab} onChange={setTab} scope="payments-screen-tabs" tabs={TRAINER_TABS} /> : null}

        {activeTab === 'received' ? (
          <>
            <PaymentsDashboard
              canNext={windowOffset > 0}
              canPrev={Boolean(windowSummary) && canGoBack(windowSummary.monthly, summary.summary?.earliestMonth)}
              currentMonth={currentMonth}
              failed={summary.failed}
              isWide={isWide}
              loading={summary.loading}
              onNext={() => setWindowOffset((o) => Math.max(0, o - 1))}
              onPrev={() => setWindowOffset((o) => o + 1)}
              onRetry={() => summary.refetch()}
              onRetryWindow={() => windowQuery.refetch()}
              summary={summary.summary}
              windowFailed={Boolean(until) && windowQuery.failed}
              windowLoading={Boolean(until) && windowQuery.loading}
              windowSummary={windowSummary}
            />
            <PaymentsFilters
              dateFrom={dateFrom}
              dateTo={dateTo}
              isWide={isWide}
              onChangeDateFrom={setDateFrom}
              onChangeDateTo={setDateTo}
              onChangePayer={setPayerId}
              onChangeStatus={setReceivedStatus}
              onChangeTeam={setTeamId}
              payerId={payerId}
              payers={summary.summary?.payers ?? []}
              status={receivedStatus}
              teamId={teamId}
              teams={summary.summary?.byTeam ?? []}
            />
            {receivedStatus === 'rejected' ? (
              <Text className="mb-3 text-xs leading-4 text-slate-500 dark:text-slate-400" nativeID="payments-screen-attempts-note" testID="payments-screen-attempts-note">
                Se listan todos los intentos de pago. El KPI cuenta cuotas rechazadas: una cuota que se rechazó y después se pagó no figura como rechazada.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <PaymentsUpcomingCard
              confirmingKey={confirmingKey}
              failed={upcoming.failed}
              items={upcoming.items}
              loading={upcoming.loading}
              onPay={startUpcomingCheckout}
              onRetry={() => upcoming.refetch()}
              payingKey={payingKey}
            />
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

        {checkoutData && (
          <CheckoutFlow
            amount={checkoutData.amount}
            concept={checkoutData.kind === 'team' ? 'team_subscription' : undefined}
            installmentId={checkoutData.installmentId}
            key={checkoutData.preferenceId}
            marketplace={checkoutData.kind === 'team'}
            onApproved={handleUpcomingApproved}
            onCancel={handleUpcomingCheckoutCancel}
            onError={handleUpcomingCheckoutError}
            preferenceId={checkoutData.preferenceId}
            publicKey={checkoutData.publicKey}
          />
        )}
      </ScreenCard>
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
