import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { SectionCard } from '../forms/section-card.jsx';

const ROLE_LABEL = { runner: 'Corredor', trainer: 'Entrenador' };

export function TierUpgradeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const activeRole = useAuthStore((s) => s.activeRole);
  const roles = useAuthStore((s) => s.roles);

  const currentRoleName = activeRole === 'runner' ? 'corredor' : 'entrenador';
  const currentTier = roles.find((r) => r.name === currentRoleName)?.tier;
  const tierLabel = currentTier === 'premium' ? 'Premium' : 'Base';

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

        <SectionCard icon="star-four-points" title={`Tier de ${ROLE_LABEL[activeRole]}`}>
          <Text nativeID="tier-upgrade-screen-description" testID="tier-upgrade-screen-description" className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Estás en el tier <Text nativeID="tier-upgrade-screen-tier-label" testID="tier-upgrade-screen-tier-label" className="font-semibold">{tierLabel}</Text>. El tier Premium va a desbloquear
            más funcionalidades para tu perfil de {ROLE_LABEL[activeRole].toLowerCase()} — disponible próximamente.
          </Text>

          <View nativeID="tier-upgrade-screen-coming-soon" testID="tier-upgrade-screen-coming-soon" className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={18} />
            <Text nativeID="tier-upgrade-screen-coming-soon-label" testID="tier-upgrade-screen-coming-soon-label" className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Próximamente
            </Text>
          </View>
        </SectionCard>
      </View>
    </ScrollView>
  );
}
