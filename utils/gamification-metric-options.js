// Las 6 métricas de gamificación (Gap 32/33) -- compartidas entre el
// selector del leaderboard (components/team/leaderboard-tab.jsx) y el de
// creación de competencia (components/team/create-competition-modal.jsx).
// `icon` (MaterialCommunityIcons) solo lo usa el leaderboard, para las
// subpestañas de TabBar -- el otro consumidor (ResponsiveSelectField de
// create-competition-modal.jsx) ignora el campo extra, no rompe nada.
export const METRIC_OPTIONS = [
  { id: 'distance', name: 'Distancia', icon: 'map-marker-distance' },
  { id: 'duration', name: 'Tiempo de entrenamiento', icon: 'clock-outline' },
  { id: 'pace', name: 'Mejor ritmo (min/km)', icon: 'speedometer' },
  { id: 'peak_speed', name: 'Velocidad pico', icon: 'flash' },
  { id: 'sessions_count', name: 'Entrenamientos realizados', icon: 'run' },
  { id: 'attendance_count', name: 'Asistencias', icon: 'account-check-outline' },
];
