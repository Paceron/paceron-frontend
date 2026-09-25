import { ScrollView, Text, View } from 'react-native';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { isWeb } from '../../utils/platform.js';
import { NextTrainingBanner } from './next-training-banner.jsx';

export function AuthenticatedHomeScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const firstName = user?.name || '';

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="authenticated-home-screen-root"
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
