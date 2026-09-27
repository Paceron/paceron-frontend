import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { SectionCard } from '../forms/section-card.jsx';

// Entrada al historial de pagos en Mi perfil para cualquier usuario sin el rol
// entrenador activo. El entrenador activo ve en su lugar PaymentsSummaryCard,
// que lleva a la misma pantalla (/profile/payments).
export function PaymentsHistoryCard() {
  const router = useRouter();
  const colors = useThemeColors();

  const seeAll = (
    <Pressable
      className="flex-row items-center gap-1 rounded-full px-2 py-1 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
      nativeID="profile-payments-history-card-see-all"
      onPress={() => router.push('/profile/payments')}
      testID="profile-payments-history-card-see-all"
    >
      <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="profile-payments-history-card-see-all-label" testID="profile-payments-history-card-see-all-label">
        Ver todo
      </Text>
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={18} />
    </Pressable>
  );

  return (
    <SectionCard headerRight={seeAll} icon="receipt-text-outline" scope="profile-payments-history-card" title="Historial de pagos">
      <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="profile-payments-history-card-text" testID="profile-payments-history-card-text">
        Tus pagos de suscripción y a entrenadores, con su estado y el comprobante en PDF.
      </Text>
    </SectionCard>
  );
}
