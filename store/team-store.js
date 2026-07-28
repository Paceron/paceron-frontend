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

// Nombre visible del grupo default de cada equipo. No hay integrante sin
// grupo: todo el que se suma sin elegir uno cae aca. A nivel de datos es
// un grupo mas (con isDefault: true para poder distinguirlo si hiciera
// falta proteger/ocultarlo en una UI de gestion de grupos a futuro), pero
// nunca se le muestra al usuario como "default" — su nombre visible ya es
// literalmente "Sin grupo".
export const DEFAULT_GROUP_NAME = 'Sin grupo';

// Nivel de un corredor dentro de un equipo — mismo catalogo que el nivel
// del equipo (components/team/create-team-screen.jsx).
export const RUNNER_LEVELS = ['amateur', 'semi-profesional', 'profesional'];

// Sin dominio de suscripciones/cobros todavia (ver FUNCTIONAL_PROPOSE.md,
// "Sistema de suscripciones y cobros" sigue siendo un modulo reservado) —
// mismos tres estados que ya prevé esa seccion funcional.
export const SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba'];

const RUNNER_FIRST_NAMES = ['Lucía', 'Martín', 'Sofía', 'Nicolás', 'Valentina', 'Tomás', 'Camila', 'Agustín', 'Julieta', 'Franco'];
const RUNNER_LAST_NAMES = ['Fernández', 'Gómez', 'Rodríguez', 'López', 'Díaz', 'Martínez', 'Pérez', 'Sánchez', 'Romero', 'Torres'];
const MOCK_ROSTER_SIZE = 6;

// Sin backend de equipos ni de miembros todavia — genera un roster de
// ejemplo determinista (mismo teamId + grupos siempre dan el mismo
// resultado) repartido entre los grupos existentes, para que la pantalla
// de detalle de equipo tenga datos con los que probarse de entrada.
function generateMockMembers(teamId, groups) {
  return Array.from({ length: MOCK_ROSTER_SIZE }, (_, i) => ({
    id: `${teamId}-runner-${i}`,
    name: `${RUNNER_FIRST_NAMES[i % RUNNER_FIRST_NAMES.length]} ${RUNNER_LAST_NAMES[(i * 3) % RUNNER_LAST_NAMES.length]}`,
    level: RUNNER_LEVELS[i % RUNNER_LEVELS.length],
    subscriptionStatus: SUBSCRIPTION_STATUSES[i % SUBSCRIPTION_STATUSES.length],
    groupId: groups[i % groups.length].id,
  }));
}

function buildDefaultGroup(teamId) {
  return { id: `${teamId}-group-default`, name: DEFAULT_GROUP_NAME, trainingPlanId: null, isDefault: true };
}

// Equipos mock con datos completos (grupos, roster, ubicacion real de
// data/locations.js) para poder probar la pantalla de detalle de equipo
// sin pasar primero por el wizard de creacion.
function buildMockTeam({ id, name, country, province, city, level, description, requirements }) {
  const defaultGroup = buildDefaultGroup(id);
  const advancedGroup = { id: `${id}-group-avanzado`, name: 'Avanzado', trainingPlanId: null, isDefault: false };
  const groups = [advancedGroup, defaultGroup];

  return {
    id,
    name,
    country,
    province,
    city,
    status: 'activo',
    description,
    requirements,
    level,
    maxMembers: 20,
    photoUri: null,
    groups,
    members: generateMockMembers(id, groups),
    invitedEmails: [],
  };
}

const MOCK_TEAMS = [
  buildMockTeam({
    id: 'team-1',
    name: 'Corredores del Sur',
    country: 'ARG',
    province: 'BA',
    city: 'La Plata',
    level: 'amateur',
    description: 'Equipo de running enfocado en fondo y medio fondo, entrenamos 3 veces por semana.',
    requirements: 'Compromiso de asistencia y ritmo base de 6 min/km.',
  }),
  buildMockTeam({
    id: 'team-2',
    name: 'Running Cordoba Norte',
    country: 'ARG',
    province: 'CD',
    city: 'Córdoba Capital',
    level: 'semi-profesional',
    description: 'Grupo competitivo orientado a carreras de calle de 10K y 21K.',
    requirements: 'Experiencia previa en carreras de calle.',
  }),
  buildMockTeam({
    id: 'team-3',
    name: 'Maraton Runners',
    country: 'ARG',
    province: 'SF',
    city: 'Rosario',
    level: 'profesional',
    description: 'Preparación específica para maratón y ultramaratón.',
    requirements: 'Base aeróbica mínima de 60km semanales.',
  }),
];

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
  // solo se guardan junto con el resto de los datos del equipo. El roster
  // de corredores es mock (generateMockMembers) hasta que exista un flujo
  // real de alta de miembros — hoy nadie se suma solo por ser invitado.
  createTeam: (payload) => {
    const id = `team-${Date.now()}`;
    const defaultGroup = buildDefaultGroup(id);
    const groups = [...(payload.groups ?? []), defaultGroup];

    const invitedEmails = (payload.invitedEmails ?? []).map((invite) => ({
      email: invite.email,
      groupId: invite.groupId || defaultGroup.id,
    }));

    const team = {
      id,
      name: payload.name,
      country: payload.country || null,
      province: payload.province || null,
      city: payload.city || null,
      status: 'activo',
      maxMembers: payload.maxMembers,
      description: payload.description,
      requirements: payload.requirements,
      photoUri: payload.photoUri ?? null,
      level: payload.level,
      groups,
      members: generateMockMembers(id, groups),
      invitedEmails,
    };
    set((state) => ({ teams: [...state.teams, team], selectedTeamId: team.id }));
    return team;
  },
}));
