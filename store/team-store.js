// Tope de integrantes por tier del entrenador. 'base' es el plan free.
// 'pro'/'premium' hoy no los asigna ningun mock todavia (roles-mock.js
// siempre devuelve 'base'), pero el tope ya queda resuelto para cuando el
// sistema de tiers crezca mas alla de solo base/premium.
export const TEAM_MEMBER_LIMITS = {
  base: 10,
  pro: 50,
  premium: 300,
};

export function getTeamMemberLimit(tier) {
  return TEAM_MEMBER_LIMITS[tier] ?? TEAM_MEMBER_LIMITS.base;
}

// Sin dominio de suscripciones/cobros todavia (ver FUNCTIONAL_PROPOSE.md,
// "Sistema de suscripciones y cobros" sigue siendo un modulo reservado) —
// mismos tres estados que ya prevé esa seccion funcional.
export const SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba'];

// Equipos que el usuario administra (owner_id === userId) — el backend no
// tiene todavia un endpoint "mis equipos" (docs/BACKEND_API_GAPS.md), asi
// que se resuelve del lado del cliente filtrando GET /teams completo (hoy
// vía hooks/use-teams.js#useTeams, migrado de Zustand a TanStack Query el
// 2026-09-09 — ver docs/superpowers/specs/2026-09-09-team-store-tanstack-query-migration-design.md).
// No incluye equipos donde el usuario participa como corredor (ver
// hooks/use-teams.js#useMyMemberTeams para ese caso).
export function selectAdministeredTeams(teams, userId) {
  if (!userId) return [];
  return teams.filter((team) => team.ownerId === userId);
}
