import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMemberCalendar, getAdministeredCalendar } from '../services/calendar.js';
import { toAggregatedCalendarDayModel } from '../services/normalizers.js';
import { adjacentMonths, monthRange } from '../utils/calendar-month-range.js';

// Vista agregada de calendario (Gap 11, pieza 2) — solo lectura. Cualquier
// escritura sigue pasando por hooks/use-group-calendar.js vía la pantalla
// de un grupo puntual (group-calendar-day-screen.jsx).

function memberCalendarQueryKey(userId, from, to) {
  return ['member-calendar', userId, from, to];
}

function administeredCalendarQueryKey(userId, from, to) {
  return ['administered-calendar', userId, from, to];
}

export function useMemberCalendar(userId, from, to) {
  const query = useQuery({
    queryKey: memberCalendarQueryKey(userId, from, to),
    queryFn: () => getMemberCalendar(userId, from, to).then((dtos) => dtos.map(toAggregatedCalendarDayModel)),
    enabled: Boolean(userId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, isFetching: query.isFetching };
}

export function useAdministeredCalendar(userId, from, to) {
  const query = useQuery({
    queryKey: administeredCalendarQueryKey(userId, from, to),
    queryFn: () => getAdministeredCalendar(userId, from, to).then((dtos) => dtos.map(toAggregatedCalendarDayModel)),
    enabled: Boolean(userId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, isFetching: query.isFetching };
}

// Precarga el mes anterior y siguiente al visible, mismas queryKey/queryFn
// que el hook real de arriba (para que TanStack Query las trate como el
// mismo cache) — navegar con flechas o con los selects de mes/año llega
// con el mes vecino ya tibio la mayoría de las veces.
export function usePrefetchAdjacentCalendars(kind, userId, year, month) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId || !year || !month) return;
    const { prev, next } = adjacentMonths(year, month);
    const fetcher = kind === 'member' ? getMemberCalendar : getAdministeredCalendar;
    const queryKeyFor = kind === 'member' ? memberCalendarQueryKey : administeredCalendarQueryKey;
    for (const target of [prev, next]) {
      const { from, to } = monthRange(target.year, target.month);
      queryClient.prefetchQuery({
        queryKey: queryKeyFor(userId, from, to),
        queryFn: () => fetcher(userId, from, to).then((dtos) => dtos.map(toAggregatedCalendarDayModel)),
      });
    }
  }, [kind, userId, year, month, queryClient]);
}
