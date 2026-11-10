// Las 6 métricas de gamificación (Gap 32/33) -- usadas por el selector del
// leaderboard (components/team/leaderboard-tab.jsx) y por
// utils/competition-title.js (nombre de cualquier competencia, incluida
// una vieja que ya tenga sessions_count/attendance_count persistido).
export const METRIC_OPTIONS = [
  { id: 'distance', name: 'Distancia' },
  { id: 'duration', name: 'Tiempo de entrenamiento' },
  { id: 'pace', name: 'Mejor ritmo' },
  { id: 'peak_speed', name: 'Velocidad pico' },
  { id: 'sessions_count', name: 'Entrenamientos realizados' },
  { id: 'attendance_count', name: 'Asistencias' },
];

// Bug real confirmado 2026-11-08: `POST /teams/{id}/competitions` con
// metric=sessions_count (u otro de los dos de abajo) responde 400 "datos
// de competencia inválidos: metric debe ser una de: distance, duration,
// pace, peak_speed" -- a diferencia del leaderboard (Gap 32), que sí
// acepta las 6. `create-competition-modal.jsx` ofrecía las 6, dos de las
// cuales el backend rechaza para este recurso puntual. Subconjunto de
// METRIC_OPTIONS, mismo orden -- nunca una lista aparte a mano.
export const COMPETITION_METRIC_OPTIONS = METRIC_OPTIONS.filter(
  (m) => m.id !== 'sessions_count' && m.id !== 'attendance_count',
);
