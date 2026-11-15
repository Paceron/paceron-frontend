import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { runnerSessionQueryOptions } from './use-runner-session.js';
import { filterUpcomingTrainingsByStatus } from '../utils/upcoming-trainings.js';

export function useUpcomingTrainingsVisibility(trainings, userId) {
  const sessionInstanceIds = useMemo(() => {
    const ids = new Set();
    for (const training of trainings) {
      const id = training.sessionInstance?.id;
      if (id != null) ids.add(String(id));
    }
    return [...ids];
  }, [trainings]);

  const queries = useQueries({
    queries: sessionInstanceIds.map((id) => ({
      ...runnerSessionQueryOptions(id, userId),
      enabled: Boolean(userId),
    })),
  });

  const statusBySessionId = {};
  sessionInstanceIds.forEach((id, index) => {
    const status = queries[index]?.data?.status;
    if (status) statusBySessionId[id] = status;
  });

  return {
    trainings: filterUpcomingTrainingsByStatus(trainings, statusBySessionId),
    loading: Boolean(userId) && queries.some((query) => query.isLoading),
  };
}
