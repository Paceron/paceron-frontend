import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTierSubscription } from '../../hooks/use-tier-subscription.js';
import { listTiers } from '../../services/tiers.js';
import { createPreference } from '../../services/payments.js';
import { toTierModel, toCreatePreferencePayload, toPreferenceResponseModel } from '../../services/normalizers.js';
import { SectionCard } from '../forms/section-card.jsx';
// Sin extensión a propósito: Metro solo aplica resolución por
// plataforma (.web.jsx antes que .jsx) cuando el specifier no trae
// extensión — ver quirk en CLAUDE.md.
import { CheckoutFlow } from '../payments/checkout-flow';

const ROLE_LABEL = { runner: 'Corredor', trainer: 'Entrenador' };

function formatTierPrice(tierAmount, paymentRequired) {
  if (!paymentRequired || !tierAmount) return 'Gratis';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(tierAmount);
}

// Card de un tier — "Tier actual" si coincide con roles[].tier del rol
// activo; si no y es un tier pago, botón "Mejorar" que dispara el
// flujo real (ver handleUpgrade en TierUpgradeScreen). Tiers gratis
// que no son el actual (no debería pasar hoy, 1 solo tier gratis por
// rol) no muestran ninguna acción.
function TierCard({ tier, isCurrent, isDesktopWeb, loading, onUpgrade }) {
  const colors = useThemeColors();
  const idPrefix = `tier-card-${tier.id}`;
  return (
    <View
      className={`rounded-2xl border p-5 ${isCurrent ? 'border-primary bg-primary-tint dark:bg-primary/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface'} ${isDesktopWeb ? 'w-[31%]' : 'w-full'}`}
      nativeID={idPrefix}
      testID={idPrefix}
    >
      <Text className="text-base font-bold capitalize text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
        {tier.name}
      </Text>
      <View className="mt-1 flex-row items-baseline gap-1" nativeID={`${idPrefix}-price-row`} testID={`${idPrefix}-price-row`}>
        <Text className="text-lg font-bold text-primary" nativeID={`${idPrefix}-price`} testID={`${idPrefix}-price`}>
          {formatTierPrice(tier.tierAmount, tier.paymentRequired)}
        </Text>
        {tier.paymentRequired && (
          <Text className="text-xs font-medium text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-price-period`} testID={`${idPrefix}-price-period`}>
            /mes
          </Text>
        )}
      </View>
      {tier.description && (
        <Text className="mt-3 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-description`} testID={`${idPrefix}-description`}>
          {tier.description}
        </Text>
      )}

      {isCurrent ? (
        <View className="mt-4 h-10 flex-row items-center justify-center gap-2 rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`${idPrefix}-current-badge`} testID={`${idPrefix}-current-badge`}>
          <MaterialCommunityIcons color="#8cc63e" name="check-circle" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-on-primary-tint dark:text-primary" nativeID={`${idPrefix}-current-badge-label`} testID={`${idPrefix}-current-badge-label`}>
            Tier actual
          </Text>
        </View>
      ) : tier.paymentRequired ? (
        <Pressable
          className={`mt-4 h-10 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${loading ? 'opacity-60' : ''}`}
          disabled={loading}
          nativeID={`${idPrefix}-upgrade-button`}
          onPress={() => onUpgrade(tier)}
          testID={`${idPrefix}-upgrade-button`}
        >
          {loading ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-upgrade-button-label`} testID={`${idPrefix}-upgrade-button-label`}>
              Mejorar
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

// Banner de pago pendiente — aparece si ya existe una suscripción
// first_payment_pending (el usuario cambió de tier antes pero nunca
// completó/confirmó el pago). Lleva directo al checkout reusando la
// cuota existente, sin volver a llamar changeTier.
function PendingPaymentBanner({ subscription, onResume, loading }) {
  return (
    <View className="mb-4 flex-row items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/20" nativeID="tier-upgrade-pending-banner" testID="tier-upgrade-pending-banner">
      <View className="flex-1" nativeID="tier-upgrade-pending-banner-text" testID="tier-upgrade-pending-banner-text">
        <Text className="text-sm font-semibold text-amber-800 dark:text-amber-300" nativeID="tier-upgrade-pending-banner-title" testID="tier-upgrade-pending-banner-title">
          Tenés un pago pendiente
        </Text>
        <Text className="mt-0.5 text-xs text-amber-700 dark:text-amber-400" nativeID="tier-upgrade-pending-banner-subtitle" testID="tier-upgrade-pending-banner-subtitle">
          {formatTierPrice(subscription.installmentAmount, true)} para activar {subscription.tier?.name}
        </Text>
      </View>
      <Pressable
        className={`h-9 flex-row items-center justify-center rounded-full bg-amber-600 px-4 ${loading ? 'opacity-60' : ''}`}
        disabled={loading}
        nativeID="tier-upgrade-pending-banner-button"
        onPress={onResume}
        testID="tier-upgrade-pending-banner-button"
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : (
          <Text className="text-xs font-semibold uppercase tracking-wide text-white" nativeID="tier-upgrade-pending-banner-button-label" testID="tier-upgrade-pending-banner-button-label">
            Completar pago
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export function TierUpgradeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isDesktopWeb = isWeb && !isNarrowWeb;
  const activeRole = useAuthStore((s) => s.activeRole);
  const roles = useAuthStore((s) => s.roles);
  const user = useAuthStore((s) => s.user);
  const fetchPermissions = useAuthStore((s) => s.fetchPermissions);

  const currentRoleName = activeRole === 'runner' ? 'corredor' : 'entrenador';
  const currentTierName = roles.find((r) => r.name === currentRoleName)?.tier;
  const currentRoleId = roles.find((r) => r.name === currentRoleName)?.id;

  const { data: tierDtos, isLoading: loadingTiers } = useQuery({
    queryKey: ['tiers-catalog'],
    queryFn: listTiers,
  });
  const tiers = (tierDtos ?? []).map(toTierModel);

  const { subscription, refetchSubscription, changeTier, isChangingTier } = useTierSubscription(user?.userId, currentRoleId);

  const [processingTierId, setProcessingTierId] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const roleTiers = tiers
    .filter((t) => t.roleName === currentRoleName)
    .sort((a, b) => a.tierAmount - b.tierAmount);

  const startCheckout = ({ installmentId, amount, tierId }) => {
    setProcessingTierId(tierId);
    createPreference(toCreatePreferencePayload({
      concept: 'subscription',
      description: 'Cuota de suscripción de tier',
      items: [{ title: 'Cuota mensual de tier', quantity: 1, unitPrice: amount }],
      installmentId,
    }))
      .then((dto) => {
        const preference = toPreferenceResponseModel(dto);
        setCheckoutData({ preferenceId: preference.preferenceId, publicKey: preference.publicKey, amount, tierId, installmentId });
      })
      .catch((error) => {
        Toast.show({ type: 'error', text1: 'No pudimos iniciar el pago', text2: error.message });
      })
      .finally(() => setProcessingTierId(null));
  };

  const handleUpgrade = async (tier) => {
    setProcessingTierId(tier.id);
    try {
      const sub = await changeTier(Number(tier.id));
      startCheckout({ installmentId: sub.installmentId, amount: sub.installmentAmount, tierId: sub.tier.id });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'No pudimos cambiar de tier', text2: error.message });
      setProcessingTierId(null);
    }
  };

  const handleResumePending = () => {
    if (!subscription) return;
    startCheckout({ installmentId: subscription.installmentId, amount: subscription.installmentAmount, tierId: subscription.tier.id });
  };

  const handleApproved = async () => {
    const expectedTierId = checkoutData?.tierId;
    setCheckoutData(null);
    setConfirming(true);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const { data } = await refetchSubscription();
      if (data?.subscriptionStatus === 'active' && data?.tier?.id === expectedTierId) {
        Toast.show({ type: 'success', text1: 'Tier actualizado', text2: `Ahora tenés ${data.tier.name}.` });
        await fetchPermissions();
      } else {
        Toast.show({ type: 'info', text1: 'Tu pago fue recibido', text2: 'Puede tardar unos minutos en reflejarse.' });
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleCheckoutError = (error) => {
    setCheckoutData(null);
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };

  const handleCheckoutCancel = () => {
    setCheckoutData(null);
  };

  const loading = loadingTiers;
  const showPendingBanner = subscription?.subscriptionStatus === 'first_payment_pending';

  return (
    <ScrollView
      nativeID="tier-upgrade-screen-scroll"
      testID="tier-upgrade-screen-scroll"
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      showsVerticalScrollIndicator={false}
    >
      <View nativeID="tier-upgrade-screen-container" testID="tier-upgrade-screen-container" className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <View nativeID="tier-upgrade-screen-header" testID="tier-upgrade-screen-header" className="mb-8 flex-row items-center gap-2">
          <Pressable
            nativeID="tier-upgrade-screen-back-button"
            testID="tier-upgrade-screen-back-button"
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            onPress={() => router.replace('/profile')}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text nativeID="tier-upgrade-screen-back-label" testID="tier-upgrade-screen-back-label" className="text-sm font-medium text-slate-500 dark:text-slate-400">Mi perfil</Text>
          </Pressable>
          <Text nativeID="tier-upgrade-screen-breadcrumb-separator" testID="tier-upgrade-screen-breadcrumb-separator" className="text-sm text-slate-400 dark:text-slate-600">/</Text>
          <Text nativeID="tier-upgrade-screen-title" testID="tier-upgrade-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} className="text-xl text-slate-900 dark:text-white">
            Mejorar tier
          </Text>
        </View>

        {showPendingBanner && (
          <PendingPaymentBanner loading={processingTierId !== null} onResume={handleResumePending} subscription={subscription} />
        )}

        {confirming && (
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID="tier-upgrade-confirming-banner" testID="tier-upgrade-confirming-banner">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-sm text-slate-600 dark:text-slate-300" nativeID="tier-upgrade-confirming-banner-label" testID="tier-upgrade-confirming-banner-label">
              Confirmando pago…
            </Text>
          </View>
        )}

        <SectionCard icon="star-four-points" title={`Tiers de ${ROLE_LABEL[activeRole]}`}>
          {loading ? (
            <View className="items-center py-6" nativeID="tier-upgrade-screen-loading" testID="tier-upgrade-screen-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : roleTiers.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="tier-upgrade-screen-empty" testID="tier-upgrade-screen-empty">
              Todavía no hay tiers configurados para este rol.
            </Text>
          ) : (
            <View className={isDesktopWeb ? 'flex-row flex-wrap gap-4' : 'gap-3'} nativeID="tier-upgrade-screen-cards" testID="tier-upgrade-screen-cards">
              {roleTiers.map((tier) => (
                <TierCard
                  isCurrent={tier.name === currentTierName}
                  isDesktopWeb={isDesktopWeb}
                  key={tier.id}
                  loading={isChangingTier && processingTierId === tier.id}
                  onUpgrade={handleUpgrade}
                  tier={tier}
                />
              ))}
            </View>
          )}
        </SectionCard>

        {checkoutData && (
          <CheckoutFlow
            amount={checkoutData.amount}
            installmentId={checkoutData.installmentId}
            key={checkoutData.preferenceId}
            onApproved={handleApproved}
            onCancel={handleCheckoutCancel}
            onError={handleCheckoutError}
            preferenceId={checkoutData.preferenceId}
            publicKey={checkoutData.publicKey}
          />
        )}
      </View>
    </ScrollView>
  );
}
