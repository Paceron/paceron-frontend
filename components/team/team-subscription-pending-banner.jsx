import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatArs } from '../../utils/currency.js';

// Banner de cuota de equipo pendiente o vencida, con acceso al pago. Mismo
// patrón visual que PendingPaymentBanner de tier-upgrade-screen.jsx (ámbar =
// "te falta hacer algo", rojo reservado para destructivo), pero acá el dinero
// va al entrenador, no a Paceron.
//
// No bloquea nada: el backend tampoco lo hace (lo único que impide con deuda es
// salir del equipo), así que bloquear contenido sería enforcement solo de UI.
// Decisión registrada en la spec de 2026-08-12 para el período de gracia.
export function TeamSubscriptionPendingBanner({ amount, hasDebt, installmentNumber, onPay }) {
  const isDebt = Boolean(hasDebt);
  // formatArs devuelve null si no hay monto real — se chequea su resultado en
  // vez de Number.isFinite(amount), porque Number(null) es 0 (finito) y eso
  // mostraría "$ 0 por mes".
  const formattedAmount = formatArs(amount);
  const title = isDebt ? 'Tu cuota está vencida' : 'Tenés un pago pendiente';
  const detail = installmentNumber === 1
    ? 'Completá la primera cuota para activar tu membresía.'
    : 'Pagá tu cuota para mantener la membresía al día.';

  return (
    <View
      className={`mb-4 flex-row items-center justify-between gap-3 rounded-2xl border p-4 ${isDebt ? 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-900/20' : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20'}`}
      nativeID="team-subscription-pending-banner"
      testID="team-subscription-pending-banner"
    >
      <View className="flex-1" nativeID="team-subscription-pending-banner-text" testID="team-subscription-pending-banner-text">
        <View className="flex-row items-center gap-1.5" nativeID="team-subscription-pending-banner-title-row" testID="team-subscription-pending-banner-title-row">
          <MaterialCommunityIcons color={isDebt ? '#e11d48' : '#d97706'} name={isDebt ? 'alert-circle' : 'clock-outline'} size={15} />
          <Text
            className={`text-sm font-semibold ${isDebt ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}
            nativeID="team-subscription-pending-banner-title"
            testID="team-subscription-pending-banner-title"
          >
            {title}
          </Text>
        </View>
        {formattedAmount !== null && (
          <Text
            className={`mt-1 text-sm font-bold ${isDebt ? 'text-rose-800 dark:text-rose-200' : 'text-amber-800 dark:text-amber-200'}`}
            nativeID="team-subscription-pending-banner-amount"
            testID="team-subscription-pending-banner-amount"
          >
            {formattedAmount} por mes
          </Text>
        )}
        <Text
          className={`mt-0.5 text-xs ${isDebt ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}
          nativeID="team-subscription-pending-banner-subtitle"
          testID="team-subscription-pending-banner-subtitle"
        >
          {detail}
        </Text>
      </View>
      <Pressable
        className={`h-9 flex-row items-center justify-center rounded-full px-4 ${isDebt ? 'bg-rose-600' : 'bg-amber-600'}`}
        nativeID="team-subscription-pending-banner-button"
        onPress={onPay}
        testID="team-subscription-pending-banner-button"
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-white" nativeID="team-subscription-pending-banner-button-label" testID="team-subscription-pending-banner-button-label">
          Completar pago
        </Text>
      </Pressable>
    </View>
  );
}
