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
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      showsVerticalScrollIndicator={false}
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <View className="mb-8 flex-row items-center gap-2">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 active:opacity-70"
            onPress={() => router.replace('/profile')}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">Mi perfil</Text>
          </Pressable>
          <Text className="text-sm text-slate-400 dark:text-slate-600">/</Text>
          <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="text-xl text-slate-900 dark:text-white">
            Mejorar tier
          </Text>
        </View>

        <SectionCard icon="star-four-points" title={`Tier de ${ROLE_LABEL[activeRole]}`}>
          <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Estás en el tier <Text className="font-semibold">{tierLabel}</Text>. El tier Premium va a desbloquear
            más funcionalidades para tu perfil de {ROLE_LABEL[activeRole].toLowerCase()} — disponible próximamente.
          </Text>

          <View className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={18} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Próximamente
            </Text>
          </View>
        </SectionCard>
      </View>
    </ScrollView>
  );
}
