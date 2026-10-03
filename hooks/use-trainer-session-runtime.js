import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useLiveSessionStore } from '../store/live-session-store.js';
import { useRealtimeChannel } from './use-realtime-channel.js';
import { useSessionGpsTracker } from './use-session-gps-tracker.js';
import { send as sendRaw } from '../services/realtime-client.js';
import { finishRunnerSession, getRunnerSession, getSessionFeedback } from '../services/runnerSession.js';
import { toRunnerSessionModel, toSessionFeedbackModel } from '../services/normalizers.js';
import { runnerSessionQueryKey } from './use-runner-session.js';
import { applyParticipantMessage, applyRunnerStatus, initParticipants } from '../utils/trainer-participant-state.js';
import { exerciseNameById } from '../utils/trainer-participant-progress.js';
import { appendFeedEvent } from '../utils/trainer-records-feed.js';
import { logDebug } from '../utils/debug-log.js';

// Motor no-visual de la pantalla en vivo del entrenador. A diferencia de
// hooks/use-live-session-runtime.js (corredor), acá NO hay SQLite ni ningún
// session_run local -- el entrenador es supervisor, no ejecuta series. Su GPS
// es incondicional mientras la pantalla está montada (sin el gate por serie
// activa que tiene el corredor, porque no hay series propias que gatear).
export function useTrainerSessionRuntime({ sessionInstanceId, exercises, rosterMembers }) {
  const gpsEnabled = useLiveSessionStore((s) => s.gpsEnabled);

  const [participants, setParticipants] = useState(() => initParticipants(rosterMembers));
  const [feed, setFeed] = useState([]);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [selfPosition, setSelfPosition] = useState(null);

  const channel = sessionInstanceId ? `session:${sessionInstanceId}` : null;

  const handleChannelMessage = (msg) => {
    if (msg.type === 'presence') {
      setParticipants((current) => applyParticipantMessage(current, msg, exercises));
      return;
    }
    // El tipo es el STRING LITERAL "update:set_event" (un solo campo `type`,
    // no `type:"update"` + `event:"set_event"` separados), y el feedback real
    // viaja en `data.data` -- `data` es el MutationResponse completo
    // ({message, data}) que el endpoint HTTP devuelve, no el feedback directo
    // (Gap 20, confirmado contra
    // cmd/api/controllers/workout_feedback_controller.go#MarshalUpdateSetEvent
    // y docs/REALTIME_WS.md del backend). Leer `msg.event`/`msg.payload` acá
    // nunca matcheaba nada -- los registros del corredor nunca llegaban al
    // feed del entrenador.
    if (msg.type === 'update:set_event') {
      const payload = msg.data?.data ?? {};
      const athleteUserId = payload.athlete_user_id;
      if (athleteUserId == null) return;
      const feedback = toSessionFeedbackModel(payload);
      if (!feedback) return;
      const member = rosterMembers.find((m) => String(m.userId) === String(athleteUserId));
      setFeed((current) => appendFeedEvent(current, {
        id: feedback.id,
        athleteUserId: String(athleteUserId),
        athleteName: member?.name ?? `Atleta ${athleteUserId}`,
        athletePhotoUrl: member?.photoUrl ?? null,
        // feedback.exerciseName SIEMPRE es null (el backend no lo manda, solo
        // assignedExerciseId) -- se resuelve contra la lista de ejercicios de
        // la sesión.
        exerciseName: exerciseNameById(exercises, feedback.assignedExerciseId),
        setNumber: feedback.setNumber,
        status: feedback.completionStatus,
        timestamp: new Date(feedback.updatedAt ?? feedback.endedAt ?? Date.now()).getTime(),
      }));
    }
  };

  const { status: connectionStatus, send } = useRealtimeChannel(channel, {
    onMessage: handleChannelMessage,
    enabled: Boolean(channel),
    onSubscribed: () => sendRaw(channel, 'presence', undefined, { event: 'joined', payload: {} }),
    onBeforeUnsubscribe: () => sendRaw(channel, 'presence', undefined, { event: 'left', payload: {} }),
  });

  // Bootstrap del feed: un fan-out de GET .../feedback?athlete_user_id= por
  // cada miembro del roster (Gap 20, punto 1 -- fallback ya implementado acá
  // desde el principio, no una rama condicional). Cubre lo que ya pasó ANTES
  // de que el entrenador se sumara; de ahí en más, update:set_event lo sigue.
  const feedbackQueries = useQueries({
    queries: (rosterMembers ?? []).map((member) => ({
      queryKey: ['session-feedback', sessionInstanceId, member.userId],
      queryFn: () => getSessionFeedback(sessionInstanceId, member.userId),
      enabled: Boolean(sessionInstanceId && member.userId),
    })),
  });

  const feedbackQueriesResolved = feedbackQueries.length > 0 && feedbackQueries.every((q) => q.isFetched);

  useEffect(() => {
    if (bootstrapped || !feedbackQueriesResolved) return;
    let bootstrapFeed = [];
    let resolvedByAthlete = new Map();
    feedbackQueries.forEach((query, index) => {
      const member = rosterMembers[index];
      const rows = (query.data?.data ?? []).map(toSessionFeedbackModel).filter(Boolean);
      resolvedByAthlete.set(String(member.userId), rows.length);
      for (const row of rows) {
        bootstrapFeed = appendFeedEvent(bootstrapFeed, {
          id: row.id,
          athleteUserId: String(member.userId),
          athleteName: member.name,
          athletePhotoUrl: member.photoUrl ?? null,
          exerciseName: exerciseNameById(exercises, row.assignedExerciseId),
          setNumber: row.setNumber,
          status: row.completionStatus,
          timestamp: new Date(row.updatedAt ?? row.endedAt ?? 0).getTime(),
        });
      }
    });
    setFeed(bootstrapFeed);
    setParticipants((current) => {
      const next = new Map(current);
      for (const [userId, count] of resolvedByAthlete.entries()) {
        const existing = next.get(userId);
        if (existing) next.set(userId, { ...existing, resolvedSetCount: count });
      }
      return next;
    });
    setBootstrapped(true);
    logDebug(`[trainer-live] bootstrap feed OK, ${bootstrapFeed.length} eventos previos`);
  }, [bootstrapped, feedbackQueriesResolved, feedbackQueries, rosterMembers]);

  // Gap 19: estado real de runner_session por atleta ('wip'/'finished'/
  // 'interrupted'), resuelto por REST -- no hay evento WS para esto, así que
  // es polling (mismo criterio que AttendanceSessionModal, 6s). Es la fuente
  // autoritativa de "completó todo"/"interrumpió" en displayStatus -- antes
  // de esto, el entrenador solo tenía la inferencia por resolvedSetCount, que
  // podía mostrar "Completó todo" para alguien que canceló antes de terminar.
  const runnerStatusQueries = useQueries({
    queries: (rosterMembers ?? []).map((member) => ({
      queryKey: runnerSessionQueryKey(sessionInstanceId, member.userId),
      queryFn: async () => {
        try {
          const res = await getRunnerSession(sessionInstanceId, member.userId);
          return toRunnerSessionModel(res?.data ?? null);
        } catch (error) {
          if (error.status === 404) return null;
          throw error;
        }
      },
      enabled: Boolean(sessionInstanceId && member.userId),
      refetchInterval: 6000,
    })),
  });

  useEffect(() => {
    (rosterMembers ?? []).forEach((member, index) => {
      const runnerSession = runnerStatusQueries[index]?.data;
      if (!runnerSession) return;
      setParticipants((current) => applyRunnerStatus(current, member.userId, runnerSession.status));
    });
  }, [rosterMembers, runnerStatusQueries]);

  const gps = useSessionGpsTracker(gpsEnabled);

  useEffect(() => {
    if (!channel) return undefined;
    logDebug(`[trainer-live] gps.start() canal=${channel} gpsEnabled=${gpsEnabled}`);
    gps.start({
      onPoint: (point) => {
        send('presence', undefined, { event: 'position', payload: { latitude: point.latitude, longitude: point.longitude } });
        setSelfPosition({ latitude: point.latitude, longitude: point.longitude, ts: point.timestamp ?? Date.now() });
      },
    });
    return () => { gps.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const finalize = async () => {
    logDebug('[trainer-live] finalize -- control:session_finished a todo el canal');
    send('control', undefined, { event: 'session_finished', to: 'all', payload: {} });
    // Gap 26: el slide-to-finish ES el cierre de la sesión presencial del
    // lado del backend (self, PATCH status:'finished' sobre el propio
    // runner_session abierto al Play) -- sin esto, `closed_at` nunca se
    // setea y la sesión queda "abierta" para siempre del lado del backend.
    try {
      await finishRunnerSession(sessionInstanceId);
      logDebug(`[trainer-live] sesión presencial cerrada (session_instance=${sessionInstanceId})`);
    } catch (error) {
      logDebug(`[trainer-live] ERROR cerrando sesión presencial: ${error?.message ?? error}`);
    }
  };

  return { connectionStatus, participants, feed, gpsEnabled, selfPosition, finalize };
}
