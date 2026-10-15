// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true (Gap 32). Exactamente 5
// filas (ya es el "top 5" que manda el backend) + un `viewer_rank` en el
// puesto 7 (fuera del top 5, para poder ver la fila propia renderizada
// aparte) + un `record` fijo para el modo histórico. Ignora `period` a
// propósito -- es un fixture visual, no un simulador real de agregación.
// `value` SÍ varía por `metric` (bug real, 2026-10-15): antes el mock
// devolvía siempre los mismos números con forma de metros para cualquier
// métrica, así que elegir "Mejor ritmo" formateaba 42500 como si fueran
// minutos/km ("42500:00 /km") -- el bug estaba en los datos del mock, no en
// el formateador (utils/leaderboard-metric-format.js ya esperaba el
// encoding correcto del Gap 32: pace en min/km decimal, peak_speed en km/h
// decimal).
const NAMES = ['Lucía Fernández', 'Martín Gómez', 'Sofía Ibarra', 'Tomás Silva', 'Valentina Ríos'];

// Por métrica: 5 valores (ya ordenados de mayor a mejor), el valor del
// viewer (puesto 7) y el récord histórico -- mismo encoding que el Gap 32
// confirma para `value` (número plano, nunca string formateado).
const VALUES_BY_METRIC = {
  distance: { rows: [42500, 38200, 35900, 31000, 28700], viewer: 15400, record: 58300 }, // metros
  duration: { rows: [10800000, 9600000, 8700000, 7200000, 6300000], viewer: 3600000, record: 14400000 }, // ms
  pace: { rows: [4.95, 5.12, 5.3, 5.58, 5.9], viewer: 6.4, record: 4.62 }, // min/km, menor = mejor
  peak_speed: { rows: [19.8, 18.6, 17.9, 16.5, 15.2], viewer: 13.1, record: 21.4 }, // km/h
  sessions_count: { rows: [24, 21, 19, 16, 14], viewer: 8, record: 31 }, // entero
  attendance_count: { rows: [20, 18, 16, 13, 11], viewer: 6, record: 26 }, // entero
};

function buildRows(metric) {
  const values = (VALUES_BY_METRIC[metric] ?? VALUES_BY_METRIC.distance).rows;
  return values.map((value, i) => ({ user_id: i + 1, name: NAMES[i], avatar_url: null, value, rank: i + 1 }));
}

export async function mockGetTeamLeaderboard(metric = 'distance') {
  const values = VALUES_BY_METRIC[metric] ?? VALUES_BY_METRIC.distance;
  return {
    rows: buildRows(metric),
    viewer_rank: { user_id: 42, value: values.viewer, rank: 7 },
    record: { user_id: 1, name: 'Lucía Fernández', value: values.record, achieved_at: '2026-06-12' },
  };
}
