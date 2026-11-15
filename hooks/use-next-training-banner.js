import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useMemberCalendar, useAdministeredCalendar } from './use-aggregated-calendar.js';
import { runnerSessionQueryOptions } from './use-runner-session.js';
import { upcomingTrainingsRange } from '../utils/upcoming-trainings.js';
import {
  selectCancelledBefore,
  selectNextPendingTraining,
  selectNextTrainingCandidates,
} from '../utils/next-training-banner.js';

export function useNextTrainingBanner(role, userId) {
  const { from, to } = useMemo(() => upcomingTrainingsRange(), []);
  const memberQuery = useMemberCalendar(role === 'runner' ? userId : null, from, to);
  const administeredQuery = useAdministeredCalendar(role === 'trainer' ? userId : null, from, to);
  const { days, loading, isFetching } = role === 'trainer' ? administeredQuery : memberQuery;

  const candidates = useMemo(
    () => selectNextTrainingCandidates(days, { presencialOnly: role === 'trainer' }),
    [days, role],
  );

  const sessionInstanceIds = useMemo(() => {
    if (role !== 'runner') return [];
    const ids = new Set();
    for (const day of candidates) {
      const id = day.sessionInstance?.id;
      if (id != null) ids.add(String(id));
    }
    return [...ids];
  }, [candidates, role]);

  const statusQueries = useQueries({
    queries: sessionInstanceIds.map((id) => runnerSessionQueryOptions(id, userId)),
  });

  const statusLoading = role === 'runner' && statusQueries.some((query) => query.isLoading);

  const nextTraining = useMemo(() => {
    if (role !== 'runner') return candidates[0] ?? null;
    const statusBySessionId = {};
    sessionInstanceIds.forEach((id, index) => {
      const status = statusQueries[index]?.data?.status;
      if (status) statusBySessionId[id] = status;
    });
    return selectNextPendingTraining(days, statusBySessionId);
  }, [candidates, days, role, sessionInstanceIds, statusQueries]);

  const cancelledSessions = useMemo(
    () => (nextTraining ? selectCancelledBefore(days, nextTraining.date) : []),
    [days, nextTraining],
  );

  return { nextTraining, cancelledSessions, loading: loading || statusLoading, isFetching };
}
