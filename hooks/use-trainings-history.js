import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWorkoutFeedbackHistory,
  getAdministeredWorkoutFeedbackHistory,
  deleteWorkoutFeedback,
} from '../services/trainingsHistory.js';
import { toWorkoutFeedbackHistoryResponseModel } from '../services/normalizers.js';
import {
  computeFiltersKey,
  shouldResetPage,
  mergeHistoryPage,
  computeHasMore,
  visibleHistoryItems,
} from '../utils/trainings-history-pagination.js';

function historyQueryKey(role, userId, filtersKey, page) {
  return ['trainings-history', role, userId, filtersKey, page];
}

export function useTrainingsHistory(role, userId, filters) {
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState({ filtersKey: null, pageKey: null, responseKey: null, items: [] });

  const filtersKey = computeFiltersKey(filters);
  if (shouldResetPage(accumulated.filtersKey, filtersKey, page)) {
    setPage(1);
  }

  const fetcher = role === 'trainer' ? getAdministeredWorkoutFeedbackHistory : getWorkoutFeedbackHistory;
  const query = useQuery({
    queryKey: historyQueryKey(role, userId, filtersKey, page),
    queryFn: () => fetcher(userId, { ...filters, page }).then(toWorkoutFeedbackHistoryResponseModel),
    enabled: Boolean(userId && (role !== 'trainer' || filters.teamId)),
  });

  const pageKey = `${filtersKey}:${page}`;
  // dataUpdatedAt entra en la clave a propósito -- ver el comentario de
  // mergeHistoryPage (trainings-history-pagination.js).
  const responseKey = query.dataUpdatedAt ? `${pageKey}:${query.dataUpdatedAt}` : null;
  if (query.isSuccess && responseKey && accumulated.responseKey !== responseKey) {
    setAccumulated(mergeHistoryPage(accumulated, filtersKey, pageKey, responseKey, page, query.data.items));
  }

  return {
    items: visibleHistoryItems(accumulated, filtersKey),
    total: query.data?.total ?? 0,
    hasMore: query.data ? computeHasMore(page, query.data.pageSize ?? 20, query.data.total) : false,
    availableAthletes: query.data?.availableAthletes ?? [],
    availableExercises: query.data?.availableExercises ?? [],
    loading: query.isLoading,
    isFetching: query.isFetching,
    loadMore: () => setPage((p) => p + 1),
  };
}

// Borrado individual (usado en lote desde el caller vía Promise.all, ver
// trainings-history-tab.jsx) — mismo shape {success, error} que
// hooks/use-exercises.js#useExerciseMutations para que el caller maneje
// éxito/fallo parcial de la misma forma ya establecida en el repo.
export function useDeleteWorkoutFeedbackMutation(role, userId, filters) {
  const queryClient = useQueryClient();
  const filtersKey = computeFiltersKey(filters);

  const mutation = useMutation({
    mutationFn: async (feedbackId) => {
      try {
        await deleteWorkoutFeedback(feedbackId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings-history', role, userId, filtersKey] });
    },
  });

  return { deleteFeedback: mutation.mutateAsync, isDeleting: mutation.isPending };
}
