import '../nativewind.css';
import '../global.css';

import { useFonts } from 'expo-font';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AppProviders } from '../providers/app-providers.jsx';
import { toastConfig } from '../components/feedback/paceron-toast.jsx';
import { useThemeMode } from '../providers/theme-provider.jsx';
import { RoleSwitchOverlay } from '../components/shell/role-switch-overlay.jsx';

// Fondo del Stack navigator en sí (no del contenido de cada screen). Sin
// esto, el navigator usa su fondo por defecto (claro) durante la animación
// de transición entre pantallas — se ve como un flash/borde blanco en dark
// mode mientras la pantalla entra/sale deslizando.
function StackNavigator() {
  const { colorScheme } = useThemeMode();
  const backgroundColor = colorScheme === 'dark' ? '#0d1013' : '#f8fafc';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Orbitron_700Bold });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AppProviders>
        <StackNavigator />
        <RoleSwitchOverlay />
        <Toast config={toastConfig} topOffset={56} />
      </AppProviders>
    </SafeAreaProvider>
  );
}
