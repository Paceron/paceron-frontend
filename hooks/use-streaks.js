import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/auth-store.js';
import { getStreaks } from '../services/streaks.js';
import { toStreaksModel } from '../services/normalizers.js';
import { buildStreakBrokenMessage } from '../utils/streak-break-message.js';
import { notifyWarning } from '../utils/haptics.js';

// Rachas del corredor (Gap 30) -- estado de servidor, TanStack Query (ver
// CLAUDE.md "Estado de aplicación vs. de servidor"). Una sola query,
// reusada por la card del Home y la pestaña de detalle (ambas piden los
// mismos 90 días; el Home recorta a los últimos 14 client-side, ver
// components/home/streak-banner.jsx). 90 en vez de 30 desde que la grilla
// de la pestaña Rachas pasó a vista semanal navegable (2026-10-15) -- la
// navegación hacia semanas previas necesita más historial que una
// ventana de 30 días; 90 alcanza para ~12 semanas atrás sin pedirle al
// backend un parámetro de rango nuevo (sigue siendo `?days=N`, Gap 30).
// Mismo cache, sin fetch duplicado entre Home y la pestaña.
export function useStreaks() {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: ['streaks', userId],
    queryFn: () => getStreaks(userId, 90).then(toStreaksModel),
    enabled: Boolean(userId),
  });

  const streaks = query.data ?? null;
  const previousCurrent = useRef(null);

  useEffect(() => {
    if (!streaks) return;
    const message = buildStreakBrokenMessage(previousCurrent.current, streaks);
    if (message) {
      notifyWarning();
      Toast.show({ type: 'info', ...message });
    }
    previousCurrent.current = streaks.strict.current;
  }, [streaks]);

  return { streaks, loading: query.isLoading, error: query.error ?? null };
}
