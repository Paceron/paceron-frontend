// Estado in-memory con la MISMA shape snake_case que tendría el backend
// real (para que toTrainingPlanModel() funcione igual el día que exista,
// mismo patrón que teams-mock.js) — hoy no hay ningún endpoint de planes
// de entrenamiento (ver docs/BACKEND_API_GAPS.md, gap 4).
//
// Un plan es siempre 7 días fijos, embebidos directo en el objeto del
// plan (no hace falta normalizar en tablas separadas como el schema SQL
// de referencia — eso tenía sentido en Postgres, acá es solo un mock en
// memoria). Un día de tipo "training" referencia una sesión del catálogo
// (session_id, ver sessions-mock.js) en vez de construirla inline —
// enmienda 2026-08-26 de docs/superpowers/specs/2026-08-26-training-plans-design.md.
// session_id 1/2/3 acá abajo son los mismos que siembra sessions-mock.js
// (Fondo suave / Series de velocidad / Rodaje largo).
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function buildSeedPlans() {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      owner_id: 1,
      name: 'Base 5K — nivel inicial',
      description: 'Progresión de 7 días para arrancar a correr 5K sin lesionarse — 3 sesiones de entrenamiento, resto descanso activo.',
      duration_days: 7,
      created_at: now,
      updated_at: now,
      days: [
        { sequence_no: 1, day_of_week: 'monday', kind: 'training', other_name: null, session_id: 1 },
        { sequence_no: 2, day_of_week: 'tuesday', kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 3, day_of_week: 'wednesday', kind: 'training', other_name: null, session_id: 2 },
        { sequence_no: 4, day_of_week: 'thursday', kind: 'other', other_name: 'Elongación y movilidad', session_id: null },
        { sequence_no: 5, day_of_week: 'friday', kind: 'training', other_name: null, session_id: 3 },
        { sequence_no: 6, day_of_week: 'saturday', kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 7, day_of_week: 'sunday', kind: 'rest', other_name: null, session_id: null },
      ],
    },
    {
      id: 2,
      owner_id: 1,
      name: 'Series y velocidad — nivel intermedio',
      description: 'Ciclo de 14 días con foco en velocidad — series y tempo run, con descanso completo entre estímulos fuertes.',
      duration_days: 14,
      created_at: now,
      updated_at: now,
      days: [
        { sequence_no: 1, day_of_week: 'monday', kind: 'training', other_name: null, session_id: 2 },
        { sequence_no: 2, day_of_week: 'tuesday', kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 3, day_of_week: 'wednesday', kind: 'training', other_name: null, session_id: 4 },
        { sequence_no: 4, day_of_week: 'thursday', kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 5, day_of_week: 'friday', kind: 'training', other_name: null, session_id: 5 },
        { sequence_no: 6, day_of_week: 'saturday', kind: 'other', other_name: 'Trote regenerativo suave', session_id: null },
        { sequence_no: 7, day_of_week: 'sunday', kind: 'rest', other_name: null, session_id: null },
      ],
    },
  ];
}

// Asignación individual del corredor demo (user_id 1) al primer plan, y
// marcado como "actual" por default — así el hero de "sesión de hoy" en
// Mis planes se ve poblado desde el primer `npm run web`, sin tener que
// asignar/marcar nada a mano. Ver docs/superpowers/specs/2026-09-03-my-plans-today-session-design.md.
function buildSeedRunnerPlanAssignments() {
  return [{ id: 1, plan_id: 1, user_id: 1, assigned_at: new Date().toISOString() }];
}

function buildSeedCurrentPlanMarks() {
  return [{ id: 1, plan_id: 1, user_id: 1, marked_at: new Date().toISOString() }];
}

let mockPlans = buildSeedPlans();
let mockRunnerPlanAssignments = buildSeedRunnerPlanAssignments();
let mockCurrentPlanMarks = buildSeedCurrentPlanMarks();
let nextId = 3;
let nextAssignmentId = 2;
let nextCurrentMarkId = 2;

function findPlanOrThrow(planId) {
  const plan = mockPlans.find((p) => String(p.id) === String(planId));
  if (!plan) {
    const error = new Error('Plan de entrenamiento no encontrado.');
    error.status = 404;
    throw error;
  }
  return plan;
}

// Valida que los 7 días vengan completos y en orden — nada se manda al
// "backend" sin esto, ni siquiera el mock (mismo espíritu que el
// UNIQUE(plan_id, sequence_no) / UNIQUE(plan_id, day_of_week) del SQL de
// referencia, hecho a mano porque acá no hay motor de base de datos que
// lo valide solo).
export function validatePlanDays(days) {
  if (!Array.isArray(days) || days.length !== 7) {
    throw new Error('Un plan necesita exactamente 7 días.');
  }
  const sequences = days.map((d) => d.sequence_no).sort((a, b) => a - b);
  if (sequences.some((s, i) => s !== i + 1)) {
    throw new Error('Los 7 días tienen que cubrir del 1 al 7 sin repetir.');
  }
  const daysOfWeek = new Set(days.map((d) => d.day_of_week));
  if (daysOfWeek.size !== 7 || DAY_ORDER.some((d) => !daysOfWeek.has(d))) {
    throw new Error('Cada día de la semana tiene que aparecer una sola vez.');
  }
  if (days.some((d) => d.kind === 'training' && !d.session_id)) {
    throw new Error('Elegí una sesión para cada día de entrenamiento.');
  }
  if (days.some((d) => d.kind === 'other' && !d.other_name)) {
    throw new Error('Ingresá el nombre de la actividad en los días de "otra actividad".');
  }
}

export async function mockListTrainingPlans({ ownerId } = {}) {
  let result = mockPlans;
  if (ownerId != null) result = result.filter((p) => p.owner_id === Number(ownerId));
  return [...result];
}

export async function mockGetTrainingPlan(planId) {
  return findPlanOrThrow(planId);
}

export async function mockCreateTrainingPlan(payload) {
  validatePlanDays(payload.days);
  const now = new Date().toISOString();
  const plan = {
    id: nextId++,
    owner_id: payload.owner_id,
    name: payload.name,
    description: payload.description ?? null,
    duration_days: payload.duration_days,
    days: payload.days,
    created_at: now,
    updated_at: now,
  };
  mockPlans.push(plan);
  return plan;
}

export async function mockUpdateTrainingPlan(planId, updates) {
  const plan = findPlanOrThrow(planId);
  if (updates.days) validatePlanDays(updates.days);
  Object.assign(plan, updates, { updated_at: new Date().toISOString() });
  return plan;
}

export async function mockDeleteTrainingPlan(planId) {
  mockPlans = mockPlans.filter((p) => String(p.id) !== String(planId));
  mockRunnerPlanAssignments = mockRunnerPlanAssignments.filter((a) => String(a.plan_id) !== String(planId));
  mockCurrentPlanMarks = mockCurrentPlanMarks.filter((m) => String(m.plan_id) !== String(planId));
  return null;
}

// Copia profunda de los 7 días — nombre con sufijo "(copia)" para que se
// distinga de entrada en la lista, editable después como cualquier otro.
// Nace sin ninguna asignación (ni de grupo — eso lo resuelve
// training-plan-store.js del lado de team-store — ni individual, la
// lista de abajo arranca vacía para el nuevo id).
export async function mockCloneTrainingPlan(planId) {
  const original = findPlanOrThrow(planId);
  const now = new Date().toISOString();
  const clone = {
    ...original,
    id: nextId++,
    name: `${original.name} (copia)`,
    days: JSON.parse(JSON.stringify(original.days)),
    created_at: now,
    updated_at: now,
  };
  mockPlans.push(clone);
  return clone;
}

export async function mockListRunnerPlanAssignments({ userId, planId } = {}) {
  let result = mockRunnerPlanAssignments;
  if (userId != null) result = result.filter((a) => a.user_id === Number(userId));
  if (planId != null) result = result.filter((a) => String(a.plan_id) === String(planId));
  return [...result];
}

// Un corredor tiene una sola asignación individual activa a la vez —
// asignar reemplaza la anterior (mismo criterio que group.trainingPlanId
// del lado de grupo). findPlanOrThrow valida que el plan exista antes de
// asignarlo.
export async function mockAssignPlanToRunner(planId, userId) {
  findPlanOrThrow(planId);
  mockRunnerPlanAssignments = mockRunnerPlanAssignments.filter((a) => a.user_id !== Number(userId));
  const assignment = { id: nextAssignmentId++, plan_id: Number(planId), user_id: Number(userId), assigned_at: new Date().toISOString() };
  mockRunnerPlanAssignments.push(assignment);
  return assignment;
}

export async function mockUnassignPlanFromRunner(userId) {
  mockRunnerPlanAssignments = mockRunnerPlanAssignments.filter((a) => a.user_id !== Number(userId));
  return null;
}

// "Plan actual" — preferencia del corredor sobre cuáles de sus planes ya
// asignados destacar arriba de todo en "Mis planes" (hero de sesión de
// hoy), no una asignación nueva. Tope de 2 por corredor, se hace cumplir
// acá (no solo deshabilitando el botón del lado de la UI) — mismo
// criterio defensivo que validatePlanDays. Ver
// docs/superpowers/specs/2026-09-03-my-plans-today-session-design.md.
export async function mockListCurrentPlanMarks({ userId } = {}) {
  let result = mockCurrentPlanMarks;
  if (userId != null) result = result.filter((m) => m.user_id === Number(userId));
  return [...result];
}

export async function mockMarkPlanAsCurrent(userId, planId) {
  findPlanOrThrow(planId);
  const existing = mockCurrentPlanMarks.filter((m) => m.user_id === Number(userId));
  if (existing.some((m) => String(m.plan_id) === String(planId))) {
    return existing.find((m) => String(m.plan_id) === String(planId));
  }
  if (existing.length >= 2) {
    const error = new Error('Ya tenés 2 planes marcados como actuales — desmarcá uno primero.');
    error.status = 422;
    throw error;
  }
  const mark = { id: nextCurrentMarkId++, plan_id: Number(planId), user_id: Number(userId), marked_at: new Date().toISOString() };
  mockCurrentPlanMarks.push(mark);
  return mark;
}

export async function mockUnmarkPlanAsCurrent(userId, planId) {
  mockCurrentPlanMarks = mockCurrentPlanMarks.filter((m) => !(m.user_id === Number(userId) && String(m.plan_id) === String(planId)));
  return null;
}

export function __resetMockTrainingPlans() {
  mockPlans = buildSeedPlans();
  mockRunnerPlanAssignments = buildSeedRunnerPlanAssignments();
  mockCurrentPlanMarks = buildSeedCurrentPlanMarks();
  nextId = 3;
  nextAssignmentId = 2;
  nextCurrentMarkId = 2;
}
