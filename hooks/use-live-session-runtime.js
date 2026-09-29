import { useEffect, useRef, useState } from 'react';
import { useSessionRuntimeStore } from '../store/session-runtime-store.js';
import { useLiveSessionStore } from '../store/live-session-store.js';
import { useAuthStore } from '../store/auth-store.js';
import {
  cancelRun,
  createRun,
  finalizeRun,
  finishSet as finishSetDb,
  getActiveRun,
  getRun,
  getSetsForRun,
  initSessionDb,
  insertGpsPoint,
  interruptStartedSets,
  markSetInterrupted,
  markSetSkipped,
  markSetStarted,
  skipSetsForExercise,
  updateSetDistance,
  updateSetTimings,
} from '../services/session-db.js';
import { syncRun } from '../services/session-sync.js';
import { acceptGpsLeg } from '../utils/distance.js';
import { toIsoUtc } from '../utils/time.js';
import { useSessionGpsTracker } from './use-session-gps-tracker.js';
import { useRealtimeChannel } from './use-realtime-channel.js';

// Motor no-visual de la pantalla presencial en vivo (Task 10 la consume).
// GPS continuo: TODO punto aceptado se manda en vivo por WS
// (presence:position, sin importar si hay serie activa) -- la persistencia
// durable sigue el timing de siempre (solo cuando una serie TERMINA), vía
// syncRun sin modificar, llamado por serie en vez de solo al final.
export function useLiveSessionRuntime() {
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const gpsEnabled = useLiveSessionStore((s) => s.gpsEnabled);
  const setSessionStarted = useLiveSessionStore((s) => s.setSessionStarted);
  const userId = useAuthStore((s) => s.userId);

  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState(null);
  const [run, setRun] = useState(null);
  const [sets, setSets] = useState([]);
  const [distanceBySetId, setDistanceBySetId] = useState(new Map());
  const [pendingControl, setPendingControl] = useState(null);

  const activeSetIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const pointOrderRef = useRef(0);
  // Acumulador real por set-id, en un ref -- handleGpsPoint se pasa a
  // gps.start() UNA sola vez (el efecto de abajo corre solo al bootear), así
  // que cualquier valor leído de useState ahí quedaría pegado al snapshot de
  // ese momento para siempre. distanceBySetId (state) es solo el espejo para
  // renderizar -- la cuenta real vive acá.
  const distanceRef = useRef(new Map());

  const channel = run ? `session:${run.session_instance_id}` : null;

  const handleChannelMessage = (msg) => {
    if (msg.type !== 'control') return;
    setPendingControl({ event: msg.event, payload: msg.payload });
  };

  const { status: connectionStatus, send } = useRealtimeChannel(channel, {
    onMessage: handleChannelMessage,
    enabled: Boolean(channel),
  });

  const gps = useSessionGpsTracker(gpsEnabled);

  const reloadSets = async (runId) => {
    const all = await getSetsForRun(runId);
    setSets(all);
    return all;
  };

  const bootstrap = async () => {
    try {
      await initSessionDb();
      const sessionInstance = pendingSession.sessionInstance;
      const sessionDate = pendingSession.date;
      let runRow = await getActiveRun(sessionInstance.id, sessionDate, userId);
      if (!runRow) {
        const createdId = await createRun({
          sessionInstanceId: sessionInstance.id,
          sessionName: sessionInstance.name ?? 'Entrenamiento',
          sessionDate,
          teamId: pendingSession.teamId,
          userId,
          gpsEnabled,
          exercises: sessionInstance.exercises ?? [],
        });
        runRow = await getRun(createdId);
      }
      setSessionStarted(runRow.id, Boolean(runRow.gps_enabled));
      setRun(runRow);
      await reloadSets(runRow.id);
      setBooted(true);
    } catch (error) {
      setBootError(error);
    }
  };

  useEffect(() => {
    if (pendingSession) bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSession]);

  const handleGpsPoint = async (point) => {
    // Movimiento en vivo: SIEMPRE, haya o no serie activa -- efímero, nunca
    // se persiste. Ver spec 2026-09-28, sección "GPS continuo".
    send('presence', undefined, { event: 'position', payload: { latitude: point.latitude, longitude: point.longitude } });

    const setId = activeSetIdRef.current;
    if (!setId) return; // sin serie activa: solo el broadcast de arriba, nada más

    if (!lastPointRef.current) {
      lastPointRef.current = point;
      pointOrderRef.current = 0;
      await insertGpsPoint(setId, 0, point.latitude, point.longitude, point.timestamp ?? Date.now());
      distanceRef.current.set(setId, 0);
      setDistanceBySetId(new Map(distanceRef.current));
      await updateSetDistance(setId, 0);
      return;
    }
    const leg = acceptGpsLeg({ from: lastPointRef.current, to: point });
    if (leg == null) return;
    lastPointRef.current = point;
    pointOrderRef.current += 1;
    await insertGpsPoint(setId, pointOrderRef.current, point.latitude, point.longitude, point.timestamp ?? Date.now());
    if (leg > 0) {
      const nextTotal = (distanceRef.current.get(setId) ?? 0) + leg;
      distanceRef.current.set(setId, nextTotal);
      setDistanceBySetId(new Map(distanceRef.current));
      await updateSetDistance(setId, nextTotal);
    }
  };

  useEffect(() => {
    if (!booted) return undefined;
    gps.start({ onPoint: handleGpsPoint });
    return () => { gps.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  const syncIncrementally = () => {
    if (run) syncRun(run.id).catch(() => {}); // fire-and-forget, mismo patrón que createRunnerSession en el pre-start
  };

  const startSet = async (setId) => {
    activeSetIdRef.current = setId;
    lastPointRef.current = null;
    pointOrderRef.current = 0;
    await markSetStarted(setId, toIsoUtc());
    await reloadSets(run.id);
  };

  const finishSet = async (setId, { wallMs, activeMs }) => {
    const distance = distanceRef.current.get(setId) ?? null;
    await finishSetDb(setId, { endedAtIso: toIsoUtc(), durationMs: wallMs, activeDurationMs: activeMs, distanceMeters: distance });
    activeSetIdRef.current = null;
    lastPointRef.current = null;
    await reloadSets(run.id);
    syncIncrementally();
  };

  const skipSet = async (setId) => {
    await markSetSkipped(setId);
    if (activeSetIdRef.current === setId) {
      activeSetIdRef.current = null;
      lastPointRef.current = null;
    }
    await reloadSets(run.id);
    syncIncrementally();
  };

  const skipExercise = async (exerciseInstanceId) => {
    await skipSetsForExercise(run.id, exerciseInstanceId);
    activeSetIdRef.current = null;
    lastPointRef.current = null;
    await reloadSets(run.id);
    syncIncrementally();
  };

  const pauseSet = async (setId, { wallMs, activeMs }) => {
    await updateSetTimings(setId, { durationMs: wallMs, activeDurationMs: activeMs });
    await reloadSets(run.id);
  };

  const cancelSession = async () => {
    await interruptStartedSets(run.id);
    await cancelRun(run.id);
    syncIncrementally();
  };

  const finalizeSession = async () => {
    await finalizeRun(run.id);
    syncIncrementally();
  };

  return {
    booted,
    bootError,
    run,
    sets,
    connectionStatus,
    pendingControl,
    clearPendingControl: () => setPendingControl(null),
    distanceBySetId,
    startSet,
    finishSet,
    skipSet,
    skipExercise,
    pauseSet,
    cancelSession,
    finalizeSession,
  };
}
