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
  markSetSkipped,
  markSetStarted,
  skipSetsForExercise,
  updateSetDistance,
  updateSetTimings,
} from '../services/session-db.js';
import { syncRun } from '../services/session-sync.js';
import { send as sendRaw } from '../services/realtime-client.js';
import { acceptGpsLeg } from '../utils/distance.js';
import { toIsoUtc } from '../utils/time.js';
import { useSessionGpsTracker } from './use-session-gps-tracker.js';
import { useRealtimeChannel } from './use-realtime-channel.js';
import { useStopwatch } from './use-stopwatch.js';
import { logDebug } from '../utils/debug-log.js';

// Motor no-visual de la pantalla presencial en vivo (Task 10 la consume).
// GPS continuo: TODO punto aceptado se manda en vivo por WS
// (presence:position, sin importar si hay serie activa) -- la persistencia
// durable sigue el timing de siempre (solo cuando una serie TERMINA), vía
// syncRun sin modificar, llamado por serie en vez de solo al final.
//
// El cronómetro/fase de la serie activa vive ACÁ (no en cada fila de la
// pantalla, a diferencia de un primer borrador) -- así un control remoto
// (control:session_paused del entrenador) puede pausarlo sin importar qué
// fila esté montada, y cada transición (started/paused/finished/skipped) se
// puede avisar en vivo por el mismo canal, no solo lo que ya se persistió.
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
  const [activeSetId, setActiveSetIdState] = useState(null);
  const [activePhase, setActivePhaseState] = useState('idle'); // 'idle' | 'running' | 'paused'

  const stopwatch = useStopwatch();

  const activeSetIdRef = useRef(null);
  const activePhaseRef = useRef('idle');
  const lastPointRef = useRef(null);
  const pointOrderRef = useRef(0);
  const pausedSnapshotRef = useRef({ wallMs: 0, activeMs: 0 });
  // Acumulador real por set-id, en un ref -- handleGpsPoint se pasa a
  // gps.start() UNA sola vez (el efecto de abajo corre solo al bootear), así
  // que cualquier valor leído de useState ahí quedaría pegado al snapshot de
  // ese momento para siempre. distanceBySetId (state) es solo el espejo para
  // renderizar -- la cuenta real vive acá. activeSetIdRef/activePhaseRef
  // siguen el mismo criterio y por la misma razón (los lee handleGpsPoint).
  const distanceRef = useRef(new Map());

  const setActiveSet = (setId) => {
    activeSetIdRef.current = setId;
    setActiveSetIdState(setId);
  };

  const setPhase = (phase) => {
    activePhaseRef.current = phase;
    setActivePhaseState(phase);
  };

  const channel = run ? `session:${run.session_instance_id}` : null;

  const broadcastSetStatus = (payload) => {
    send('presence', undefined, { event: 'set_status', payload });
  };

  // `setId` es un id LOCAL de SQLite -- sin significado para el entrenador,
  // que no tiene esa base. exerciseInstanceId/exerciseName/setNumber sí
  // vienen del backend (misma fila ya cargada acá) y son lo que le permite al
  // entrenador mostrar "Sentadillas · Serie 2" en vez de nada (bug real,
  // 2026-10-01: "no puedo ver la serie o ejercicio que se está realizando").
  const setMeta = (setId) => {
    const row = sets.find((s) => s.id === setId);
    if (!row) return {};
    // row.set_number es 0-indexado en el almacenamiento local (ver
    // session-db.js#createRun, `for (let setNumber = 0; ...)`) -- mismo
    // criterio ya documentado en utils/session-sync-payload.js, "Serie N" en
    // pantalla siempre le suma 1. Sin este +1, un ejercicio de UNA sola serie
    // (setNumber local 0) le aparecía al entrenador como "Serie 0" (bug real,
    // 2026-10-03).
    return { exerciseInstanceId: row.exercise_instance_id, exerciseName: row.exercise_name, setNumber: row.set_number + 1 };
  };

  const handleChannelMessage = (msg) => {
    if (msg.type !== 'control') return;
    setPendingControl({ event: msg.event, payload: msg.payload });
    // El entrenador pausa remotamente pausando la serie que esté corriendo
    // en ESTE momento -- misma acción que el botón local de pausa, no hay
    // "reanudar" remoto en esta spec (ver nota de alcance en Task 10).
    if (msg.event === 'session_paused') pauseSet();
  };

  // joined/left van por sendRaw (no por el `send` que devuelve este mismo
  // hook -- todavía no existe en este punto) y se disparan DENTRO del efecto
  // de suscripción del hook (onSubscribed/onBeforeUnsubscribe), no en un
  // efecto propio aparte -- ver el comentario en use-realtime-channel.js.
  const { status: connectionStatus, send } = useRealtimeChannel(channel, {
    onMessage: handleChannelMessage,
    enabled: Boolean(channel),
    onSubscribed: () => sendRaw(channel, 'presence', undefined, { event: 'joined', payload: {} }),
    onBeforeUnsubscribe: () => sendRaw(channel, 'presence', undefined, { event: 'left', payload: {} }),
  });

  const gps = useSessionGpsTracker(gpsEnabled);

  const reloadSets = async (runId) => {
    const all = await getSetsForRun(runId);
    setSets(all);
    return all;
  };

  const bootstrap = async () => {
    const startedAt = Date.now();
    logDebug('[live] bootstrap start');
    try {
      await initSessionDb();
      const sessionInstance = pendingSession.sessionInstance;
      const sessionDate = pendingSession.date;
      let runRow = await getActiveRun(sessionInstance.id, sessionDate, userId);
      logDebug(`[live] getActiveRun -> ${runRow ? `reuso run=${runRow.id}` : 'sin run existente, voy a crear uno'} (${Date.now() - startedAt}ms)`);
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
        logDebug(`[live] createRun -> run=${createdId} (${Date.now() - startedAt}ms)`);
      }
      setSessionStarted(runRow.id, Boolean(runRow.gps_enabled));
      setRun(runRow);
      await reloadSets(runRow.id);
      setBooted(true);
      logDebug(`[live] bootstrap OK total=${Date.now() - startedAt}ms`);
    } catch (error) {
      logDebug(`[live] bootstrap ERROR (${Date.now() - startedAt}ms): ${error.message}`);
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
    // Los puntos que caen mientras la serie está en PAUSA no suman distancia
    // -- mismo criterio que async (ahí el GPS se corta del todo en pausa).
    // Acá el tracker es de toda la sesión y no se detiene, así que el filtro
    // se hace por fase (leída del ref, no del state -- ver comentario de
    // distanceRef arriba, misma razón).
    if (!setId || activePhaseRef.current !== 'running') return;

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
    logDebug(`[live] gps.start() gpsEnabled=${gpsEnabled}`);
    gps.start({ onPoint: handleGpsPoint });
    return () => { gps.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  const syncIncrementally = () => {
    if (!run) return;
    logDebug(`[live] syncRun(${run.id}) disparado`);
    // Fire-and-forget, mismo patrón que createRunnerSession en el pre-start --
    // pero logueamos el resultado igual, para poder confirmar en los logs de
    // dispositivo si el feedback de cada serie efectivamente sube (y cuántas
    // quedaron sin sincronizar si algo falló).
    syncRun(run.id)
      .then((result) => logDebug(`[live] syncRun(${run.id}) OK synced=${result.synced} conflicts=${result.conflicts} errors=${result.errors.length}`))
      .catch((error) => logDebug(`[live] syncRun(${run.id}) ERROR ${error.message}`));
  };

  const startSet = async (setId) => {
    logDebug(`[live] startSet(${setId})`);
    setActiveSet(setId);
    lastPointRef.current = null;
    pointOrderRef.current = 0;
    pausedSnapshotRef.current = { wallMs: 0, activeMs: 0 };
    stopwatch.start();
    setPhase('running');
    await markSetStarted(setId, toIsoUtc());
    await reloadSets(run.id);
    broadcastSetStatus({ setId, status: 'started', ...setMeta(setId) });
  };

  // Pausa la serie activa -- la llama tanto el propio corredor (botón
  // Pausar) como un control:session_paused remoto del entrenador. No-op si
  // no hay ninguna serie corriendo en este momento.
  const pauseSet = async () => {
    const setId = activeSetIdRef.current;
    if (!setId || activePhaseRef.current !== 'running') return;
    logDebug(`[live] pauseSet(${setId})`);
    const snap = stopwatch.pause();
    pausedSnapshotRef.current = snap;
    await updateSetTimings(setId, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
    setPhase('paused');
    await reloadSets(run.id);
    broadcastSetStatus({ setId, status: 'paused', ...setMeta(setId) });
  };

  // Reanudar es siempre una acción del propio corredor -- no hay "reanudar"
  // remoto en esta spec, el entrenador solo puede pausar (ver Task 10).
  const resumeSet = async () => {
    const setId = activeSetIdRef.current;
    if (!setId || activePhaseRef.current !== 'paused') return;
    logDebug(`[live] resumeSet(${setId})`);
    stopwatch.resumeFrom(pausedSnapshotRef.current);
    setPhase('running');
    broadcastSetStatus({ setId, status: 'started', ...setMeta(setId) });
  };

  const finishSet = async (setId) => {
    logDebug(`[live] finishSet(${setId})`);
    const snap = activePhaseRef.current === 'running' ? stopwatch.pause() : pausedSnapshotRef.current;
    const distance = distanceRef.current.get(setId) ?? null;
    await finishSetDb(setId, { endedAtIso: toIsoUtc(), durationMs: snap.wallMs, activeDurationMs: snap.activeMs, distanceMeters: distance });
    setActiveSet(null);
    setPhase('idle');
    lastPointRef.current = null;
    await reloadSets(run.id);
    broadcastSetStatus({ setId, status: 'finished' });
    syncIncrementally();
    // La pantalla necesita el snapshot para el resumen post-serie -- para
    // entonces el cronómetro del hook ya se reinició, así que se devuelve acá.
    return { wallMs: snap.wallMs, activeMs: snap.activeMs, distanceMeters: distance };
  };

  // Devuelven el array de sets recién recargado -- el caller (la pantalla)
  // lo necesita para decidir "cuál es la próxima serie" sin depender de la
  // variable `sets` de su propio closure, que en este flujo queda desactualizada
  // (bug real, 2026-09-30: `advance()` corría con el `sets` de ANTES del
  // saltear, encontraba la serie recién salteada como si siguiera "pending" y
  // volvía a abrir esa misma serie -- ya con su status real (`skipped`), sin
  // ningún botón visible porque ninguno de los bloques de control matchea ese
  // status). El flujo de Completar en regla no sufre esto porque el avance
  // lo dispara el usuario recién al cerrar el modal de resumen, momento en el
  // que la pantalla ya tuvo tiempo de re-renderizar con el `sets` fresco.
  const skipSet = async (setId) => {
    logDebug(`[live] skipSet(${setId})`);
    await markSetSkipped(setId);
    if (activeSetIdRef.current === setId) {
      setActiveSet(null);
      setPhase('idle');
      lastPointRef.current = null;
    }
    const updated = await reloadSets(run.id);
    broadcastSetStatus({ setId, status: 'skipped' });
    syncIncrementally();
    return updated;
  };

  const skipExercise = async (exerciseInstanceId) => {
    await skipSetsForExercise(run.id, exerciseInstanceId);
    setActiveSet(null);
    setPhase('idle');
    lastPointRef.current = null;
    const updated = await reloadSets(run.id);
    // A diferencia de skipSet (una serie puntual), esto puede afectar varias
    // series del mismo ejercicio a la vez -- un único aviso a nivel
    // ejercicio en vez de uno por serie.
    broadcastSetStatus({ exerciseInstanceId, status: 'skipped', scope: 'exercise' });
    syncIncrementally();
    return updated;
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
    activeSetId,
    activePhase,
    stopwatchWallMs: stopwatch.wallMs,
    stopwatchActiveMs: stopwatch.activeMs,
    startSet,
    pauseSet,
    resumeSet,
    finishSet,
    skipSet,
    skipExercise,
    cancelSession,
    finalizeSession,
  };
}
