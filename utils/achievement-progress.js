// Progreso al siguiente nivel de un logro `leveled` (Gap 31). Pura y
// testeada a propósito -- hooks/use-achievements.js solo llama a esto por
// cada ítem del catálogo, nada de esta cuenta vive sin test.
export function computeLevelProgress(catalogItem, userAchievement) {
  if (catalogItem.family !== 'leveled') return null;
  if (userAchievement?.count == null) return null;

  const currentLevel = userAchievement.currentLevel ?? 0;
  const nextLevelDef = catalogItem.levels.find((l) => l.level === currentLevel + 1);
  if (!nextLevelDef) return null;

  const currentLevelDef = currentLevel === 0 ? null : catalogItem.levels.find((l) => l.level === currentLevel);
  const previousThreshold = currentLevelDef?.threshold ?? 0;
  const span = nextLevelDef.threshold - previousThreshold;
  const progressInSpan = userAchievement.count - previousThreshold;
  const percent = span > 0 ? Math.min(100, Math.max(0, Math.round((progressInSpan / span) * 100))) : 0;

  return {
    levelName: currentLevelDef?.name ?? null,
    nextLevelName: nextLevelDef.name,
    percent,
  };
}
