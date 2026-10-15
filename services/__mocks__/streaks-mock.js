// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true -- sin backend real todavía
// (Gap 30). `current`/`days` tienen que ser CONSISTENTES entre sí (bug real
// reportado 2026-10-14: el mock devolvía `strict.current: 6` pero la grilla
// se armaba con un patrón decorativo independiente que no dejaba ver 6 días
// verdes seguidos) -- acá los últimos `current` días antes de hoy son
// 'completed' a propósito, con el día que rompió la racha anterior justo
// antes de esa racha para poder ver el estado 'failed' en la grilla sin
// tener que forzar nada.
//
// `FORCE_STREAK_BROKEN` (abajo) es el toggle manual para probar el toast de
// "Racha reiniciada" (hooks/use-streaks.js) sin backend: cambiarlo a `true`,
// guardar (dispara Fast Refresh, no un restart completo -- el ref de
// `previousCurrent` del hook sigue vivo) y volver a pedir la query (pull to
// refresh en Home, o la pestaña Rachas/Logros del hub) -- la primera carga
// ya dejó `previousCurrent > 0`, así que la siguiente con el flag en `true`
// dispara el toast.
const FORCE_STREAK_BROKEN = false;

const CURRENT_STREAK = FORCE_STREAK_BROKEN ? 0 : 6;
const BEST_STREAK = 14;

// Mutable para poder apagar `has_unseen` desde `mockAckStreaks` -- mismo bug
// y mismo fix que `achievements-mock.js#mockAckAchievements` (2026-10-14):
// el punto rojo nunca se apagaba en modo mock, `ackGamificationSeen` no
// tenía ningún estado al que avisarle.
let hasUnseen = true;

export function mockAckStreaks() {
  hasUnseen = false;
}

function buildMockDays(days) {
  const today = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);

    let status;
    if (i === 0) {
      status = 'pending'; // hoy, todavía sin resolver
    } else if (i <= CURRENT_STREAK) {
      status = 'completed'; // los `current` días de la racha vigente
    } else if (i === CURRENT_STREAK + 1) {
      status = 'failed'; // el día que rompió la racha anterior
    } else {
      // textura decorativa para el resto de la grilla -- recorre los 4
      // estados posibles sin pretender reconstruir una racha real ahí.
      const decorativePattern = ['completed', 'completed', 'failed', 'completed', 'skipped', 'completed', 'completed'];
      status = decorativePattern[i % decorativePattern.length];
    }

    result.push({
      date: iso,
      strict_status: status,
      flexible_status: status === 'failed' ? 'completed' : status,
    });
  }
  return result;
}

export async function mockGetStreaks(days = 30) {
  return {
    strict: { current: CURRENT_STREAK, best: BEST_STREAK },
    flexible: { current: 9, best: 20 },
    days: buildMockDays(days),
    has_unseen: hasUnseen,
  };
}
