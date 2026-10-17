// Las 6 métricas de gamificación (Gap 32/33) -- compartidas entre el
// selector del leaderboard (components/team/leaderboard-tab.jsx) y el de
// creación de competencia (components/team/create-competition-modal.jsx).
// Antes vivía duplicada solo en el leaderboard.
export const METRIC_OPTIONS = [
  { id: 'distance', name: 'Distancia' },
  { id: 'duration', name: 'Tiempo de entrenamiento' },
  { id: 'pace', name: 'Mejor ritmo' },
  { id: 'peak_speed', name: 'Velocidad pico' },
  { id: 'sessions_count', name: 'Entrenamientos realizados' },
  { id: 'attendance_count', name: 'Asistencias' },
];
