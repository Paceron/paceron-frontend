import '../nativewind.css';
import '../global.css';

import { useFonts } from 'expo-font';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AppProviders } from '../providers/app-providers.jsx';
import { toastConfig } from '../components/feedback/paceron-toast.jsx';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Orbitron_700Bold });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AppProviders>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
        <Toast config={toastConfig} topOffset={56} />
      </AppProviders>
    </SafeAreaProvider>
  );
}
