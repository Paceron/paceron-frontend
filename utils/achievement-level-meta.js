// Identidad visual de los 5 niveles de logro (Gap 31, doc fuente de
// gamificación 2026-10-12) -- mismo patrón que EXERCISE_KIND_META
// (components/plans/exercise-kind-meta.js): cada nivel tiene su propio
// ícono/color. El NOMBRE visible de un nivel siempre sale de
// `levels[].name` del catálogo (ver utils/achievement-progress.js) --
// este objeto solo mapea número de nivel a apariencia, nunca a texto.
export const ACHIEVEMENT_LEVEL_META = {
  1: { icon: 'circle-outline', color: '#94a3b8' },
  2: { icon: 'fire', color: '#fb923c' },
  3: { icon: 'fire', color: '#ea580c' },
  4: { icon: 'fire', color: '#dc2626' },
  5: { icon: 'fire', color: '#eab308', glow: true },
};

export function levelMeta(level) {
  return ACHIEVEMENT_LEVEL_META[level] ?? ACHIEVEMENT_LEVEL_META[1];
}
