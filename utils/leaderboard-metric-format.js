import { formatMeters } from './distance.js';
import { formatClock, pad2 } from './time.js';

// `value` siempre viaja como número plano (Gap 32) -- acá se decide cómo
// se ve cada métrica. Pura y testeada: hooks/use-team-leaderboard.js no
// formatea nada, components/team/leaderboard-tab.jsx solo llama a esto.
function formatPace(minutesPerKm) {
  const value = Number(minutesPerKm);
  if (minutesPerKm == null || !Number.isFinite(value)) return '—';
  const totalSeconds = Math.round(value * 60);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)} /km`;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)} /km`;
  return `${minutes}:${pad2(seconds)} /km`;
}

function formatPeakSpeed(kmh) {
  const value = Number(kmh);
  if (kmh == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} km/h`;
}

function formatCount(value) {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return '—';
  return `${n}`;
}

export function formatMetricValue(metric, value) {
  if (metric === 'distance') return formatMeters(value);
  if (metric === 'duration') return value == null ? '—' : formatClock(value);
  if (metric === 'pace') return formatPace(value);
  if (metric === 'peak_speed') return formatPeakSpeed(value);
  if (metric === 'sessions_count' || metric === 'attendance_count') return formatCount(value);
  return '—';
}
