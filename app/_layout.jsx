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
import { MobileBrowserLandingScreen } from '../components/home/mobile-browser-landing-screen.jsx';
import { isMobileBrowser } from '../utils/platform.js';

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
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Orbitron_700Bold });
  if (!fontsLoaded) return null;

  // La web todavía no es 100% responsive — mientras tanto, cortamos el
  // acceso desde cualquier browser en OS mobile (Android/iOS), sin
  // excepción de ruta, y mostramos esta landing en su lugar. Va antes
  // del Stack a propósito: /login y /register son Stack.Screen hermanos
  // de (tabs), no hijos — un gate solo en (tabs)/_layout.jsx no los
  // cubriría.
  if (isMobileBrowser()) return <MobileBrowserLandingScreen />;

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
