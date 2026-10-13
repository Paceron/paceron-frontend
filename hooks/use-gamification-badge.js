import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { useStreaks } from './use-streaks.js';
import { useAchievements } from './use-achievements.js';
import { ackGamificationSeen } from '../services/gamification.js';

// Punto rojo compartido del header/sidebar/home (Gap 34). Por ahora el
// input es el OR de rachas + logros -- Spec 4 (competencias) suma su
// propio término acá cuando exista, sin tocar la firma pública de este
// hook (los 3 shells y el hub ya lo consumen tal cual).
export function useGamificationBadge() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { streaks } = useStreaks();
  const { hasUnseen: achievementsHasUnseen } = useAchievements();

  const hasUnseen = Boolean(streaks?.hasUnseen) || achievementsHasUnseen;

  const ackSection = async (section) => {
    if (!userId) return;
    await ackGamificationSeen(userId, section);
    queryClient.invalidateQueries({ queryKey: ['streaks', userId] });
    queryClient.invalidateQueries({ queryKey: ['achievements', userId] });
  };

  return { hasUnseen, ackSection };
}
