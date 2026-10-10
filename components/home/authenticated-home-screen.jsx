import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useThemeColors } from '../../theme/colors.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { NextTrainingBanner } from './next-training-banner.jsx';

export function AuthenticatedHomeScreen() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const firstName = user?.name || '';

  const queryClient = useQueryClient();
  // Invalida los dos (no solo el del rol activo) -- barato, y evita tener
  // que importar/leer activeRole acá solo para elegir una de las dos.
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['member-calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['administered-calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['user', userId] }),
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
          className="mb-6 text-2xl text-slate-900 dark:text-white"
          nativeID="authenticated-home-screen-greeting"
          style={{ fontFamily: 'Orbitron_700Bold' }}
          testID="authenticated-home-screen-greeting"
        >
          {firstName ? `Hola, ${firstName}` : 'Bienvenido a Paceron'}
        </Text>
        <NextTrainingBanner />
      </View>
    </ScrollView>
  );
}
