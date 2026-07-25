import { Slot, usePathname } from 'expo-router';
import { AppWebShell } from '../../components/shell/app-web-shell.jsx';
import { AppMobileShell } from '../../components/shell/app-mobile-shell.jsx';
import { AppLoadingScreen } from '../../components/shell/app-loading-screen.jsx';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';

export default function TabsLayout() {
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return <AppLoadingScreen />;

  if (isWeb) {
    return (
      <AppWebShell pathname={pathname}>
        <Slot />
      </AppWebShell>
    );
  }

  return (
    <AppMobileShell pathname={pathname}>
      <Slot />
    </AppMobileShell>
  );
}
