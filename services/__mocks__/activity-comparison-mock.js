// Mock de la comparación planificado vs realizado (Gap 35). Devuelve DTOs con
// la misma forma que el backend (snake_case) y las mismas reglas de
// cumplimiento, para poder probar las pantallas sin backend. Las fechas son
// relativas a un "hoy" inyectable para que el rango por defecto (30 días) no
// quede vacío con el paso del tiempo.

let mockNow = null;

export function __setMockComparisonNow(date) {
  mockNow = date;
}

export function __resetMockComparison() {
  mockNow = null;
}

const today = () => (mockNow ? new Date(mockNow) : new Date());

function isoDaysAgo(days) {
  const d = today();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TEAM = { team_id: 16, team_name: 'Los cracks', group_id: 16, group_name: 'Los cracks - group' };

function walk(id, role, minutes = 10) {
  return { exercise_instance_id: id, name: 'caminar 10min', role, kind: 'liviano', intensity: null, minutes, distance_m: null, speed_kph: null, repeat_count: 1 };
}

// Cada sesión: ejercicios planificados + series registradas por ejercicio.
function fixtures() {
  return [
    {
      session_instance_id: 455, daysAgo: 1, session_name: 'caminar', status: 'finished',
      started_at: `${isoDaysAgo(1)}T13:00:05Z`, ended_at: `${isoDaysAgo(1)}T13:16:40Z`,
      exercises: [walk(1001, 'warmup'), walk(1002, 'main'), walk(1003, 'cooldown')],
      feedback: {
        1001: [{ set_number: 1, status: 'completed', duration_ms: 602340, distance_meters: 835.4 }],
        1002: [{ set_number: 1, status: 'completed', duration_ms: 300000, distance_meters: 418.1 }],
        1003: [{ set_number: 1, status: 'skipped' }],
      },
    },
    {
      session_instance_id: 454, daysAgo: 0, session_name: 'caminar', status: 'none',
      exercises: [walk(1011, 'warmup'), walk(1012, 'main'), walk(1013, 'cooldown')],
      feedback: {},
    },
    {
      session_instance_id: 300, daysAgo: 4, session_name: 'Pasadas', status: 'finished',
      started_at: `${isoDaysAgo(4)}T21:00:00Z`, ended_at: `${isoDaysAgo(4)}T21:40:00Z`,
      exercises: [
        { exercise_instance_id: 2001, name: 'Elongación', role: 'warmup', kind: 'elongacion', intensity: null, minutes: null, distance_m: null, speed_kph: null, repeat_count: 1 },
        { exercise_instance_id: 2002, name: '400 m', role: 'main', kind: 'velocidad_distancia', intensity: 'vigorous', minutes: null, distance_m: 400, speed_kph: 15, repeat_count: 3 },
      ],
      feedback: {
        2001: [{ set_number: 1, status: 'completed', duration_ms: 240000 }],
        2002: [
          { set_number: 1, status: 'completed', duration_ms: 96000, distance_meters: 400 },
          { set_number: 2, status: 'completed', duration_ms: 90000, distance_meters: 300 },
          { set_number: 3, status: 'skipped' },
          { set_number: 4, status: 'completed', duration_ms: 95000, distance_meters: 400 },
        ],
      },
    },
  ];
}

const pct = (ratio) => Math.round(ratio * 1000) / 10;

function compareSet(ex, setNumber, fb, extra) {
  const set = {
    set_number: setNumber, status: fb ? fb.status : 'unregistered', extra, feedback_id: fb ? setNumber : null,
    duration_ms: null, distance_meters: null, pace_sec_per_km: null, rpe: null,
    compliance_pct: null, deviation_duration_ms: null, deviation_distance_m: null,
  };
  let ratio = 0;
  if (set.status === 'completed') {
    set.duration_ms = fb.duration_ms ?? null;
    set.distance_meters = fb.distance_meters ?? null;
    if (set.duration_ms && set.distance_meters) set.pace_sec_per_km = Math.round((set.duration_ms / set.distance_meters) * 10) / 10;
    if (ex.minutes) {
      ratio = Math.min((set.duration_ms ?? 0) / (ex.minutes * 60000), 1);
      if (set.duration_ms != null) set.deviation_duration_ms = set.duration_ms - ex.minutes * 60000;
    } else if (ex.distance_m) {
      ratio = Math.min((set.distance_meters ?? 0) / ex.distance_m, 1);
    } else {
      ratio = 1;
    }
    if (ex.distance_m && set.distance_meters != null) set.deviation_distance_m = Math.round((set.distance_meters - ex.distance_m) * 10) / 10;
  }
  if (!extra) set.compliance_pct = pct(ratio);
  return { set, ratio: extra ? 0 : ratio };
}

function buildSession(fx) {
  let ratioSum = 0;
  const totals = { planned_sets: 0, completed_sets: 0, skipped_sets: 0, unregistered_sets: 0, planned_duration_ms: null, actual_duration_ms: 0, planned_distance_m: null, actual_distance_m: 0 };
  const kinds = [];
  const exercises = fx.exercises.map((ex) => {
    const planned = Math.max(1, ex.repeat_count);
    const bySet = Object.fromEntries((fx.feedback[ex.exercise_instance_id] ?? []).map((f) => [f.set_number, f]));
    const sets = [];
    let exRatio = 0;
    for (let n = 1; n <= planned; n++) {
      const { set, ratio } = compareSet(ex, n, bySet[n], false);
      exRatio += ratio;
      sets.push(set);
    }
    (fx.feedback[ex.exercise_instance_id] ?? []).filter((f) => f.set_number > planned).forEach((f) => sets.push(compareSet(ex, f.set_number, f, true).set));
    ratioSum += exRatio;
    totals.planned_sets += planned;
    if (ex.minutes) totals.planned_duration_ms = (totals.planned_duration_ms ?? 0) + planned * ex.minutes * 60000;
    if (ex.distance_m) totals.planned_distance_m = (totals.planned_distance_m ?? 0) + planned * ex.distance_m;
    if (ex.kind && !kinds.includes(ex.kind)) kinds.push(ex.kind);
    sets.forEach((s) => {
      if (s.status === 'completed') {
        totals.completed_sets += 1;
        totals.actual_duration_ms += s.duration_ms ?? 0;
        totals.actual_distance_m += s.distance_meters ?? 0;
      } else if (s.status === 'skipped') {
        totals.skipped_sets += 1;
      } else if (!s.extra) {
        totals.unregistered_sets += 1;
      }
    });
    return {
      exercise_instance_id: ex.exercise_instance_id, name: ex.name, role: ex.role, kind: ex.kind, intensity: ex.intensity,
      has_target: Boolean(ex.minutes || ex.distance_m),
      planned: { sets: planned, minutes: ex.minutes, distance_m: ex.distance_m, speed_kph: ex.speed_kph, pace_sec_per_km: ex.speed_kph ? Math.round((3600 / ex.speed_kph) * 10) / 10 : null },
      sets,
      completed_sets: sets.filter((s) => s.status === 'completed').length,
      skipped_sets: sets.filter((s) => s.status === 'skipped').length,
      compliance_pct: pct(exRatio / planned),
    };
  });
  totals.actual_distance_m = Math.round(totals.actual_distance_m * 10) / 10;
  return {
    session_instance_id: fx.session_instance_id, date: isoDaysAgo(fx.daysAgo), session_name: fx.session_name,
    ...TEAM, is_presencial: false, kinds, status: fx.status,
    exercises, totals,
    compliance_pct: totals.planned_sets ? pct(ratioSum / totals.planned_sets) : 0,
    started_at: fx.started_at ?? null, ended_at: fx.ended_at ?? null,
  };
}

export async function mockGetSessionComparison({ sessionInstanceId }) {
  const fx = fixtures().find((f) => String(f.session_instance_id) === String(sessionInstanceId));
  if (!fx) {
    const error = new Error('sesión no encontrada');
    error.status = 404;
    throw error;
  }
  return { ...buildSession(fx), athlete_user_id: 19 };
}

export async function mockGetComparisons({ dateFrom, dateTo, kind } = {}) {
  const sessions = fixtures()
    .map(buildSession)
    .filter((s) => (!dateFrom || s.date >= dateFrom) && (!dateTo || s.date <= dateTo))
    .filter((s) => !kind || s.kinds.includes(kind))
    .sort((a, b) => (a.date === b.date ? a.session_instance_id - b.session_instance_id : a.date.localeCompare(b.date)))
    .map(({ exercises, totals, started_at, ended_at, ...rest }) => ({ ...rest, ...totals }));
  const avg = sessions.length ? Math.round((sessions.reduce((sum, s) => sum + s.compliance_pct, 0) / sessions.length) * 10) / 10 : 0;
  return {
    date_from: dateFrom, date_to: dateTo, sessions,
    summary: { sessions_planned: sessions.length, sessions_with_activity: sessions.filter((s) => s.completed_sets > 0).length, avg_compliance_pct: avg },
  };
}
