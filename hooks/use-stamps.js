import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { getStamps } from '../services/achievements.js';
import { toStampModel } from '../services/normalizers.js';

// Estampas de logros contador + post-Leyenda conviven en una sub-sección
// (doc fuente: "los trofeos post-Leyenda tienen su propia sub-sección O
// destacado dentro de estampas" -- se elige "dentro de estampas" acá);
// los trofeos de competencia van en la otra.
const COUNTER_TYPES = ['achievement_counter', 'post_legend'];

export function useStamps() {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: ['stamps', userId],
    queryFn: () => getStamps(userId).then((dtos) => dtos.map(toStampModel)),
    enabled: Boolean(userId),
  });

  const stamps = query.data ?? [];

  return {
    counters: stamps.filter((s) => COUNTER_TYPES.includes(s.type)),
    competitions: stamps.filter((s) => s.type === 'competition'),
    loading: query.isLoading,
    error: query.error ?? null,
  };
}
