import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ThemeProvider, seedDefaultTheme } from './theme-provider.jsx';
import { useAuthStore } from '../store/auth-store.js';
import { queryClient } from '../lib/query-client.js';
import { useUser, useRoleReconciliation } from '../hooks/use-user.js';

function AuthEffects() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const userId = useAuthStore((state) => state.userId);
  const { user } = useUser(userId);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // seedDefaultTheme necesita el perfil completo (user.defaultTheme) —
  // antes vivía dentro de auth-store.js#hydrate, que ya no tiene acceso a
  // user (perfil, ahora en Query). Corre un frame más tarde que antes
  // (espera a que useUser resuelva), sin impacto visible.
  useEffect(() => {
    if (user?.defaultTheme) seedDefaultTheme(user.defaultTheme);
  }, [user?.defaultTheme]);

  useRoleReconciliation();

  return null;
}

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthEffects />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
