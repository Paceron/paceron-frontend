import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { formatStopwatch, toIsoUtc } from '../../utils/time.js';
import { acceptGpsLeg, formatMeters } from '../../utils/distance.js';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/haptics.js';
import {
  cancelRun,
  createRun,
  finalizeRun,
  finishSet,
  getActiveRun,
  getRun,
  getSetsForRun,
  initSessionDb,
  insertGpsPoint,
  interruptStartedSets,
  markSetInterrupted,
  markSetStarted,
  updateSetDistance,
  updateSetTimings,
} from '../../services/session-db.js';
import { syncRun } from '../../services/session-sync.js';
import { useStopwatch } from '../../hooks/use-stopwatch.js';
import { useGpsTracker } from '../../hooks/use-gps-tracker.js';
import { useCompetitionDetail } from '../../hooks/use-competitions.js';
import { logDebug } from '../../utils/debug-log.js';
import { computeRouteTimeoutMs, distanceToRouteMeters, totalRouteMeters } from '../../utils/route-geometry.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

const COUNTDOWN_GIF_BG = '#979597';

function CountdownOverlay({ value, onCancelCountdown }) {
  return (
    <View className="absolute inset-0 z-20 items-center justify-center rounded-3xl bg-black/70" nativeID="route-attempt-live-countdown-overlay" testID="route-attempt-live-countdown-overlay">
      <View
        className="mb-5 overflow-hidden rounded-2xl px-5 py-3"
        nativeID="route-attempt-live-countdown-overlay-animation-plate"
        style={{ backgroundColor: COUNTDOWN_GIF_BG }}
        testID="route-attempt-live-countdown-overlay-animation-plate"
      >
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Animación de un corredor corriendo"
          contentFit="contain"
          nativeID="route-attempt-live-countdown-overlay-animation"
          resizeMode="contain"
          source={require('../../assets/paceron-runner-waiting.gif')}
          style={{ height: 64, width: 114 }}
          testID="route-attempt-live-countdown-overlay-animation"
        />
      </View>
      <Text className="text-base font-semibold uppercase tracking-wide text-white/80" nativeID="route-attempt-live-countdown-overlay-label" testID="route-attempt-live-countdown-overlay-label">Empezamos en</Text>
      <Text className="mt-2 text-8xl text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="route-attempt-live-countdown-overlay-value" testID="route-attempt-live-countdown-overlay-value">{value}</Text>
      <Pressable className="mt-6 h-9 items-center justify-center rounded-full border border-white/30 px-4" nativeID="route-attempt-live-countdown-overlay-cancel" onPress={onCancelCountdown} testID="route-attempt-live-countdown-overlay-cancel">
        <Text className="text-xs font-semibold text-white" nativeID="route-attempt-live-countdown-overlay-cancel-label" testID="route-attempt-live-countdown-overlay-cancel-label">Cancelar inicio</Text>
      </Pressable>
    </View>
  );
}

// Mismas 3 copias ya duplicadas en training-session-active-screen.jsx/
// training-session-live-screen.jsx/trainer-session-live-screen.jsx -- 4ta
// copia deliberada, no se consolida en este sub-proyecto (ver spec, sección
// Arquitectura). Fondo sólido desde el día uno (a diferencia de las otras 3,
// que lo tenían transparente hasta Task 5 de este plan).
const DRAG_VARIANTS = {
  finish: {
    trackBorder: 'border-emerald-300 dark:border-emerald-800/70',
    // trackBg: tono suave del color de la variante en reposo -- pedido
    // real 2026-10-20: con el track en bg-white/surface fijo, la única
    // pista de color era el `fill` semitransparente creciendo con el
    // drag, casi invisible en tema claro ("los veo con relleno blanco").
    trackBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    fill: 'bg-emerald-500/45',
    thumb: 'bg-emerald-500/70 border border-emerald-600/60',
    iconColor: '#ffffff',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
  neutral: {
    trackBorder: 'border-slate-200 dark:border-slate-700/60',
    trackBg: 'bg-slate-100 dark:bg-slate-800/40',
    fill: 'bg-slate-400/45',
    thumb: 'bg-slate-300/80 border border-slate-400/60',
    iconColor: '#ffffff',
    label: 'text-slate-500 dark:text-slate-400',
  },
  // Reanudar -- mismo verde-lima que el botón "Reanudar" original
  // (bg-primary) que este slider reemplaza, no el verde esmeralda de
  // "finish" (los dos comparten fila y necesitan distinguirse por color).
  resume: {
    trackBorder: 'border-primary/50 dark:border-primary/40',
    trackBg: 'bg-primary-tint-subtle dark:bg-primary/10',
    fill: 'bg-primary/45',
    thumb: 'bg-primary border border-[#6b9c2f]',
    iconColor: '#111518',
    label: 'text-primary',
  },
};

function DragToFinishButton({ onTrigger, disabled, idPrefix, label, icon = 'flag-checkered', variant = 'finish' }) {
  const THUMB_SIZE = 64;
  const colors = DRAG_VARIANTS[variant] || DRAG_VARIANTS.finish;
  const translateX = useSharedValue(0);
  const widthSV = useSharedValue(120);
  const triggerRef = useRef(onTrigger);
  const triggeredRef = useRef(false);
  triggerRef.current = onTrigger;

  const fillStyle = useAnimatedStyle(() => ({ width: translateX.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  // Hint de "esto se arrastra" -- pedido real 2026-10-20: con el label corto
  // ("Pausar"/"Finalizar") ya legible, hacía falta algo que siga indicando
  // que el control es deslizable, no un botón. Chevrones en loop sutil,
  // se apagan apenas el drag real arranca (`translateX.value` crece) para
  // no competir visualmente con el thumb en movimiento.
  const hintX = useSharedValue(0);
  useEffect(() => {
    hintX.value = withRepeat(withTiming(8, { duration: 550, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [hintX]);
  const hintStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: hintX.value }],
    opacity: interpolate(translateX.value, [0, 24], [1, 0], 'clamp'),
  }));

  const pan = useMemo(() => {
    let p = Gesture.Pan().runOnJS(true);
    if (disabled) p = p.enabled(false);
    return p
      .onStart(() => { triggeredRef.current = false; })
      .onUpdate((e) => {
        if (triggeredRef.current) return;
        const maxX = (widthSV.value || 120) - THUMB_SIZE;
        translateX.value = Math.max(0, Math.min(maxX, e.translationX));
        if (e.translationX >= maxX) {
          triggeredRef.current = true;
          triggerRef.current();
        }
      })
      .onEnd((e) => {
        if (triggeredRef.current) return;
        const maxX = (widthSV.value || 120) - THUMB_SIZE;
        if (e.translationX >= maxX) {
          triggeredRef.current = true;
          triggerRef.current();
        } else {
          translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
        }
      })
      .onFinalize(() => {
        if (!triggeredRef.current) translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return (
    <GestureDetector gesture={pan}>
      {/* Sin flex-1 propio -- bug real reportado 2026-10-20: este componente
          se usa tanto suelto (hijo directo de una columna, fase `paused`)
          como de a dos en una fila (fase `running`). `flex-1` adentro de
          una COLUMNA no reparte ancho -- hace crecer el alto para llenar el
          espacio vertical restante, haciendo que el slider de finalizar
          invadiera visualmente el HoldToCancelButton de abajo ("detrás del
          mantener presionado"). El ancho completo en el caso suelto ya sale
          gratis del stretch por default de una columna (mismo patrón ya
          usado en trainer-session-live-screen.jsx); para el caso de fila,
          el flex-1 ahora vive en el wrapper del call site, no acá. */}
      <View
        className={`h-24 rounded-full border ${colors.trackBg} ${colors.trackBorder} ${disabled ? 'opacity-50' : ''}`}
        nativeID={`${idPrefix}-drag-track`}
        onLayout={(event) => { widthSV.value = Math.round(event.nativeEvent.layout.width); }}
        testID={`${idPrefix}-drag-track`}
      >
        <Animated.View className={`absolute inset-y-0 left-0 rounded-full ${colors.fill}`} nativeID={`${idPrefix}-drag-fill`} style={fillStyle} testID={`${idPrefix}-drag-fill`} />
        <Animated.View className={`absolute left-0.5 top-4 h-16 w-16 items-center justify-center rounded-full ${colors.thumb}`} nativeID={`${idPrefix}-drag-thumb`} style={thumbStyle} testID={`${idPrefix}-drag-thumb`}>
          <MaterialCommunityIcons color={colors.iconColor} name={icon} size={26} />
        </Animated.View>
        {/* Padding asimétrico, no px-20 simétrico: el thumb (w-16, 64px) solo
            descansa a la izquierda -- pl-20 le da margen de sobra ahí, pr-3
            alcanza porque ese lado nunca lo tapa nada. Bug real reportado
            2026-10-20: con padding simétrico, en el layout de dos sliders
            lado a lado (pausar+finalizar) el padding solo ya consumía casi
            todo el ancho disponible y el label truncaba a "...". */}
        <View className="absolute inset-0 items-center justify-center pl-20 pr-3" nativeID={`${idPrefix}-drag-content`} pointerEvents="none" testID={`${idPrefix}-drag-content`}>
          {/* Hint ANTES del texto (no absolute aparte) -- pedido real
              2026-10-20: separado y pegado al borde derecho, quedaba
              encima del label en el layout angosto de dos sliders.
              Adentro del mismo flex-row, en flujo normal, nunca compite
              espacio con el texto -- lo precede nomás. */}
          <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-drag-label-row`} testID={`${idPrefix}-drag-label-row`}>
            <Animated.View nativeID={`${idPrefix}-drag-hint`} style={hintStyle} testID={`${idPrefix}-drag-hint`}>
              <MaterialCommunityIcons color="#94a3b8" name="chevron-double-right" size={16} />
            </Animated.View>
            <Text className={`text-center text-base font-bold uppercase tracking-wide ${colors.label}`} nativeID={`${idPrefix}-drag-label`} numberOfLines={1} testID={`${idPrefix}-drag-label`}>{label}</Text>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

// Más chico y menos prominente que los sliders a propósito -- de-énfasis
// visual pedido en la spec (sigue siendo la única salida deliberada
// mientras haya un solo intento permitido, pero no compite con finalizar).
function HoldToCancelButton({ onTrigger, disabled, idPrefix }) {
  const HOLD_MS = 900;
  const colors = useThemeColors();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const stopHold = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setHolding(false);
    setProgress(0);
  };

  const startHold = () => {
    if (disabled) return;
    firedRef.current = false;
    setHolding(true);
    setProgress(0);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const next = Math.min(1, (Date.now() - startedAt) / HOLD_MS);
      setProgress(next);
      if (next >= 1) {
        stopHold();
        if (!firedRef.current) { firedRef.current = true; onTrigger(); }
      }
    }, 40);
  };

  return (
    <Pressable
      className={`min-h-10 flex-row items-center justify-center gap-2 self-center rounded-full border border-red-300 bg-red-50 px-4 dark:border-red-900/60 dark:bg-red-950/40 ${disabled ? 'opacity-50' : ''}`}
      disabled={disabled}
      nativeID={`${idPrefix}-cancel-button`}
      onPressIn={startHold}
      onPressOut={stopHold}
      testID={`${idPrefix}-cancel-button`}
    >
      {holding && (
        <View className="h-1.5 w-12 overflow-hidden rounded-full bg-red-200 dark:bg-red-950" nativeID={`${idPrefix}-cancel-progress-track`} testID={`${idPrefix}-cancel-progress-track`}>
          <View className="h-full rounded-full bg-red-600" nativeID={`${idPrefix}-cancel-progress`} style={{ width: `${Math.round(progress * 100)}%` }} testID={`${idPrefix}-cancel-progress`} />
        </View>
      )}
      <MaterialCommunityIcons color={colors.error} name="stop-circle-outline" size={16} />
      <Text className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400" nativeID={`${idPrefix}-cancel-button-label`} testID={`${idPrefix}-cancel-button-label`}>
        {holding ? 'Soltá para cancelar' : 'Mantené para cancelar'}
      </Text>
    </Pressable>
  );
}

function ConfirmCancelModal({ visible, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (visible) notifyWarning(); }, [visible]);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => { if (!loading) onCancel(); };

  return (
    <Modal animationType="fade" nativeID="route-attempt-live-cancel-modal" onRequestClose={handleCancel} testID="route-attempt-live-cancel-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="route-attempt-live-cancel-modal-backdrop" onPress={handleCancel} testID="route-attempt-live-cancel-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="route-attempt-live-cancel-modal-card" onPress={() => {}} testID="route-attempt-live-cancel-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="route-attempt-live-cancel-modal-header" testID="route-attempt-live-cancel-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="stop-circle-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="route-attempt-live-cancel-modal-title" testID="route-attempt-live-cancel-modal-title">Cancelar intento</Text>
          </View>
          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="route-attempt-live-cancel-modal-description" testID="route-attempt-live-cancel-modal-description">
            Vas a cancelar tu intento de esta competencia. Lo recorrido hasta ahora queda guardado, pero no se puede reanudar después de confirmar.
          </Text>
          <View className="mt-5 flex-row gap-3" nativeID="route-attempt-live-cancel-modal-actions" testID="route-attempt-live-cancel-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              disabled={loading}
              nativeID="route-attempt-live-cancel-modal-cancel-button"
              onPress={handleCancel}
              testID="route-attempt-live-cancel-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="route-attempt-live-cancel-modal-cancel-label" testID="route-attempt-live-cancel-modal-cancel-label">Seguir corriendo</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 active:opacity-80"
              disabled={loading}
              nativeID="route-attempt-live-cancel-modal-confirm-button"
              onPress={handleConfirm}
              testID="route-attempt-live-cancel-modal-confirm-button"
            >
              {loading ? <ActivityIndicator color="#ffffff" size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="route-attempt-live-cancel-modal-confirm-label" testID="route-attempt-live-cancel-modal-confirm-label">Cancelar intento</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RouteAttemptLiveScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const setSessionStarted = useLiveSessionStore((s) => s.setSessionStarted);
  const clearLiveSession = useLiveSessionStore((s) => s.clearLiveSession);
  const routeAttempt = pendingSession?.routeAttempt ?? null;

  const [booted, setBooted] = useState(false);
  const [run, setRun] = useState(null);
  const [set, setSet] = useState(null);
  const [phase, setPhase] = useState('ready'); // ready -> countdown -> running <-> paused
  const [countdown, setCountdown] = useState(3);
  const [distance, setDistance] = useState(null);
  const [tracePoints, setTracePoints] = useState([]);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bypassingExit, setBypassingExit] = useState(false);

  const stopwatch = useStopwatch();
  const gps = useGpsTracker(true); // GPS ya es obligatorio para haber llegado a esta pantalla (gate del pre-start)

  const savedTimingsRef = useRef({ wallMs: 0, activeMs: 0 });
  // Timestamp real de arranque -- pedido real 2026-10-21: la pantalla de
  // detalle no mostraba fecha/hora en el camino local (recién terminado),
  // `markSetStarted` graba el timestamp en SQLite pero nunca quedaba en
  // memoria para mandarlo como param de navegación.
  const startedAtRef = useRef(null);
  const gpsActiveRef = useRef(false);
  const lastPointRef = useRef(null);
  const pointOrderRef = useRef(0);
  const distanceRef = useRef(null);
  const countdownRef = useRef(3);
  const countdownTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const offRouteStreakRef = useRef(0);
  const cancelingRef = useRef(false);
  const pendingExitRef = useRef(null);

  // Poll de status de competencia (Gap 33) mientras el intento está en
  // curso -- si se cierra/cancela desde otro lado (entrenador, u otro
  // participante que termina una competencia de 1-solo-ganador) mientras
  // este corredor sigue corriendo, se corta el intento en vez de dejarlo
  // avanzar hacia un resultado que el backend ya no va a aceptar. Hook
  // real (Rules of Hooks) -- va antes de los 2 early-return guards de
  // abajo, nunca después.
  const { detail: competitionDetail } = useCompetitionDetail(routeAttempt?.competitionId, {
    enabled: phase === 'running' || phase === 'paused',
    refetchInterval: (phase === 'running' || phase === 'paused') ? 15000 : false,
  });

  // Bootstrap -- subconjunto deliberadamente más simple que
  // training-session-active-screen.jsx#bootstrap: una competencia de ruta
  // SIEMPRE tiene 1 ejercicio/1 set (instancia sintética), así que no hay
  // mode='overview' ni multi-set que resolver.
  useEffect(() => {
    if (!pendingSession?.sessionInstance || !routeAttempt) return;
    (async () => {
      await initSessionDb();
      const sessionInstance = pendingSession.sessionInstance;
      let runRow = await getActiveRun(sessionInstance.id, pendingSession.date, userId);
      if (!runRow) {
        const createdId = await createRun({
          sessionInstanceId: sessionInstance.id,
          sessionName: sessionInstance.name ?? 'Corrida',
          sessionDate: pendingSession.date,
          teamId: pendingSession.teamId,
          userId,
          gpsEnabled: true,
          exercises: sessionInstance.exercises ?? [],
        });
        runRow = await getRun(createdId);
      }
      setSessionStarted(runRow.id, true);
      setRun(runRow);
      const sets = await getSetsForRun(runRow.id);
      const onlySet = sets[0];
      setSet(onlySet);
      setDistance(onlySet.distance_meters ?? null);
      distanceRef.current = onlySet.distance_meters ?? null;
      savedTimingsRef.current = { wallMs: onlySet.duration_ms ?? 0, activeMs: onlySet.active_duration_ms ?? 0 };
      if (onlySet.status === 'started' && !onlySet.ended_at) setPhase('paused');
      setBooted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si la competencia se cierra/cancela desde otro lado (entrenador, u
  // otro participante) mientras el intento sigue corriendo, se corta en
  // vez de dejarlo avanzar hacia un resultado que el backend ya no va a
  // aceptar. `handleCancelConfirmed` ya navega a goToResult() al terminar
  // -- una vez disparado, `phase` deja de ser running/paused (el guard de
  // arriba) y este efecto no vuelve a repetirse aunque competitionDetail
  // cambie de nuevo (el poll se desactiva también porque `enabled` cae a
  // false).
  useEffect(() => {
    if (!competitionDetail || competitionDetail.status === 'active') return;
    if (phase !== 'running' && phase !== 'paused') return;
    logDebug(`route-attempt-live competencia status="${competitionDetail.status}" -- cancelando`);
    setCancelVisible(false);
    handleCancelConfirmed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionDetail]);

  const handleGpsPoint = async ({ latitude, longitude, timestamp, accuracy }) => {
    if (!gpsActiveRef.current || !set) return;
    const point = { latitude, longitude, timestamp, accuracy };
    if (!lastPointRef.current) {
      lastPointRef.current = point;
      pointOrderRef.current = 0;
      await insertGpsPoint(set.id, 0, latitude, longitude, timestamp ?? Date.now());
      distanceRef.current = 0;
      setDistance(0);
      await updateSetDistance(set.id, 0);
      setTracePoints((prev) => [...prev, { latitude, longitude }]);
      return;
    }
    const leg = acceptGpsLeg({ from: lastPointRef.current, to: point });
    if (leg == null) return;
    lastPointRef.current = point;
    pointOrderRef.current += 1;
    await insertGpsPoint(set.id, pointOrderRef.current, latitude, longitude, timestamp ?? Date.now());
    setTracePoints((prev) => [...prev, { latitude, longitude }]);
    const driftMeters = distanceToRouteMeters({ lat: latitude, lng: longitude }, routeAttempt.route?.coordinates ?? []);
    const driftThreshold = routeAttempt.acceptanceRadiusMeters * 3;
    if (driftMeters > driftThreshold) {
      offRouteStreakRef.current += 1;
      if (offRouteStreakRef.current >= 3) {
        logDebug(`route-attempt-live alejamiento sostenido (${Math.round(driftMeters)}m > ${driftThreshold}m) -- cancelando`);
        setCancelVisible(false);
        handleCancelConfirmed();
        return;
      }
    } else {
      offRouteStreakRef.current = 0;
    }
    if (leg > 0) {
      const nextDistance = (distanceRef.current ?? 0) + leg;
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
      await updateSetDistance(set.id, nextDistance);
    }
  };

  const beginSet = async () => {
    try {
      const startedAtIso = toIsoUtc();
      startedAtRef.current = startedAtIso;
      await markSetStarted(set.id, startedAtIso);
      savedTimingsRef.current = { wallMs: 0, activeMs: 0 };
      stopwatch.start();
      setPhase('running');
      gpsActiveRef.current = true;
      pointOrderRef.current = 0;
      await gps.start({ onPoint: handleGpsPoint });
      const totalMeters = totalRouteMeters((routeAttempt.route?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })));
      timeoutTimerRef.current = setTimeout(() => {
        logDebug('route-attempt-live timeout -- finalizando como finish');
        handleFinish();
      }, computeRouteTimeoutMs(totalMeters));
    } catch (error) {
      logDebug('route-attempt-live beginSet error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos iniciar el intento', text2: error.message });
    } finally {
      setBusy(false);
    }
  };

  const startCountdown = () => {
    setPhase('countdown');
    countdownRef.current = 3;
    setCountdown(3);
    countdownTimerRef.current = setInterval(() => {
      const remaining = countdownRef.current - 1;
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setBusy(true);
        beginSet();
      } else {
        countdownRef.current = remaining;
        setCountdown(remaining);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    setPhase('ready');
    setCountdown(3);
  };

  const handlePlay = () => {
    if (busy) return;
    if (phase === 'ready') { startCountdown(); return; }
    if (phase === 'paused') {
      setBusy(true);
      stopwatch.resumeFrom(savedTimingsRef.current);
      setPhase('running');
      if (gpsActiveRef.current) {
        gps.start({ onPoint: handleGpsPoint }).finally(() => setBusy(false));
        const totalMeters = totalRouteMeters((routeAttempt.route?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })));
        timeoutTimerRef.current = setTimeout(() => { logDebug('route-attempt-live timeout -- finalizando como finish'); handleFinish(); }, computeRouteTimeoutMs(totalMeters));
      } else {
        setBusy(false);
      }
    }
  };

  const handlePause = async () => {
    if (phase !== 'running' || busy) return;
    setBusy(true);
    const snap = stopwatch.pause();
    savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
    await updateSetTimings(set.id, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
    await gps.stop();
    if (timeoutTimerRef.current) { clearTimeout(timeoutTimerRef.current); timeoutTimerRef.current = null; }
    setPhase('paused');
    setBusy(false);
  };

  // Navegación de salida deliberada (finish/cancel/auto-finalize) -- se
  // diferiere un render a través de `bypassingExit` en vez de llamar
  // router.replace() directo, porque en ese momento `phase` todavía es
  // running/paused y el guard de usePreventRemove de más abajo seguiría
  // interceptando la navegación como si fuera una salida sin confirmar
  // (mismo mecanismo que bypassGuard en use-unsaved-changes-guard.js).
  const goToResult = () => {
    clearLiveSession();
    pendingExitRef.current = () => router.replace({
      pathname: '/route-attempt-detail',
      params: {
        competitionId: routeAttempt.competitionId,
        setId: String(set.id),
        distanceMeters: String(distanceRef.current ?? 0),
        durationMs: String(savedTimingsRef.current.wallMs ?? 0),
        ...(startedAtRef.current ? { startedAt: startedAtRef.current } : {}),
      },
    });
    setBypassingExit(true);
  };

  const handleFinish = async () => {
    if ((phase !== 'running' && phase !== 'paused') || busy) return;
    setBusy(true);
    try {
      const snap = phase === 'running' ? stopwatch.pause() : savedTimingsRef.current;
      savedTimingsRef.current = snap;
      await gps.stop();
      if (timeoutTimerRef.current) { clearTimeout(timeoutTimerRef.current); timeoutTimerRef.current = null; }
      await finishSet(set.id, { endedAtIso: toIsoUtc(), durationMs: snap.wallMs, activeDurationMs: snap.activeMs, distanceMeters: distanceRef.current });
      await finalizeRun(run.id);
      const result = await syncRun(run.id);
      if (result.errors.length) {
        notifyError();
        Toast.show({ type: 'warning', text1: 'Intento finalizado', text2: 'Algunos datos no pudieron sincronizarse -- quedaron guardados en el dispositivo.' });
      } else {
        notifySuccess();
      }
      goToResult();
    } catch (error) {
      logDebug('route-attempt-live handleFinish error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos finalizar el intento', text2: error.message });
      setBusy(false);
    }
  };

  const handleCancelConfirmed = async () => {
    // Guard de reentrancia -- a partir de Task 7 hay 2 callers automáticos
    // (drift en handleGpsPoint, ~1/seg; competencia cerrada en el useEffect
    // de competitionDetail, ~cada 15s) sumados al botón manual. Esta
    // función no hace setPhase, así que el guard de running/paused de
    // ambos triggers sigue cumplido durante TODOS sus awaits -- sin esto,
    // los dos podrían solaparse y duplicar syncRun/Toast/router.replace.
    if (cancelingRef.current) return;
    cancelingRef.current = true;
    try {
      const snap = phase === 'running' ? stopwatch.pause() : savedTimingsRef.current;
      await gps.stop();
      if (timeoutTimerRef.current) { clearTimeout(timeoutTimerRef.current); timeoutTimerRef.current = null; }
      await markSetInterrupted(set.id, { endedAtIso: toIsoUtc(), durationMs: snap.wallMs, activeDurationMs: snap.activeMs, distanceMeters: distanceRef.current });
      await interruptStartedSets(run.id);
      await cancelRun(run.id);
      await syncRun(run.id);
      Toast.show({ type: 'info', text1: 'Intento cancelado' });
    } catch (error) {
      logDebug('route-attempt-live handleCancelConfirmed error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos cancelar el intento', text2: error.message });
    }
    goToResult();
  };

  // Dispara la navegación diferida de goToResult() recién después de que el
  // render con bypassingExit=true ya haya commiteado -- usePreventRemove lee
  // su argumento booleano al momento en que la navegación se dispatchea, no
  // al momento en que se pisa un ref, así que hace falta este efecto (mismo
  // patrón que use-unsaved-changes-guard.js).
  useEffect(() => {
    if (!bypassingExit || !pendingExitRef.current) return;
    const action = pendingExitRef.current;
    pendingExitRef.current = null;
    action();
  }, [bypassingExit]);

  // Intercepta el back nativo/gesto mientras hay un intento en curso -- sin
  // esto, volver a pre-start deja al corredor en una pantalla que reintentaría
  // POST /competitions/{id}/attempts (rechazado, sin reintentos v1) en vez de
  // simplemente cancelar lo que ya está corriendo. Mismo mecanismo que
  // useUnsavedChangesGuard usa en otras pantallas (usePreventRemove de
  // @react-navigation/native, ya viene con expo-router). `!bypassingExit`
  // deja pasar la navegación de salida deliberada que goToResult() dispara
  // (finish/cancel/auto-finalize) sin volver a mostrar el modal de cancelar.
  usePreventRemove((phase === 'running' || phase === 'paused') && !bypassingExit, () => setCancelVisible(true));

  if (!pendingSession || !routeAttempt) return <Redirect href="/" />;
  if (!booted || !set) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="route-attempt-live-screen-loading-root" testID="route-attempt-live-screen-loading-root">
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const showTimer = phase === 'running' || phase === 'paused';

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="route-attempt-live-screen-root" testID="route-attempt-live-screen-root">
      <View className="flex-1 px-4 pt-2" nativeID="route-attempt-live-screen-map-wrap" testID="route-attempt-live-screen-map-wrap">
        <LiveTrajectoryMap referenceRoute={routeAttempt.route} traveledPoints={tracePoints} />
      </View>

      <View className="items-center gap-1 px-4 py-2" nativeID="route-attempt-live-screen-stats-row" testID="route-attempt-live-screen-stats-row">
        <Text className="text-4xl" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="route-attempt-live-screen-timer" testID="route-attempt-live-screen-timer">
          {showTimer ? formatStopwatch(stopwatch.wallMs) : '00:00:00'}
        </Text>
        {/* Siempre montado (no condicionado a `distance != null`) -- bug
            real reportado 2026-10-20: cuando el primer fix de GPS llegaba,
            este Text aparecía de la nada y le robaba esa altura al mapa de
            arriba (`flex-1`, se achica cuando cualquier hermano no-flex
            crece) -- se sentía como que "el mapa se contrae de repente".
            Mostrar 0 m desde el arranque reserva la altura siempre. */}
        <Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-400" nativeID="route-attempt-live-screen-distance" testID="route-attempt-live-screen-distance">
          {formatMeters(distance ?? 0)}
        </Text>
      </View>

      <View className="gap-3 px-4 pb-3" nativeID="route-attempt-live-screen-controls" testID="route-attempt-live-screen-controls">
        {phase === 'ready' && (
          <Pressable
            className="h-16 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
            nativeID="route-attempt-live-screen-play-button"
            onPress={handlePlay}
            testID="route-attempt-live-screen-play-button"
          >
            <MaterialCommunityIcons color={colors.onPrimary} name="play" size={28} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-attempt-live-screen-play-label" testID="route-attempt-live-screen-play-label">Arrancar</Text>
          </Pressable>
        )}
        {/* Reanudar+Finalizar en la misma fila -- pedido real 2026-10-21:
            mantener pausa/finalizar siempre en línea, también al pausar
            (antes Reanudar era un botón de ancho completo, rompiendo la
            fila). Mismo patrón ya aplicado en training-session-*-screen.jsx. */}
        {phase === 'paused' && (
          <View className="flex-row gap-3" nativeID="route-attempt-live-screen-paused-controls" testID="route-attempt-live-screen-paused-controls">
            <View className="flex-1" nativeID="route-attempt-live-screen-resume-wrap" testID="route-attempt-live-screen-resume-wrap">
              <DragToFinishButton icon="play" idPrefix="route-attempt-live-screen-resume" label="Reanudar" onTrigger={handlePlay} variant="resume" />
            </View>
            <View className="flex-1" nativeID="route-attempt-live-screen-finish-wrap-paused" testID="route-attempt-live-screen-finish-wrap-paused">
              <DragToFinishButton idPrefix="route-attempt-live-screen-finish" label="Finalizar" onTrigger={handleFinish} />
            </View>
          </View>
        )}
        {phase === 'running' && (
          <View className="flex-row gap-3" nativeID="route-attempt-live-screen-running-controls" testID="route-attempt-live-screen-running-controls">
            <View className="flex-1" nativeID="route-attempt-live-screen-pause-wrap" testID="route-attempt-live-screen-pause-wrap">
              <DragToFinishButton icon="pause" idPrefix="route-attempt-live-screen-pause" label="Pausar" onTrigger={handlePause} variant="neutral" />
            </View>
            <View className="flex-1" nativeID="route-attempt-live-screen-finish-wrap" testID="route-attempt-live-screen-finish-wrap">
              <DragToFinishButton idPrefix="route-attempt-live-screen-finish" label="Finalizar" onTrigger={handleFinish} />
            </View>
          </View>
        )}
        {(phase === 'running' || phase === 'paused') && (
          <HoldToCancelButton disabled={busy} idPrefix="route-attempt-live-screen" onTrigger={() => setCancelVisible(true)} />
        )}
      </View>

      {phase === 'countdown' && <CountdownOverlay onCancelCountdown={cancelCountdown} value={countdown} />}
      <ConfirmCancelModal onCancel={() => setCancelVisible(false)} onConfirm={handleCancelConfirmed} visible={cancelVisible} />
    </SafeAreaView>
  );
}

export function RouteAttemptLiveScreen() {
  return (
    <MobileOnlyRoute>
      <RequireAuth>
        <RouteAttemptLiveScreenContent />
      </RequireAuth>
    </MobileOnlyRoute>
  );
}
