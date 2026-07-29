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

// Sin dominio de suscripciones/cobros todavia (ver FUNCTIONAL_PROPOSE.md,
// "Sistema de suscripciones y cobros" sigue siendo un modulo reservado) —
// mismos tres estados que ya prevé esa seccion funcional.
export const SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba'];

// Sin dominio de planes de entrenamiento todavia (ver FUNCTIONAL_PROPOSE.md,
// "Planificacion de entrenamientos" sigue siendo un modulo reservado, no
// implementado) — catalogo mock compartido por el wizard de creacion y la
// pantalla de detalle (pestaña Grupos), hasta que exista ese servicio real.
export const TRAINING_PLAN_OPTIONS = [
  { id: 'plan-5k', name: 'Plan 5K' },
  { id: 'plan-10k', name: 'Plan 10K' },
  { id: 'plan-21k', name: 'Plan 21K (medio maratón)' },
  { id: 'plan-42k', name: 'Plan 42K (maratón)' },
];

const RUNNER_FIRST_NAMES = ['Lucía', 'Martín', 'Sofía', 'Nicolás', 'Valentina', 'Tomás', 'Camila', 'Agustín', 'Julieta', 'Franco'];
const RUNNER_LAST_NAMES = ['Fernández', 'Gómez', 'Rodríguez', 'López', 'Díaz', 'Martínez', 'Pérez', 'Sánchez', 'Romero', 'Torres'];
const MOCK_ROSTER_SIZE = 6;
const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
const DAY_MS = 24 * 60 * 60 * 1000;

// Reemplazo manual de tildes (en vez de String.prototype.normalize) para no
// depender de soporte Unicode completo del motor JS en todas las
// plataformas — la lista de nombres/apellidos de arriba es fija y chica.
function slugifyForEmail(value) {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => ACCENTS[ch] ?? ch)
    .join('')
    .replace(/[^a-z]+/g, '');
}

// Sin backend de equipos ni de miembros todavia — genera un roster de
// ejemplo determinista (mismo teamId + grupos siempre dan el mismo
// resultado) repartido entre los grupos existentes, para que la pantalla
// de detalle de equipo tenga datos con los que probarse de entrada.
// joinedAt se escalona por integrante (30 dias de diferencia entre uno y
// el siguiente) para que la antiguedad ("hace X meses en el equipo") no
// sea igual para todos.
function generateMockMembers(teamId, groups) {
  return Array.from({ length: MOCK_ROSTER_SIZE }, (_, i) => {
    const firstName = RUNNER_FIRST_NAMES[i % RUNNER_FIRST_NAMES.length];
    const lastName = RUNNER_LAST_NAMES[(i * 3) % RUNNER_LAST_NAMES.length];
    return {
      id: `${teamId}-runner-${i}`,
      name: `${firstName} ${lastName}`,
      email: `${slugifyForEmail(firstName)}.${slugifyForEmail(lastName)}@mail.com`,
      subscriptionStatus: SUBSCRIPTION_STATUSES[i % SUBSCRIPTION_STATUSES.length],
      groupId: groups[i % groups.length].id,
      joinedAt: new Date(Date.now() - (i + 1) * 30 * DAY_MS).toISOString(),
    };
  });
}

function buildDefaultGroup(teamId) {
  return { id: `${teamId}-group-default`, name: DEFAULT_GROUP_NAME, description: null, trainingPlanId: null, isDefault: true };
}

// Sin un directorio real de usuarios registrados todavia (no hay backend de
// equipos ni de invitaciones) — mock determinista derivado del email mismo
// (mismo email siempre resuelve igual) para poder mostrar "usuario
// registrado" vs. "sin registrar" en la pantalla de invitaciones sin
// inventar una lista global de usuarios aparte.
function isRegisteredMockEmail(email) {
  let sum = 0;
  for (let i = 0; i < email.length; i += 1) sum += email.charCodeAt(i);
  return sum % 2 === 0;
}

// Arma una invitacion completa a partir de { email, groupId } (lo que sale
// de EmailListField): resuelve el grupo default si no se eligio ninguno, y
// completa invitedAt/registered — el momento real en que se armo la
// invitacion, no un mock, mas el estado de registrado (mock, ver arriba).
function buildInvitedEmail(invite, defaultGroupId) {
  return {
    email: invite.email,
    groupId: invite.groupId || defaultGroupId,
    invitedAt: new Date().toISOString(),
    registered: isRegisteredMockEmail(invite.email),
  };
}

// Equipos mock con datos completos (grupos, roster, ubicacion real de
// data/locations.js) para poder probar la pantalla de detalle de equipo
// sin pasar primero por el wizard de creacion. pendingInvites (opcional)
// siembra invitaciones pendientes con antiguedad variada (daysAgo) para
// poder probar la pantalla de invitaciones sin tener que cargarlas a mano.
function buildMockTeam({ id, name, country, province, city, level, description, requirements, pendingInvites = [], showGroupsToRunners = false }) {
  const defaultGroup = buildDefaultGroup(id);
  const advancedGroup = {
    id: `${id}-group-avanzado`,
    name: 'Avanzado',
    description: 'Corredores con mayor volumen y ritmo, orientado a carreras de calle de 10K y 21K.',
    trainingPlanId: 'plan-21k',
    isDefault: false,
  };
  const groups = [advancedGroup, defaultGroup];

  const invitedEmails = pendingInvites.map(({ email, group, daysAgo, registered }) => ({
    email,
    groupId: group === 'avanzado' ? advancedGroup.id : defaultGroup.id,
    invitedAt: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
    registered,
  }));

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
    // Por default un corredor común no ve a qué grupo pertenece cada
    // compañero — el entrenador lo habilita explícitamente desde "Editar
    // equipo" (ver store.updateTeam). Controla solo el tag de grupo por
    // corredor; la pestaña Grupos entera sigue oculta para corredores
    // pase lo que pase (ver team-detail-screen.jsx).
    showGroupsToRunners,
    groups,
    members: generateMockMembers(id, groups),
    invitedEmails,
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
    pendingInvites: [
      { email: 'nueva.socia@example.com', group: 'avanzado', daysAgo: 3, registered: false },
      { email: 'martina.reyes@mail.com', group: 'default', daysAgo: 20, registered: true },
    ],
    showGroupsToRunners: true,
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

    const invitedEmails = (payload.invitedEmails ?? []).map((invite) => buildInvitedEmail(invite, defaultGroup.id));

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
      // No expuesto en el wizard de creación (se pidió específicamente en
      // "Editar equipo", ver EditTeamScreen) — arranca apagado, como el
      // resto de los equipos mock salvo team-1.
      showGroupsToRunners: false,
      groups,
      members: generateMockMembers(id, groups),
      invitedEmails,
    };
    set((state) => ({ teams: [...state.teams, team], selectedTeamId: team.id }));
    return team;
  },

  // Edita solo los "datos generales" de un equipo ya existente (nombre,
  // ubicación, descripción, nivel, cupo, foto, requisitos) — grupos,
  // miembros, invitaciones y status no se tocan desde acá, tienen sus
  // propios flujos (ver updateGroup y la pestaña Grupos).
  updateTeam: (teamId, updates) => {
    set((state) => ({
      teams: state.teams.map((team) => (team.id === teamId ? { ...team, ...updates } : team)),
    }));
  },

  // Edita nombre/plan de un grupo puntual dentro de un equipo. No toca
  // membresía (mover corredores de grupo es otro flujo, todavía no
  // implementado — ver spec de la pantalla de detalle de equipo).
  updateGroup: (teamId, groupId, updates) => {
    set((state) => ({
      teams: state.teams.map((team) => {
        if (team.id !== teamId) return team;
        return { ...team, groups: team.groups.map((group) => (group.id === groupId ? { ...group, ...updates } : group)) };
      }),
    }));
  },

  // Suma invitaciones nuevas a un equipo ya existente (pantalla "Invitar
  // corredores" dentro de la gestión de equipo, no el wizard de creación).
  // Solo agrega — no reemplaza ni permite cancelar invitaciones ya
  // mandadas (eso no se pidió todavía). Ignora emails que ya estaban
  // invitados, sin distinguir mayúsculas/minúsculas.
  addInvitedEmails: (teamId, invites) => {
    set((state) => ({
      teams: state.teams.map((team) => {
        if (team.id !== teamId) return team;
        const defaultGroup = team.groups.find((g) => g.isDefault);
        const existingEmails = new Set(team.invitedEmails.map((inv) => inv.email.toLowerCase()));
        const newOnes = invites
          .filter((invite) => !existingEmails.has(invite.email.toLowerCase()))
          .map((invite) => buildInvitedEmail(invite, defaultGroup?.id ?? ''));
        return { ...team, invitedEmails: [...team.invitedEmails, ...newOnes] };
      }),
    }));
  },
}));
