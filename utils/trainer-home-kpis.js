import { formatArs } from './currency.js';
import { PERIOD_OPTIONS, buildPeriodTitle } from './runner-kpis.js';

export const TRAINER_HOME_PERIOD_OPTIONS = PERIOD_OPTIONS;

export const TRAINER_HOME_PERIOD_METRICS = [
  {
    field: 'sessions',
    label: 'Sesiones · programadas / realizadas',
    icon: 'calendar-check',
    formula: 'Sesiones programadas / realizadas. Una sesión se considera realizada cuando tiene al menos una asistencia registrada.',
  },
  {
    field: 'presencialSessions',
    label: 'Presenciales · programadas / realizadas',
    icon: 'account-group',
    formula: 'Sesiones presenciales programadas / realizadas. Realizada significa que tiene al menos una asistencia registrada; es un subconjunto del total de sesiones.',
  },
  {
    field: 'netCollected',
    label: 'Cobrado',
    icon: 'cash-check',
    formula: 'Suma de los cobros de membresías aprobados en el período, menos la comisión de Paceron.',
  },
  {
    field: 'pendingAmount',
    label: 'Pendiente de cobro',
    icon: 'cash-clock',
    formula: 'Monto de cuotas no pagadas cuyo vencimiento cae dentro del período. La cantidad de cuotas pendientes se muestra en este detalle.',
  },
];

export const TRAINER_HOME_STRUCTURE_METRICS = [
  { field: 'activeTeams', label: 'Equipos activos', icon: 'account-group' },
  { field: 'activeRunners', label: 'Corredores activos', icon: 'run' },
];

export function trainerHomePeriodTitle(data) {
  return buildPeriodTitle({
    period: data?.period,
    from: data?.from,
    to: data?.to,
    daysConsidered: data?.daysConsidered,
  });
}

export function formatSessionPair(scheduled, realized) {
  return `${formatCount(scheduled)} / ${formatCount(realized)}`;
}

export function formatCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? String(count) : '0';
}

export function formatTrainerHomeMetric(field, data) {
  if (!data) return '—';
  if (field === 'sessions') return formatSessionPair(data.sessions?.scheduled, data.sessions?.realized);
  if (field === 'presencialSessions') {
    return formatSessionPair(data.sessions?.presencialScheduled, data.sessions?.presencialRealized);
  }
  if (field === 'netCollected') return formatArs(data.collections?.netCollected ?? 0, { decimals: 2 }) ?? '—';
  if (field === 'pendingAmount') return formatArs(data.collections?.pendingAmount ?? 0) ?? '—';
  if (field === 'activeTeams') return formatCount(data.structure?.activeTeams);
  if (field === 'activeRunners') return formatCount(data.structure?.activeRunners);
  return '—';
}

export function trainerHomeKpisPrefix(userId) {
  return ['trainer-home-kpis', userId ?? null];
}
