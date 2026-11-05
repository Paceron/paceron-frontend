// Filtrado 100% client-side (Gap de backend confirmado innecesario -- ver
// docs/superpowers/specs/2026-11-03-competitions-widget-depth-design.md,
// sección Alcance) sobre el modelo ya normalizado (services/normalizers.js
// #toCompetitionModel). `from`/`to` comparan contra `startAt` -- no hace
// falta mirar `endAt`: lo que el usuario busca al poner un rango es "qué
// arrancó en esa ventana", no si sigue abierta hoy.
export function filterCompetitionsByFields(competitions, { teamId, type, from, to } = {}) {
  return competitions.filter((c) => {
    if (teamId && String(c.teamId) !== String(teamId)) return false;
    if (type && c.type !== type) return false;
    const startMs = new Date(c.startAt).getTime();
    if (from && startMs < new Date(from).getTime()) return false;
    if (to && startMs > new Date(to).getTime()) return false;
    return true;
  });
}

// Activas = todavía no cerrada (incluye lo que espera aprobación). Historial =
// cerrada, en cualquier desenlace. Sin una 3ra categoría a propósito (pedido
// real: no tiene sentido ver "pendientes" sueltas en esta vista cross-equipo).
export function splitByLifecycle(competitions) {
  const active = competitions.filter((c) => c.status === 'active' || c.status === 'pending_approval');
  const history = competitions.filter((c) => c.status === 'finished' || c.status === 'rejected');
  return { active, history };
}
