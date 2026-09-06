import { useState, useCallback } from 'react';

// Envuelve cualquier función de refetch (Zustand fetch action o
// `refetch`/`invalidateQueries` de TanStack Query) en el contrato que
// espera `RefreshControl` de React Native: un booleano `refreshing` y un
// callback `onRefresh` sin argumentos. Silencioso ante error — el fetch
// ya dispara su propio Toast de error si falla, este hook no duplica
// feedback.
export function usePullToRefresh(refreshFn) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFn();
    } catch {
      // el propio refreshFn (store action / TanStack) ya maneja su error
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);

  return { refreshing, onRefresh };
}
