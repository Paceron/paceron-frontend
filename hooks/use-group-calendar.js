import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGroupCalendar as getGroupCalendarService,
  upsertCalendarDay as upsertCalendarDayService,
  deleteCalendarDay as deleteCalendarDayService,
  stampPlan as stampPlanService,
  bulkAssignDays as bulkAssignDaysService,
  bulkClearDays as bulkClearDaysService,
  shiftCalendar as shiftCalendarService,
} from '../services/calendar.js';
import { toGroupCalendarDayModel, toCalendarDayPayload, toStampPayload, toBulkAssignPayload } from '../services/normalizers.js';
import { adjacentMonths, monthRange } from '../utils/calendar-month-range.js';

// Calendario de un grupo — TanStack Query, mismo criterio que
// hooks/use-sessions.js. Se pide por rango (mes visible) — GroupCalendarDay
// es una tabla dispersa del lado del backend, sin fila = día vacío.
export function useGroupCalendar(groupId, from, to) {
  const query = useQuery({
    queryKey: ['group-calendar', groupId, from, to],
    queryFn: () => getGroupCalendarService(groupId, from, to).then((dtos) => dtos.map(toGroupCalendarDayModel)),
    enabled: Boolean(groupId && from && to),
  });
  return { days: query.data ?? [], loading: query.isLoading, isFetching: query.isFetching, error: query.error };
}

// Mismo criterio que usePrefetchAdjacentCalendars (hooks/use-aggregated-calendar.js)
// pero para el calendario de un único grupo.
export function usePrefetchAdjacentGroupCalendar(groupId, year, month) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!groupId || !year || !month) return;
    const { prev, next } = adjacentMonths(year, month);
    for (const target of [prev, next]) {
      const { from, to } = monthRange(target.year, target.month);
      queryClient.prefetchQuery({
        queryKey: ['group-calendar', groupId, from, to],
        queryFn: () => getGroupCalendarService(groupId, from, to).then((dtos) => dtos.map(toGroupCalendarDayModel)),
      });
    }
  }, [groupId, year, month, queryClient]);
}

export function useGroupCalendarMutations(groupId) {
  const queryClient = useQueryClient();

  // Invalida por prefijo (sin from/to) — cualquier mes cacheado de este
  // grupo queda desactualizado, mismo criterio que ['sessions', ownerId].
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['group-calendar', groupId] });

  const upsertDayMutation = useMutation({
    mutationFn: async ({ date, day }) => {
      try {
        const updated = await upsertCalendarDayService(groupId, date, toCalendarDayPayload(day));
        return { success: true, day: toGroupCalendarDayModel(updated), sameTeamWarnings: updated.same_team_warnings ?? [] };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const deleteDayMutation = useMutation({
    mutationFn: async ({ date }) => {
      try {
        await deleteCalendarDayService(groupId, date);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const stampPlanMutation = useMutation({
    mutationFn: async ({ planId, startDate, force, excludeDates }) => {
      try {
        const result = await stampPlanService(groupId, toStampPayload({ planId, startDate, force, excludeDates }));
        if (result.conflict) {
          return { success: false, conflict: true, presencialCollision: result.presencialCollision, message: result.message, dates: result.dates, conflicts: result.conflicts };
        }
        return { success: true, days: result.days.map(toGroupCalendarDayModel), sameTeamWarnings: result.sameTeamWarnings };
      } catch (error) {
        return { success: false, conflict: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ dates, day }) => {
      try {
        const result = await bulkAssignDaysService(groupId, toBulkAssignPayload({ dates, day }));
        return { success: true, days: result.days.map(toGroupCalendarDayModel), sameTeamWarnings: result.sameTeamWarnings };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const bulkClearMutation = useMutation({
    mutationFn: async ({ dates }) => {
      try {
        await bulkClearDaysService(groupId, dates);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const shiftCalendarMutation = useMutation({
    mutationFn: async ({ fromDate, days }) => {
      try {
        const result = await shiftCalendarService(groupId, { from_date: fromDate, days });
        if (result.conflict) return { success: false, conflict: true, message: result.message };
        return { success: true, days: result.days.map(toGroupCalendarDayModel), sameTeamWarnings: result.sameTeamWarnings };
      } catch (error) {
        return { success: false, conflict: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  return {
    upsertDay: upsertDayMutation.mutateAsync,
    isUpserting: upsertDayMutation.isPending,
    deleteDay: deleteDayMutation.mutateAsync,
    isDeleting: deleteDayMutation.isPending,
    stampPlan: stampPlanMutation.mutateAsync,
    isStamping: stampPlanMutation.isPending,
    bulkAssign: bulkAssignMutation.mutateAsync,
    isBulkAssigning: bulkAssignMutation.isPending,
    bulkClear: bulkClearMutation.mutateAsync,
    isBulkClearing: bulkClearMutation.isPending,
    shiftCalendar: shiftCalendarMutation.mutateAsync,
    isShifting: shiftCalendarMutation.isPending,
  };
}
