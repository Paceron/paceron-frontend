import { EXERCISE_KIND_META, SESSION_ROLE_META } from '../components/plans/exercise-kind-meta.js';
import { formatClock } from './time.js';
import { formatMeters } from './distance.js';

// Textos de la comparación planificado vs realizado (Gap 35). Puro, sin React:
// lo usan las pantallas, el PDF y el CSV, así los tres dicen lo mismo.
// Regla: un objetivo o desviación null es "sin objetivo", nunca 0.

export const NO_TARGET_LABEL = 'Sin objetivo';
export const EMPTY_COMPARISON_MESSAGE = 'No hay entrenamientos planificados o realizados para comparar';
// Una sesión de hoy que todavía no terminó se lista, pero no entra al promedio.
export const PENDING_AVERAGE_LABEL = 'Todavía no cuenta en el promedio';

// Aclara sobre cuántas sesiones sale el promedio del rango, solo cuando no
// entran todas (hay alguna de hoy sin terminar).
export function averageBasisLabel(summary) {
  const planned = summary?.sessionsPlanned ?? 0;
  const averaged = summary?.sessionsAveraged ?? planned;
  if (averaged >= planned) return null;
  if (averaged === 0) return 'Todavía no hay sesiones para promediar';
  return `Sobre ${averaged} de ${planned} sesiones`;
}

// Sin sesiones para promediar, el promedio no es 0 %: no existe todavía.
export function averageValueLabel(summary) {
  if ((summary?.sessionsAveraged ?? 0) === 0) return '—';
  return formatCompliance(summary.avgCompliancePct);
}

export function kindLabel(kind) {
  return EXERCISE_KIND_META[kind]?.label ?? kind ?? '';
}

export function roleLabel(role) {
  return SESSION_ROLE_META[role]?.label ?? role ?? '';
}

// 50.1 → "50,1 %", 100 → "100 %". null → "—".
export function formatCompliance(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  const rounded = Math.round(Number(pct) * 10) / 10;
  return `${String(rounded).replace('.', ',')} %`;
}

// Tono del cumplimiento para colorearlo: 'good' (90+), 'partial' (50+) o 'low'.
export function complianceTone(pct) {
  const value = Number(pct) || 0;
  if (value >= 90) return 'good';
  if (value >= 50) return 'partial';
  return 'low';
}

const MINUS = '−';

// Desviación en ms → "+2:00", "−5:00", "±0:00". null → null (sin objetivo).
export function formatDurationDeviation(ms) {
  if (ms == null) return null;
  const value = Math.round(Number(ms) / 1000) * 1000;
  if (value === 0) return '±00:00';
  return `${value > 0 ? '+' : MINUS}${formatClock(Math.abs(value))}`;
}

// Desviación en metros → "+50 m", "−1.25 km". null → null.
export function formatDistanceDeviation(meters) {
  if (meters == null) return null;
  const value = Number(meters);
  if (Math.round(value) === 0) return '±0 m';
  return `${value > 0 ? '+' : MINUS}${formatMeters(Math.abs(value))}`;
}

// Segundos por km → "5:00 /km". null → null.
export function formatPace(secPerKm) {
  if (secPerKm == null || !Number(secPerKm)) return null;
  return `${formatClock(Number(secPerKm) * 1000)} /km`;
}

// Objetivo de UNA serie: "10 min", "400 m", "10 min · 1.00 km" o "Sin objetivo".
export function plannedTargetLabel(planned) {
  const parts = [];
  if (planned?.minutes) parts.push(`${planned.minutes} min`);
  if (planned?.distanceM) parts.push(formatMeters(planned.distanceM));
  return parts.length ? parts.join(' · ') : NO_TARGET_LABEL;
}

// "2 × 10 min" para el encabezado del ejercicio.
export function plannedExerciseLabel(planned) {
  const target = plannedTargetLabel(planned);
  return `${planned?.sets ?? 1} × ${target === NO_TARGET_LABEL ? 'serie' : target}`;
}

const SET_STATUS_LABELS = { completed: 'Completada', skipped: 'Salteada', unregistered: 'Sin registro' };

export function setStatusLabel(status) {
  return SET_STATUS_LABELS[status] ?? status ?? '';
}

// Lo realizado en una serie: "10:02 · 835 m", "Salteada" o "Sin registro".
export function setActualLabel(set) {
  if (set?.status !== 'completed') return setStatusLabel(set?.status);
  const parts = [];
  if (set.durationMs != null) parts.push(formatClock(set.durationMs));
  if (set.distanceMeters != null) parts.push(formatMeters(set.distanceMeters));
  return parts.length ? parts.join(' · ') : 'Completada';
}

// Desviación de una serie, para mostrar al lado: prioriza tiempo, después
// distancia. null si no hay objetivo o la serie no se hizo.
export function setDeviationLabel(set) {
  return formatDurationDeviation(set?.deviationDurationMs) ?? formatDistanceDeviation(set?.deviationDistanceM);
}

const SESSION_STATUS_LABELS = { finished: 'Completada', wip: 'En curso', interrupted: 'Interrumpida', none: 'Sin ejecutar' };

export function sessionStatusLabel(status) {
  return SESSION_STATUS_LABELS[status] ?? status ?? '';
}

// "10:00 – 10:16" (hora local) a partir de los ISO del backend. Sin inicio, null.
export function formatSchedule(startedAt, endedAt) {
  if (!startedAt) return null;
  const time = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const start = time(startedAt);
  const end = endedAt ? time(endedAt) : null;
  if (!start) return null;
  return end ? `${start} – ${end}` : start;
}

// Duración total "planificada vs real": "30:00 vs 15:02". Sin objetivo de
// tiempo, solo lo real.
export function totalsDurationLabel(totals) {
  const actual = formatClock(totals?.actualDurationMs ?? 0);
  return totals?.plannedDurationMs != null ? `${formatClock(totals.plannedDurationMs)} vs ${actual}` : actual;
}

export function totalsDistanceLabel(totals) {
  const actual = formatMeters(totals?.actualDistanceM ?? 0);
  return totals?.plannedDistanceM != null ? `${formatMeters(totals.plannedDistanceM)} vs ${actual}` : actual;
}

// "dd-mm-aaaa" desde "aaaa-mm-dd" (mismo formato de pantalla del resto de la app).
export function formatComparisonDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = String(isoDate).slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
}
