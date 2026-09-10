import { QueryClient } from '@tanstack/react-query';

// Instancia única, importable fuera de React — la única excepción al
// patrón "quien tiene el queryClient decide" del resto de esta migración
// (ver docs/superpowers/specs/2026-09-09-auth-store-tanstack-query-migration-design.md).
// Necesaria porque store/auth-store.js#logout() y services/api.js (logout
// forzado por 401 vencido) corren fuera de cualquier componente — no hay
// useQueryClient() disponible ahí.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});
