export function isAchievementUnlocked(achievement) {
  if (!achievement) return false;
  if (achievement.unlockedAt != null) return true;
  if ((achievement.currentLevel ?? 0) > 0) return true;
  const count = achievement.count ?? 0;
  if (achievement.family === 'counter') return count > 0;
  if (achievement.family === 'once' && achievement.threshold != null) return count >= achievement.threshold;
  return false;
}
