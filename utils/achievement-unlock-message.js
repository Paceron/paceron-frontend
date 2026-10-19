// Detecta el primer logro que cambió de estado entre dos snapshots (subida
// de nivel, o desbloqueo por primera vez de un `once`) y arma el mensaje
// del toast. Un incremento de `counter` NO dispara toast a propósito --
// cada ocurrencia ya se refleja como una estampa nueva en la vitrina, no
// amerita un aviso por cada una (fuera de alcance de esta spec).
export function buildAchievementUnlockMessage(previousList, nextList) {
  if (!previousList) return null;

  for (const next of nextList) {
    const prev = previousList.find((p) => p.id === next.id);
    const unlockedNow = !prev?.unlockedAt && next.unlockedAt;
    const leveledUp = next.levelName && (prev?.levelName ?? null) !== next.levelName;

    if (unlockedNow || leveledUp) {
      return {
        text1: next.levelName ? `¡${next.levelName}!` : '¡Logro desbloqueado!',
        text2: next.name,
      };
    }
  }

  return null;
}
