import { Slot, usePathname } from 'expo-router';
import { AppWebShell } from '../../components/shell/app-web-shell.jsx';
import { AppMobileShell } from '../../components/shell/app-mobile-shell.jsx';
import { isWeb } from '../../utils/platform.js';

export default function TabsLayout() {
  const pathname = usePathname();

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
