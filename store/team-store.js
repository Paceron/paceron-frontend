import { create } from 'zustand';

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

// Sin dominio de planes de entrenamiento todavia — antes había un catálogo
// mock fijo acá (4 planes inventados), se sacó por decisión explícita del
// usuario (2026-08-02): el selector de plan sigue en la UI (no se elimina
// el campo) pero sin opciones fantasma hasta que exista un backend real de
// planes (bloqueado además por el módulo de cobros/suscripciones, en
// desarrollo en paralelo por otro miembro del equipo — ver
// docs/BACKEND_API_GAPS.md gap 4).
export const TRAINING_PLAN_OPTIONS = [];

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

// Único estado que queda acá: la asignación local de plan de entrenamiento
// a un grupo. 100% local, el backend real no tiene este campo todavía (ver
// docs/BACKEND_API_GAPS.md gap 4) — no encaja en TanStack Query porque no
// hay ningún fetcher real detrás, sería fingir una mutation sin endpoint.
// El resto de este store (equipos/grupos/invitaciones reales) migró a
// TanStack Query el 2026-09-09 — ver la spec arriba.
export const useTeamStore = create((set) => ({
  setGroupTrainingPlan: (teamId, groupId, planId) => {
    // Sin consumidor real todavía tras esta migración (team.groups ya no
    // vive en este store) — queda reservado para cuando gap 4 tenga un
    // campo real que sincronizar. No borrar sin antes confirmar que sigue
    // sin uso.
  },
}));
