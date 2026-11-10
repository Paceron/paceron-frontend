// El logro con más progreso pendiente (más cerca de subir de nivel), o si
// ninguno tiene progreso fraccional, el desbloqueado más recientemente.
// Extraído de achievement-highlight-card.jsx (2026-11-09) para que
// authenticated-home-screen.jsx pueda saber, ANTES de montar la card, si va
// a haber algo que mostrar -- decide si Rachas se empareja con Logros o
// si ocupa el ancho completo.
export function pickAchievementHighlight(achievements) {
  const withProgress = achievements.filter((a) => a.progressPercent != null && a.progressPercent < 100);
  if (withProgress.length) {
    return withProgress.reduce((best, a) => (a.progressPercent > best.progressPercent ? a : best));
  }

  const unlocked = achievements.filter((a) => a.unlockedAt);
  if (!unlocked.length) return null;
  return unlocked.reduce((latest, a) => ((a.lastUnlockedAt ?? '') > (latest.lastUnlockedAt ?? '') ? a : latest));
}
