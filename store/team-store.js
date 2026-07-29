import { create } from 'zustand';

// Sin backend de equipos todavia (ver docs/BACKEND_DEFINITIONS.md) — mock
// en memoria, mismo criterio que roles/activeRole en auth-store hasta que
// exista el endpoint real.
const MOCK_TEAMS = [
  { id: 'team-1', name: 'Corredores del Sur', country: 'ARG', province: 'BA', city: 'La Plata' },
  { id: 'team-2', name: 'Running Cordoba Norte', country: 'ARG', province: 'CD', city: 'Córdoba Capital' },
  { id: 'team-3', name: 'Maraton Runners', country: 'ARG', province: 'SF', city: 'Rosario' },
];

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

// Nombre visible del grupo default de cada equipo. No hay integrante sin
// grupo: todo el que se suma sin elegir uno cae aca. A nivel de datos es
// un grupo mas (con isDefault: true para poder distinguirlo si hiciera
// falta proteger/ocultarlo en una UI de gestion de grupos a futuro), pero
// nunca se le muestra al usuario como "default" — su nombre visible ya es
// literalmente "Sin grupo".
export const DEFAULT_GROUP_NAME = 'Sin grupo';

export const useTeamStore = create((set) => ({
  teams: MOCK_TEAMS,
  selectedTeamId: null,

  selectTeam: (teamId) => set({ selectedTeamId: teamId }),

  // Sin backend de equipos: crea el equipo solo en memoria y lo selecciona.
  // Todo equipo nuevo suma su grupo default ("Sin grupo") ademas de los
  // grupos armados en el formulario — las invitaciones sin grupo elegido
  // (groupId '') se resuelven al id de ese grupo default aca, no antes.
  // El envio de invitaciones por email es responsabilidad del backend
  // (no hay ningun servicio de envio de mails en este repo) — por ahora
  // solo se guardan junto con el resto de los datos del equipo.
  createTeam: (payload) => {
    const defaultGroup = { id: `group-${Date.now()}-default`, name: DEFAULT_GROUP_NAME, trainingPlanId: null, isDefault: true };
    const groups = [...(payload.groups ?? []), defaultGroup];

    const invitedEmails = (payload.invitedEmails ?? []).map((invite) => ({
      email: invite.email,
      groupId: invite.groupId || defaultGroup.id,
    }));

    const team = {
      id: `team-${Date.now()}`,
      name: payload.name,
      country: payload.country || null,
      province: payload.province || null,
      city: payload.city || null,
      maxMembers: payload.maxMembers,
      description: payload.description,
      requirements: payload.requirements,
      photoUri: payload.photoUri ?? null,
      level: payload.level,
      groups,
      invitedEmails,
    };
    set((state) => ({ teams: [...state.teams, team], selectedTeamId: team.id }));
    return team;
  },
}));
