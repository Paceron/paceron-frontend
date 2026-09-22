import { useQuery } from '@tanstack/react-query';
import { getMemberCalendar, getAdministeredCalendar, getCalendarSummary } from '../services/calendar.js';
import { toAggregatedCalendarDayModel } from '../services/normalizers.js';

// Vista agregada de calendario (Gap 11, pieza 2) — solo lectura. Cualquier
// escritura sigue pasando por hooks/use-group-calendar.js vía la pantalla
// de un grupo puntual (group-calendar-day-screen.jsx).

export function useMemberCalendar(userId, from, to) {
  const query = useQuery({
    queryKey: ['member-calendar', userId, from, to],
    queryFn: () => getMemberCalendar(userId, from, to).then((dtos) => dtos.map(toAggregatedCalendarDayModel)),
    enabled: Boolean(userId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, isFetching: query.isFetching };
}

export function useAdministeredCalendar(userId, from, to) {
  const query = useQuery({
    queryKey: ['administered-calendar', userId, from, to],
    queryFn: () => getAdministeredCalendar(userId, from, to).then((dtos) => dtos.map(toAggregatedCalendarDayModel)),
    enabled: Boolean(userId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, isFetching: query.isFetching };
}

export function useCalendarSummary(userId) {
  const query = useQuery({
    queryKey: ['calendar-summary', userId],
    queryFn: () => getCalendarSummary(userId),
    enabled: Boolean(userId),
  });
  const groups = (query.data ?? []).map((g) => ({ id: String(g.group_id), name: g.group_name }));
  return { groups, loading: query.isLoading };
}
