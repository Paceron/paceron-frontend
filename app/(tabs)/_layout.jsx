import { Slot, usePathname } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppWebShell } from '../../components/shell/app-web-shell.jsx';
import { AppWebShellNarrow } from '../../components/shell/app-web-shell-narrow.jsx';
import { AppMobileShell } from '../../components/shell/app-mobile-shell.jsx';
import { AppLoadingScreen } from '../../components/shell/app-loading-screen.jsx';
import { ThemeToggle } from '../../components/theme/theme-toggle.jsx';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';

export default function TabsLayout() {
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const userId = useAuthStore((s) => s.userId);
  const isNarrowWeb = useIsNarrowWeb();

  if (!hydrated) return <AppLoadingScreen />;

  // Landing pública (sin sesión): sin shell de navegación de usuario
  // autenticado — solo el toggle de tema, transparente, arriba de lo que
  // sea que renderice HomeLandingScreen/HomeWebNarrowScreen/
  // HomeMobileScreen (decidido por app/(tabs)/index.jsx / index.web.jsx).
  // El toggle va en un row normal (no `position: absolute`) para que quede
  // debajo del padding-top que agrega el SafeAreaView — absoluto colisionaba
  // con la status bar en mobile nativo (bug real, encontrado en preview de
  // usuario 2026-09-10). Ver
  // docs/superpowers/specs/2026-09-10-landing-without-shell-design.md.
  if (pathname === '/' && !userId) {
    return (
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top']} nativeID="landing-bare-shell" testID="landing-bare-shell">
        <View className="flex-row justify-end px-4 py-2" nativeID="landing-bare-shell-theme-toggle" testID="landing-bare-shell-theme-toggle">
          <ThemeToggle />
        </View>
        <Slot />
      </SafeAreaView>
    );
  }

  if (isWeb) {
    const WebShell = isNarrowWeb ? AppWebShellNarrow : AppWebShell;
    return (
      <WebShell pathname={pathname}>
        <Slot />
      </WebShell>
    );
  }

  return (
    <AppMobileShell pathname={pathname}>
      <Slot />
    </AppMobileShell>
  );
}
