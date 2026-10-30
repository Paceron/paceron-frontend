import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useThemeColors } from '../../theme/colors.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { NextTrainingBanner } from './next-training-banner.jsx';
import { StreakBanner } from './streak-banner.jsx';
import { AchievementHighlightCard } from './achievement-highlight-card.jsx';
import { RunnerKpisCard } from './runner-kpis-card.jsx';

export function AuthenticatedHomeScreen() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { user } = useUser(userId);
  const firstName = user?.name || '';

  const queryClient = useQueryClient();
  // Invalida calendario/user siempre; streaks/achievements solo tienen
  // sentido si la card de gamificación está montada (ver guard de
  // `activeRole === 'runner'` más abajo) -- invalidar esas queries para un
  // entrenador sería trabajo sin efecto visible, nadie las lee.
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['member-calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['administered-calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['user', userId] }),
    ...(activeRole === 'runner' ? [
      queryClient.invalidateQueries({ queryKey: ['streaks', userId] }),
      queryClient.invalidateQueries({ queryKey: ['achievements', userId] }),
      queryClient.invalidateQueries({ queryKey: ['runner-kpis'] }),
    ] : []),
  ]));

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="authenticated-home-screen-root"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      testID="authenticated-home-screen-root"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="authenticated-home-screen-container" testID="authenticated-home-screen-container">
        <Text
          className="mb-4 text-2xl text-slate-900 dark:text-white"
          nativeID="authenticated-home-screen-greeting"
          style={{ fontFamily: 'Orbitron_700Bold' }}
          testID="authenticated-home-screen-greeting"
        >
          {firstName ? `Hola, ${firstName}` : 'Bienvenido a Paceron'}
        </Text>
        <NextTrainingBanner />
        {/* Gamificación es un módulo pensado para corredores -- oculto
            para entrenador a propósito (pedido real, 2026-10-15),
            reversible: solo este guard de `activeRole`. */}
        {activeRole === 'runner' && (
          <>
            <StreakBanner />
            <AchievementHighlightCard />
            <RunnerKpisCard />
          </>
        )}
      </View>
    </ScrollView>
  );
}
