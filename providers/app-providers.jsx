import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
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

// TanStack Query usa `window`/`document` para detectar foco y reconexión
// por default -- eso funciona solo, sin configurar nada, en web (RN Web
// mapea AppState a la Page Visibility API), pero en nativo React Native
// nunca dispara esos eventos del browser, así que `refetchOnWindowFocus`
// nunca se activaba ahí (gap conocido de TanStack Query + RN, no
// documentado por el equipo hasta ahora). Esto era la causa real de la
// caché desactualizada después de un `make demo-restore`: el caché de
// cualquier screen que no fuera la que estaba montada en ese momento
// seguía mostrando datos pre-restore hasta un reload manual (tecla `r`
// en Metro) o reinstalar -- bug real reportado, 2026-10-08. Invalidar
// TODO el caché (no solo refetchear lo stale) al volver a foreground,
// como pide la nota operativa del backend sobre demo-restore -- un
// restore puede pasar en los pocos segundos que la app estuvo en
// background, antes de que el staleTime (60s) de cualquier query lo
// marque como vencido por sí solo.
function ForegroundRefetch() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') queryClient.invalidateQueries();
    });
    return () => subscription.remove();
  }, []);

  return null;
}

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthEffects />
        <ForegroundRefetch />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
