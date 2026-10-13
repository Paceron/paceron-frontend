import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/auth-store.js';
import { getAchievementsCatalog, getUserAchievements } from '../services/achievements.js';
import { toAchievementCatalogItemModel, toUserAchievementModel } from '../services/normalizers.js';
import { computeLevelProgress } from '../utils/achievement-progress.js';
import { buildAchievementUnlockMessage } from '../utils/achievement-unlock-message.js';
import { notifySuccess } from '../utils/haptics.js';

function joinAchievements(catalog, progressList) {
  const progressById = new Map(progressList.map((p) => [p.achievementId, p]));
  return catalog.map((item) => {
    const progress = progressById.get(item.id) ?? null;
    const levelProgress = computeLevelProgress(item, progress);
    const currentLevel = progress?.currentLevel ?? 0;
    const currentLevelDef = currentLevel ? item.levels?.find((l) => l.level === currentLevel) : null;

    return {
      id: item.id,
      family: item.family,
      name: item.name,
      description: item.description,
      iconKey: item.iconKey,
      count: progress?.count ?? null,
      currentLevel,
      levelName: currentLevelDef?.name ?? null,
      nextLevelName: levelProgress?.nextLevelName ?? null,
      progressPercent: levelProgress?.percent ?? null,
      unlockedAt: progress?.unlockedAt ?? null,
      lastUnlockedAt: progress?.lastUnlockedAt ?? null,
      hasUnseen: Boolean(progress?.hasUnseen),
    };
  });
}

// Logros del usuario (Gap 31) -- une catálogo (estático, cacheado
// indefinidamente) con progreso real (por usuario, TanStack Query normal)
// en una sola lista lista para renderizar. Mismo patrón de toast de
// desbloqueo que hooks/use-streaks.js de Spec 1: useRef con el snapshot
// anterior, useEffect comparando, delega el armado del mensaje a una
// función pura.
export function useAchievements() {
  const userId = useAuthStore((s) => s.userId);

  const catalogQuery = useQuery({
    queryKey: ['achievements-catalog'],
    queryFn: () => getAchievementsCatalog().then((dtos) => dtos.map(toAchievementCatalogItemModel)),
    staleTime: Infinity,
  });

  const progressQuery = useQuery({
    queryKey: ['achievements', userId],
    queryFn: () => getUserAchievements(userId).then((dtos) => dtos.map(toUserAchievementModel)),
    enabled: Boolean(userId),
  });

  const achievements = useMemo(() => {
    if (!catalogQuery.data || !progressQuery.data) return [];
    return joinAchievements(catalogQuery.data, progressQuery.data);
  }, [catalogQuery.data, progressQuery.data]);

  const previousAchievements = useRef(null);

  useEffect(() => {
    if (!achievements.length) return;
    const message = buildAchievementUnlockMessage(previousAchievements.current, achievements);
    if (message) {
      notifySuccess();
      Toast.show({ type: 'success', ...message });
    }
    previousAchievements.current = achievements;
  }, [achievements]);

  return {
    achievements,
    hasUnseen: achievements.some((a) => a.hasUnseen),
    loading: catalogQuery.isLoading || progressQuery.isLoading,
    error: catalogQuery.error ?? progressQuery.error ?? null,
  };
}
