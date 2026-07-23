import { Slot, usePathname } from 'expo-router';
import { AppWebShell } from '../../components/shell/app-web-shell.jsx';
import { AppWebShellNarrow } from '../../components/shell/app-web-shell-narrow.jsx';
import { AppMobileShell } from '../../components/shell/app-mobile-shell.jsx';
import { AppLoadingScreen } from '../../components/shell/app-loading-screen.jsx';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';

export default function TabsLayout() {
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isNarrowWeb = useIsNarrowWeb();

  if (!hydrated) return <AppLoadingScreen />;

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
