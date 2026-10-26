// Estado in-memory con la MISMA shape snake_case que tendría el backend
// real (para que toTrainingPlanModel() funcione igual el día que exista,
// mismo patrón que teams-mock.js) — hoy no hay ningún endpoint de planes
// de entrenamiento (ver docs/BACKEND_API_GAPS.md, gap 4).
//
// Un plan tiene una cantidad variable de días (2-31), embebidos directo
// en el objeto del plan (no hace falta normalizar en tablas separadas
// como el schema SQL de referencia — eso tenía sentido en Postgres, acá
// es solo un mock en memoria). Un día de tipo "training" referencia una sesión del catálogo
// (session_id, ver sessions-mock.js) en vez de construirla inline —
// enmienda 2026-08-26 de docs/superpowers/specs/2026-08-26-training-plans-design.md.
// session_id 1/2/3 acá abajo son los mismos que siembra sessions-mock.js
// (Fondo suave / Series de velocidad / Rodaje largo).
function buildSeedPlans() {
  const now = new Date().toISOString();
  return [
    {
      id: 1,
      owner_id: 1,
      name: 'Base 5K — nivel inicial',
      description: 'Progresión de 7 días para arrancar a correr 5K sin lesionarse — 3 sesiones de entrenamiento, resto descanso activo.',
      created_at: now,
      updated_at: now,
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 1 },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 3, kind: 'training', other_name: null, session_id: 2 },
        { sequence_no: 4, kind: 'other', other_name: 'Elongación y movilidad', session_id: null },
        { sequence_no: 5, kind: 'training', other_name: null, session_id: 3 },
        { sequence_no: 6, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 7, kind: 'rest', other_name: null, session_id: null },
      ],
    },
    {
      id: 2,
      owner_id: 1,
      name: 'Series y velocidad — nivel intermedio',
      description: 'Ciclo de 7 días con foco en velocidad — series y tempo run, con descanso completo entre estímulos fuertes.',
      created_at: now,
      updated_at: now,
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 2 },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 3, kind: 'training', other_name: null, session_id: 4 },
        { sequence_no: 4, kind: 'rest', other_name: null, session_id: null },
        { sequence_no: 5, kind: 'training', other_name: null, session_id: 5 },
        { sequence_no: 6, kind: 'other', other_name: 'Trote regenerativo suave', session_id: null },
        { sequence_no: 7, kind: 'rest', other_name: null, session_id: null },
      ],
    },
  ];
}

let mockPlans = buildSeedPlans();
let nextId = 3;

function findPlanOrThrow(planId) {
  const plan = mockPlans.find((p) => String(p.id) === String(planId));
  if (!plan) {
    const error = new Error('Plan de entrenamiento no encontrado.');
    error.status = 404;
    throw error;
  }
  return plan;
}

// Valida que los días (entre 2 y 31) vengan completos y en orden — nada
// se manda al "backend" sin esto, ni siquiera el mock (mismo espíritu
// que el UNIQUE(plan_id, sequence_no) del SQL de referencia, hecho a
// mano porque acá no hay motor de base de datos que lo valide solo).
export function validatePlanDays(days) {
  if (!Array.isArray(days) || days.length < 2 || days.length > 31) {
    throw new Error('Un plan tiene que tener entre 2 y 31 días.');
  }
  const sequences = days.map((d) => d.sequence_no).sort((a, b) => a - b);
  if (sequences.some((s, i) => s !== i + 1)) {
    throw new Error(`Los días tienen que numerarse del 1 al ${days.length} sin repetir.`);
  }
  if (days.some((d) => d.kind === 'training' && !d.session_id)) {
    throw new Error('Elegí una sesión para cada día de entrenamiento.');
  }
  if (days.some((d) => d.kind === 'other' && !d.other_name)) {
    throw new Error('Ingresá el nombre de la actividad en los días de "otra actividad".');
  }
  if (days.some((d) => d.default_presencial && (!d.default_time_from || !d.default_time_to || !d.default_location))) {
    throw new Error('combinación de campos inválida para el kind del día');
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
  return null;
}

// Copia profunda de los días — nombre con sufijo "(copia)" para que se
// distinga de entrada en la lista, editable después como cualquier otro.
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

export function __resetMockTrainingPlans() {
  mockPlans = buildSeedPlans();
  nextId = 3;
}
