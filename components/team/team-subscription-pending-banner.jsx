import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { teamSubscriptionBannerContent } from '../../utils/team-subscription-banner.js';

// Aviso de la cuota del equipo, con acceso al pago. Se muestra siempre que el
// corredor integra un equipo que cobra: vencida (rojo), pendiente (ámbar) o al
// día (neutro, con la próxima cuota). Mismo patrón visual que
// PendingPaymentBanner de tier-upgrade-screen.jsx, pero acá el dinero va al
// entrenador, no a Paceron.
//
// No bloquea nada: el backend tampoco lo hace (lo único que impide con deuda es
// salir del equipo), así que bloquear contenido sería enforcement solo de UI.
// Decisión registrada en la spec de 2026-08-12 para el período de gracia.
//
// El botón va siempre en verde, como el "Pagar" del Home y de Pagos: el
// color del aviso ya dice si está vencida o pendiente.
//
// Entre variantes cambian solo clases de color: nada de sombras ni
// pseudo-estados condicionales (quirk de NativeWind en CLAUDE.md).
const VARIANTS = {
  debt: {
    box: 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-900/20',
    icon: 'alert-circle',
    iconColor: '#e11d48',
    title: 'text-rose-800 dark:text-rose-300',
    amount: 'text-rose-800 dark:text-rose-200',
    detail: 'text-rose-700 dark:text-rose-400',
  },
  pending: {
    box: 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20',
    icon: 'clock-outline',
    iconColor: '#d97706',
    title: 'text-amber-800 dark:text-amber-300',
    amount: 'text-amber-800 dark:text-amber-200',
    detail: 'text-amber-700 dark:text-amber-400',
  },
  current: {
    box: 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-surface-2',
    icon: 'check-circle-outline',
    iconColor: '#16a34a',
    title: 'text-slate-900 dark:text-white',
    amount: 'text-slate-700 dark:text-slate-200',
    detail: 'text-slate-500 dark:text-slate-400',
  },
};

export function TeamSubscriptionPendingBanner({ hasDebt, isPendingFirstPayment, membershipFee, nextInstallment, onPay }) {
  const content = teamSubscriptionBannerContent({ hasDebt, isPendingFirstPayment, membershipFee, nextInstallment });
  const styles = VARIANTS[content.variant];

  return (
    <View
      className={`mb-4 flex-row items-center justify-between gap-3 rounded-2xl border p-4 ${styles.box}`}
      nativeID="team-subscription-pending-banner"
      testID="team-subscription-pending-banner"
    >
      <View className="flex-1" nativeID="team-subscription-pending-banner-text" testID="team-subscription-pending-banner-text">
        <View className="flex-row items-center gap-1.5" nativeID="team-subscription-pending-banner-title-row" testID="team-subscription-pending-banner-title-row">
          <MaterialCommunityIcons color={styles.iconColor} name={styles.icon} size={15} />
          <Text
            className={`text-sm font-semibold ${styles.title}`}
            nativeID="team-subscription-pending-banner-title"
            testID="team-subscription-pending-banner-title"
          >
            {content.title}
          </Text>
        </View>
        {content.amountLabel !== null && (
          <Text
            className={`mt-1 text-sm font-bold ${styles.amount}`}
            nativeID="team-subscription-pending-banner-amount"
            testID="team-subscription-pending-banner-amount"
          >
            {content.amountLabel}
          </Text>
        )}
        <Text
          className={`mt-0.5 text-xs ${styles.detail}`}
          nativeID="team-subscription-pending-banner-subtitle"
          testID="team-subscription-pending-banner-subtitle"
        >
          {content.detail}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        className="h-9 flex-row items-center justify-center rounded-full bg-primary px-4"
        nativeID="team-subscription-pending-banner-button"
        onPress={onPay}
        testID="team-subscription-pending-banner-button"
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="team-subscription-pending-banner-button-label" testID="team-subscription-pending-banner-button-label">
          {content.buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}
