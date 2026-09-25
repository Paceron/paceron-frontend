import { useMemo } from 'react';
import { useMemberCalendar, useAdministeredCalendar } from './use-aggregated-calendar.js';
import { upcomingTrainingsRange } from '../utils/upcoming-trainings.js';
import { selectNextTraining, selectCancelledBefore } from '../utils/next-training-banner.js';

export function useNextTrainingBanner(role, userId) {
  const { from, to } = useMemo(() => upcomingTrainingsRange(), []);
  const memberQuery = useMemberCalendar(role === 'runner' ? userId : null, from, to);
  const administeredQuery = useAdministeredCalendar(role === 'trainer' ? userId : null, from, to);
  const { days, loading, isFetching } = role === 'trainer' ? administeredQuery : memberQuery;

  const nextTraining = useMemo(
    () => selectNextTraining(days, { presencialOnly: role === 'trainer' }),
    [days, role],
  );
  const cancelledSessions = useMemo(
    () => (nextTraining ? selectCancelledBefore(days, nextTraining.date) : []),
    [days, nextTraining],
  );

  return { nextTraining, cancelledSessions, loading, isFetching };
}
