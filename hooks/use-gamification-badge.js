import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { useStreaks } from './use-streaks.js';
import { ackGamificationSeen } from '../services/gamification.js';

// Punto rojo compartido del header/sidebar/home (Gap 34). Por ahora el
// único input es el `hasUnseen` de rachas -- Spec 2 (logros) y Spec 4
// (competencias) suman su propio OR acá cuando existan, sin tocar la firma
// pública de este hook (los 3 shells y el hub ya lo consumen tal cual).
export function useGamificationBadge() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { streaks } = useStreaks();

  const hasUnseen = Boolean(streaks?.hasUnseen);

  const ackSection = async (section) => {
    if (!userId) return;
    await ackGamificationSeen(userId, section);
    queryClient.invalidateQueries({ queryKey: ['streaks', userId] });
  };

  return { hasUnseen, ackSection };
}
