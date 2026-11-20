import { permissionsQueryOptions, userQueryOptions } from '../hooks/use-user.js';
import {
  administeredCalendarQueryOptions,
  memberCalendarQueryOptions,
} from '../hooks/use-aggregated-calendar.js';
import { runnerKpisQueryOptions } from '../hooks/use-runner-kpis.js';
import { trainerHomeKpisQueryOptions } from '../hooks/use-trainer-home-kpis.js';
import { upcomingTrainingsRange } from './upcoming-trainings.js';

export const HOME_PREFETCH_TIMEOUT_MS = 1200;

export function buildHomePrefetchQueries({ userId, role, now = new Date() } = {}) {
  if (!userId) return [];

  const { from, to } = upcomingTrainingsRange(now);
  const calendarOptions = role === 'trainer'
    ? administeredCalendarQueryOptions(userId, from, to)
    : memberCalendarQueryOptions(userId, from, to);
  const kpiOptions = role === 'trainer'
    ? trainerHomeKpisQueryOptions({ userId, period: 'month', referenceDate: from })
    : runnerKpisQueryOptions({ period: 'month', referenceDate: from, tab: 'general' });

  return [
    userQueryOptions(userId),
    permissionsQueryOptions(userId),
    calendarOptions,
    kpiOptions,
  ];
}

export async function prefetchHomeCriticalQueries(queryClient, {
  userId,
  role,
  now = new Date(),
  timeoutMs = HOME_PREFETCH_TIMEOUT_MS,
} = {}) {
  if (!queryClient || !userId) return;

  const queries = buildHomePrefetchQueries({ userId, role, now });
  const prefetch = Promise.allSettled(queries.map((query) => queryClient.prefetchQuery(query)));
  let timer;

  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });

  await Promise.race([prefetch, timeout]);
  clearTimeout(timer);
}
