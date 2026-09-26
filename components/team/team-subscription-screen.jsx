import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeam } from '../../hooks/use-teams.js';
import { useTeamSubscription } from '../../hooks/use-team-subscription.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { createPreference } from '../../services/payments.js';
import { toCreatePreferencePayload, toPreferenceResponseModel } from '../../services/normalizers.js';
import { formatMonthlyFee, formatArs } from '../../utils/currency.js';
import { formatDisplayDate } from '../../utils/format-date-display.js';
import { notifySuccess } from '../../utils/haptics.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
// Sin extensión a propósito: Metro solo aplica resolución por plataforma
// (.web.jsx antes que .jsx) cuando el specifier no trae extensión — ver quirk
// en CLAUDE.md.
import { CheckoutFlow } from '../payments/checkout-flow';

// Los timestamps del backend son ISO completos (2026-10-01T00:00:00Z) y
// formatDisplayDate espera YYYY-MM-DD.
function formatIsoDate(iso) {
  if (!iso) return null;
  return formatDisplayDate(String(iso).slice(0, 10));
}

function StatusBadge({ status, hasDebt }) {
  const meta = hasDebt
    ? { label: 'Cuota vencida', icon: 'alert-circle', className: 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-900/20', textClassName: 'text-rose-700 dark:text-rose-300', color: '#e11d48' }
    : status === 'active'
      ? { label: 'Membresía activa', icon: 'check-circle', className: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20', textClassName: 'text-emerald-700 dark:text-emerald-300', color: '#059669' }
      : { label: 'Pago pendiente', icon: 'clock-outline', className: 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20', textClassName: 'text-amber-700 dark:text-amber-300', color: '#d97706' };

  return (
    <View className={`flex-row items-center gap-2 self-start rounded-full border px-3 py-1.5 ${meta.className}`} nativeID="team-subscription-status-badge" testID="team-subscription-status-badge">
      <MaterialCommunityIcons color={meta.color} name={meta.icon} size={15} />
      <Text className={`text-xs font-semibold uppercase tracking-wide ${meta.textClassName}`} nativeID="team-subscription-status-badge-label" testID="team-subscription-status-badge-label">
        {meta.label}
      </Text>
    </View>
  );
}

function DetailRow({ id, label, value }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3 py-2" nativeID={`team-subscription-detail-${id}`} testID={`team-subscription-detail-${id}`}>
      <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID={`team-subscription-detail-${id}-label`} testID={`team-subscription-detail-${id}-label`}>
        {label}
      </Text>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`team-subscription-detail-${id}-value`} testID={`team-subscription-detail-${id}-value`}>
        {value}
      </Text>
    </View>
  );
}

function TeamSubscriptionScreenContent({ teamId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);

  const { team } = useTeam(teamId);
  const { subscription, isActive, hasDebt, nextInstallment, loading, refetch } = useTeamSubscription(userId, teamId);
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());

  const [checkoutData, setCheckoutData] = useState(null);
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const teamName = subscription?.team?.name ?? team?.name ?? 'el equipo';
  const membershipFee = subscription?.team?.membershipFee ?? team?.membershipFee ?? 0;
  const status = subscription?.membership?.subscriptionStatus ?? null;
  const paidInstallments = subscription?.membership?.paidInstallments ?? 0;
  const isFirstPayment = nextInstallment?.installmentNumber === 1;

  const startCheckout = () => {
    if (!nextInstallment) return;
    setStarting(true);
    createPreference(toCreatePreferencePayload({
      // `concept: 'team_subscription'` es lo que hace que el backend resuelva el
      // access token de Mercado Pago del ENTRENADOR y cobre con split. Viaja
      // también hasta POST /payments vía la prop `concept` de CheckoutFlow.
      concept: 'team_subscription',
      description: `Cuota mensual de membresía a ${teamName}`,
      items: [{ title: `Participación en ${teamName}`, quantity: 1, unitPrice: nextInstallment.installmentAmount }],
      installmentId: nextInstallment.installmentId,
    }))
      .then((dto) => {
        const preference = toPreferenceResponseModel(dto);
        setCheckoutData({
          preferenceId: preference.preferenceId,
          // La public_key SIEMPRE sale de la preferencia (es la del vendedor).
          // La que viene en subscription.mercadopago es la de integrador de
          // Paceron: mezclarla con el access token del entrenador da el error
          // 2034 "Invalid users involved" de MP.
          publicKey: preference.publicKey,
          amount: nextInstallment.installmentAmount,
          installmentId: nextInstallment.installmentId,
          paidInstallmentsBefore: paidInstallments,
        });
      })
      .catch((error) => {
        // No podemos distinguir "el entrenador no conectó Mercado Pago"
        // (SELLER_NOT_CONNECTED) de una caída real: el backend colapsa todo
        // error de este endpoint a un 500 genérico, y /connect/status es
        // self-only, así que tampoco se puede chequear antes. Mensaje honesto,
        // sin afirmar una causa que no verificamos.
        Toast.show({
          type: 'error',
          text1: 'No pudimos iniciar el pago',
          text2: 'Puede que el equipo todavía no esté listo para cobrar. Probá de nuevo en un rato.',
        });
        if (__DEV__) console.warn('[team-subscription] createPreference falló:', error?.message);
      })
      .finally(() => setStarting(false));
  };

  // Confirmación post-pago: el webhook de Mercado Pago es asíncrono (y en local
  // sin túnel puede no llegar nunca), así que no se puede esperar sincrónico.
  // Mismo patrón que tier-upgrade-screen.jsx: un check a los 5s y, si no se
  // reflejó, un segundo intento. El éxito se mide por paid_installments, que
  // sirve igual para la cuota #1 (además pasa a `active`) y para una renovación
  // (donde la membresía ya venía activa y el status no cambia).
  const handleApproved = async () => {
    const before = checkoutData?.paidInstallmentsBefore ?? paidInstallments;
    setCheckoutData(null);
    setConfirming(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const { data } = await refetch();
      if ((data?.membership?.paidInstallments ?? 0) > before) {
        notifySuccess();
        Toast.show({ type: 'success', text1: 'Pago confirmado', text2: `Tu membresía a ${teamName} está al día.` });
        return;
      }
      Toast.show({ type: 'info', text1: 'Tu pago fue recibido', text2: 'Puede tardar unos minutos en reflejarse.' });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const { data: verificado } = await refetch();
      if ((verificado?.membership?.paidInstallments ?? 0) > before) {
        notifySuccess();
        Toast.show({ type: 'success', text1: 'Pago confirmado', text2: `Tu membresía a ${teamName} está al día.` });
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleCheckoutError = (error) => {
    setCheckoutData(null);
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };

  const isFree = !membershipFee;

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="team-subscription-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="team-subscription-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-2xl' : ''}`} nativeID="team-subscription-screen-container" testID="team-subscription-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="team-subscription-screen-header" testID="team-subscription-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="team-subscription-screen-back-button"
            onPress={() => router.replace(`/teams/${teamId}`)}
            testID="team-subscription-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="team-subscription-screen-back-label" testID="team-subscription-screen-back-label">
              {teamName}
            </Text>
          </Pressable>
          <Text className="text-sm text-slate-400 dark:text-slate-600" nativeID="team-subscription-screen-breadcrumb-separator" testID="team-subscription-screen-breadcrumb-separator">/</Text>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="team-subscription-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="team-subscription-screen-title">
            Mi cuota
          </Text>
        </View>

        {confirming && (
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID="team-subscription-confirming-banner" testID="team-subscription-confirming-banner">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-sm text-slate-600 dark:text-slate-300" nativeID="team-subscription-confirming-banner-label" testID="team-subscription-confirming-banner-label">
              Confirmando pago…
            </Text>
          </View>
        )}

        <SectionCard icon="cash-multiple" title="Membresía">
          {loading ? (
            <View className="items-center py-6" nativeID="team-subscription-screen-loading" testID="team-subscription-screen-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : isFree ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="team-subscription-screen-free" testID="team-subscription-screen-free">
              Este equipo no tiene cuota mensual — tu membresía no requiere ningún pago.
            </Text>
          ) : (
            <View nativeID="team-subscription-screen-detail" testID="team-subscription-screen-detail">
              <StatusBadge hasDebt={hasDebt} status={status} />

              <View className="mt-4 flex-row items-baseline gap-1" nativeID="team-subscription-screen-price-row" testID="team-subscription-screen-price-row">
                <Text className="text-2xl font-bold text-primary" nativeID="team-subscription-screen-price" testID="team-subscription-screen-price">
                  {formatMonthlyFee(membershipFee)}
                </Text>
                <Text className="text-xs font-medium text-slate-400 dark:text-slate-500" nativeID="team-subscription-screen-price-period" testID="team-subscription-screen-price-period">
                  /mes
                </Text>
              </View>

              <View className="mt-4 border-t border-slate-100 pt-2 dark:border-slate-800" nativeID="team-subscription-screen-details" testID="team-subscription-screen-details">
                <DetailRow id="paid" label="Cuotas pagadas" value={String(paidInstallments)} />
                {nextInstallment && (
                  <DetailRow id="installment" label="Próxima cuota" value={`#${nextInstallment.installmentNumber} · ${formatArs(nextInstallment.installmentAmount)}`} />
                )}
                {nextInstallment?.nextDueDate && (
                  <DetailRow id="due" label="Vence" value={formatIsoDate(nextInstallment.nextDueDate)} />
                )}
              </View>

              {hasDebt && (
                <Text className="mt-3 text-xs leading-5 text-rose-600 dark:text-rose-400" nativeID="team-subscription-screen-debt-hint" testID="team-subscription-screen-debt-hint">
                  Tu cuota está vencida. Mientras tengas deuda no vas a poder salir del equipo.
                </Text>
              )}

              {nextInstallment ? (
                <Pressable
                  className={`mt-5 h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${starting || confirming ? 'opacity-60' : ''}`}
                  disabled={starting || confirming}
                  nativeID="team-subscription-screen-pay-button"
                  onPress={startCheckout}
                  testID="team-subscription-screen-pay-button"
                >
                  {starting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                    <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="team-subscription-screen-pay-button-label" testID="team-subscription-screen-pay-button-label">
                      {isFirstPayment ? 'Completar primer pago' : 'Pagar cuota'}
                    </Text>
                  )}
                </Pressable>
              ) : isActive ? (
                <Text className="mt-4 text-sm text-slate-500 dark:text-slate-400" nativeID="team-subscription-screen-nothing-due" testID="team-subscription-screen-nothing-due">
                  No tenés cuotas pendientes por ahora.
                </Text>
              ) : null}

              <Text className="mt-4 text-xs leading-5 text-slate-400 dark:text-slate-500" nativeID="team-subscription-screen-recipient-hint" testID="team-subscription-screen-recipient-hint">
                Tu pago va a la cuenta de Mercado Pago del entrenador del equipo.
              </Text>
            </View>
          )}
        </SectionCard>

        {checkoutData && (
          <CheckoutFlow
            amount={checkoutData.amount}
            concept="team_subscription"
            installmentId={checkoutData.installmentId}
            key={checkoutData.preferenceId}
            marketplace
            onApproved={handleApproved}
            onCancel={() => setCheckoutData(null)}
            onError={handleCheckoutError}
            preferenceId={checkoutData.preferenceId}
            publicKey={checkoutData.publicKey}
          />
        )}
      </View>
    </ScrollView>
  );
}

export function TeamSubscriptionScreen({ teamId }) {
  return (
    <RequireAuth>
      <TeamSubscriptionScreenContent teamId={teamId} />
    </RequireAuth>
  );
}
