import '../nativewind.css';
import '../global.css';

import { useFonts } from 'expo-font';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { AppProviders } from '../providers/app-providers.jsx';
import { toastConfig } from '../components/feedback/paceron-toast.jsx';
import { useThemeMode } from '../providers/theme-provider.jsx';
import { RoleSwitchOverlay } from '../components/shell/role-switch-overlay.jsx';
import { usePushNotifications } from '../hooks/use-push-notifications.js';
import { ErrorBoundary } from '../components/shared/error-boundary.jsx';

// `strict: false` -- el logger de Reanimated avisaba "Reading/Writing from
// `value` during component render" en cada boot, en pares, confirmado
// 2026-10-16 que NO viene de código propio (auditados todos los
// useSharedValue alcanzables desde el arranque: AppMobileShell/drawer,
// StreakBanner, SkeletonBlock, AnimatedDropdown, RoleSwitchOverlay,
// SectionCard, ThemeToggle -- los 8 escriben `.value` solo en useEffect y
// leen solo dentro de useAnimatedStyle/interpolate, patrón correcto en
// todos). Falso positivo conocido de react-native-screens leyendo su
// propio shared value de progreso de transición en el primer render de
// cada pantalla del Stack nativo, antes de que el hilo de UI esté listo --
// no hay nada de nuestro lado para parchear. Apaga solo el logger
// (diagnóstico dev-only), no cambia comportamiento de animaciones.
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

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
  usePushNotifications();
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <AppProviders>
            <StackNavigator />
            <RoleSwitchOverlay />
            <Toast config={toastConfig} topOffset={56} />
          </AppProviders>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
