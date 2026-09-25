import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { isWeb } from '../../utils/platform.js';
import { formatStopwatch, toIsoUtc } from '../../utils/time.js';
import { haversineMeters } from '../../utils/distance.js';
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
  markSetSkipped,
  markSetStarted,
  skipSetsForExercise,
  updateSetDistance,
  updateSetTimings,
} from '../../services/session-db.js';
import { syncRun } from '../../services/session-sync.js';
import { useStopwatch } from '../../hooks/use-stopwatch.js';
import { useGpsTracker } from '../../hooks/use-gps-tracker.js';
import { logDebug } from '../../utils/debug-log.js';
import { DebugLogPanel } from './debug-log-panel.jsx';

const HOLD_MS = 3000;

const STATUS_META = {
  pending: { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-200', label: 'Pendiente' },
  started: { bg: 'bg-amber-400', text: 'text-amber-950', label: 'En curso' },
  skipped: { bg: 'bg-slate-400 dark:bg-slate-600', text: 'text-white', label: 'Salteada' },
  finished: { bg: 'bg-primary', text: 'text-[#111518]', label: 'Completada' },
  interrupted: { bg: 'bg-red-400', text: 'text-red-950', label: 'Interrumpida' },
};

const PHASE_META = {
  ready: { label: 'Listo para iniciar', color: 'text-slate-500 dark:text-slate-400' },
  countdown: { label: 'Preparando…', color: 'text-amber-600 dark:text-amber-400' },
  running: { label: 'En curso', color: 'text-primary' },
  paused: { label: 'En pausa', color: 'text-amber-600 dark:text-amber-400' },
  finishing: { label: 'Finalizando', color: 'text-slate-500 dark:text-slate-400' },
};

function formatMeters(meters) {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function SetStatusChip({ set, idPrefix }) {
  const meta = STATUS_META[set.status] ?? STATUS_META.pending;
  return (
    <View className="items-center" nativeID={`${idPrefix}-set-${set.id}`} testID={`${idPrefix}-set-${set.id}`}>
      <View className={`h-6 w-6 items-center justify-center rounded-full ${meta.bg}`} nativeID={`${idPrefix}-set-${set.id}-badge`} testID={`${idPrefix}-set-${set.id}-badge`}>
        <Text className={`text-[11px] font-bold ${meta.text}`} nativeID={`${idPrefix}-set-${set.id}-number`} testID={`${idPrefix}-set-${set.id}-number`}>
          {set.set_number + 1}
        </Text>
      </View>
    </View>
  );
}

function HoldToCancelButton({ onTrigger, disabled, idPrefix }) {
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
        if (!firedRef.current) {
          firedRef.current = true;
          onTrigger();
        }
      }
    }, 40);
  };

  const handlePress = () => {
    if (isWeb) onTrigger();
  };

  return (
    <Pressable
      className={`h-12 flex-row items-center justify-center gap-2 rounded-full border border-red-300 px-4 ${disabled ? 'opacity-50' : ''} dark:border-red-900/60`}
      disabled={disabled}
      nativeID={`${idPrefix}-cancel-button`}
      onPress={handlePress}
      onPressIn={isWeb ? undefined : startHold}
      onPressOut={isWeb ? undefined : stopHold}
      testID={`${idPrefix}-cancel-button`}
    >
      {holding && (
        <View className="h-1.5 w-16 overflow-hidden rounded-full bg-red-200 dark:bg-red-950" nativeID={`${idPrefix}-cancel-progress-track`} testID={`${idPrefix}-cancel-progress-track`}>
          <View className="h-full rounded-full bg-red-600" style={{ width: `${Math.round(progress * 100)}%` }} nativeID={`${idPrefix}-cancel-progress`} testID={`${idPrefix}-cancel-progress`} />
        </View>
      )}
      <MaterialCommunityIcons color={colors.error} name="stop-circle-outline" size={18} />
      <Text className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400" nativeID={`${idPrefix}-cancel-button-label`} testID={`${idPrefix}-cancel-button-label`}>
        {holding ? 'Soltá para cancelar' : isWeb ? 'Cancelar sesión' : 'Mantener presionado para cancelar'}
      </Text>
    </Pressable>
  );
}

const DRAG_VARIANTS = {
  danger: {
    trackBorder: 'border-red-300 dark:border-red-900/60',
    fill: 'bg-red-600/25',
    thumb: 'bg-red-600',
    iconColor: '#ffffff',
    label: 'text-red-600 dark:text-red-400',
  },
  neutral: {
    trackBorder: 'border-slate-300 dark:border-slate-700',
    fill: 'bg-slate-400/25',
    thumb: 'bg-slate-500 dark:bg-slate-400',
    iconColor: '#ffffff',
    label: 'text-slate-600 dark:text-slate-300',
  },
};

function DragToFinishButton({
  onFinish,
  onTrigger,
  disabled,
  idPrefix,
  label = 'Deslizá para finalizar',
  icon = 'flag-checkered',
  variant = 'danger',
}) {
  const THUMB_SIZE = 64;
  // Mismo motor que el drag-and-drop del catálogo (GestureDetector +
  // Gesture.Pan + shared values de reanimated) — el PanResponder de RN no
  // capturaba el gesto de forma confiable en este screen. El gesto se memoiza
  // (no reconstruirlo en cada render — la lección del dossier 2026-09-16) y
  // el callback se lee vía ref para no disfrazar deps que cambian por render.
  const trigger = onTrigger || onFinish;
  const colors = DRAG_VARIANTS[variant] || DRAG_VARIANTS.danger;
  const translateX = useSharedValue(0);
  const widthSV = useSharedValue(120);
  const triggerRef = useRef(trigger);
  const triggeredRef = useRef(false);
  const lastLoggedRef = useRef(0);
  triggerRef.current = trigger;

  const fillStyle = useAnimatedStyle(() => ({ width: translateX.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const pan = useMemo(() => {
    let p = Gesture.Pan().runOnJS(true);
    if (disabled) p = p.enabled(false);
    return p
      .onStart(() => {
        triggeredRef.current = false;
        logDebug(`drag-finish grant width=${Math.round(widthSV.value)}`);
      })
      .onUpdate((e) => {
        if (triggeredRef.current) return;
        const maxX = (widthSV.value || 120) - THUMB_SIZE;
        // Solo dispara con el pulgar pegado al borde derecho (barra llena) —
        // sin grsaa por position del dedo (disparaba antes de tiempo si el
        // toque arrancaba cerca del extremo derecho, barra a media llenar).
        translateX.value = Math.max(0, Math.min(maxX, e.translationX));
        if (e.translationX >= maxX) {
          triggeredRef.current = true;
          logDebug(`drag-finish TRIGGER(drag) dx=${Math.round(e.translationX)} maxX=${Math.round(maxX)}`);
          triggerRef.current();
        } else if (Math.abs(e.translationX - lastLoggedRef.current) > 16) {
          lastLoggedRef.current = e.translationX;
          logDebug(`drag-finish move dx=${Math.round(e.translationX)} maxX=${Math.round(maxX)}`);
        }
      })
      .onEnd((e) => {
        if (triggeredRef.current) return;
        const maxX = (widthSV.value || 120) - THUMB_SIZE;
        if (e.translationX >= maxX) {
          triggeredRef.current = true;
          logDebug(`drag-finish TRIGGER(release) dx=${Math.round(e.translationX)} maxX=${Math.round(maxX)}`);
          triggerRef.current();
        } else {
          translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
        }
      })
      .onFinalize(() => {
        if (!triggeredRef.current) {
          translateX.value = withSpring(0, { damping: 14, stiffness: 200 });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return (
    <GestureDetector gesture={pan}>
      <View
        className={`h-24 flex-1 rounded-full border ${colors.trackBorder} ${disabled ? 'opacity-50' : ''}`}
        nativeID={`${idPrefix}-drag-track`}
        onLayout={(event) => {
          widthSV.value = Math.round(event.nativeEvent.layout.width);
        }}
        testID={`${idPrefix}-drag-track`}
      >
        <Animated.View
          className={`absolute inset-y-0 left-0 rounded-full ${colors.fill}`}
          nativeID={`${idPrefix}-drag-fill`}
          style={fillStyle}
          testID={`${idPrefix}-drag-fill`}
        />
        <View className="flex-1 items-center justify-center" nativeID={`${idPrefix}-drag-content`} testID={`${idPrefix}-drag-content`}>
          <Text className={`text-center text-base font-bold uppercase tracking-wide ${colors.label}`} nativeID={`${idPrefix}-drag-label`} testID={`${idPrefix}-drag-label`}>
            {label}
          </Text>
        </View>
        <Animated.View
          className={`absolute left-0.5 top-4 h-16 w-16 items-center justify-center rounded-full ${colors.thumb}`}
          nativeID={`${idPrefix}-drag-thumb`}
          style={thumbStyle}
          testID={`${idPrefix}-drag-thumb`}
        >
          <MaterialCommunityIcons color={colors.iconColor} name={icon} size={26} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function CountdownOverlay({ value, onCancelCountdown }) {
  return (
    <View className="absolute inset-0 z-20 items-center justify-center rounded-3xl bg-black/70" nativeID="countdown-overlay" testID="countdown-overlay">
      <Text className="text-base font-semibold uppercase tracking-wide text-white/80" nativeID="countdown-overlay-label" testID="countdown-overlay-label">Arrancando en</Text>
      <Text className="mt-2 text-8xl text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="countdown-overlay-value" testID="countdown-overlay-value">{value}</Text>
      <Pressable className="mt-6 h-9 items-center justify-center rounded-full border border-white/30 px-4" nativeID="countdown-overlay-cancel" onPress={onCancelCountdown} testID="countdown-overlay-cancel">
        <Text className="text-xs font-semibold text-white" nativeID="countdown-overlay-cancel-label" testID="countdown-overlay-cancel-label">Cancelar inicio</Text>
      </Pressable>
    </View>
  );
}

function ConfirmCancelModal({ visible, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) notifyWarning();
  }, [visible]);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal animationType="fade" nativeID="cancel-session-modal" onRequestClose={handleCancel} testID="cancel-session-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="cancel-session-modal-backdrop" onPress={handleCancel} testID="cancel-session-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="cancel-session-modal-card" onPress={() => {}} testID="cancel-session-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="cancel-session-modal-header" testID="cancel-session-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="stop-circle-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="cancel-session-modal-title" testID="cancel-session-modal-title">Cancelar sesión</Text>
          </View>
          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="cancel-session-modal-description" testID="cancel-session-modal-description">
            Vas a cancelar toda la sesión. Las series ya completadas o salteadas se van a sincronizar y quedan guardadas; la serie que esté en curso se descarta.
          </Text>
          <View className="mt-5 flex-row gap-3" nativeID="cancel-session-modal-actions" testID="cancel-session-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="cancel-session-modal-cancel-button"
              onPress={handleCancel}
              testID="cancel-session-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="cancel-session-modal-cancel-label" testID="cancel-session-modal-cancel-label">Seguir entrenando</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80"
              disabled={loading}
              nativeID="cancel-session-modal-confirm-button"
              onPress={handleConfirm}
              testID="cancel-session-modal-confirm-button"
            >
              {loading ? <ActivityIndicator color="#ffffff" size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="cancel-session-modal-confirm-label" testID="cancel-session-modal-confirm-label">Cancelar sesión</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SkipMenuModal({ visible, onCancel, onSkipSeries, onSkipExercise, busy }) {
  return (
    <Modal animationType="fade" nativeID="skip-set-modal" onRequestClose={onCancel} testID="skip-set-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="skip-set-modal-backdrop" onPress={onCancel} testID="skip-set-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="skip-set-modal-card" onPress={() => {}} testID="skip-set-modal-card">
          <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="skip-set-modal-title" testID="skip-set-modal-title">¿Qué querés saltear?</Text>
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400" nativeID="skip-set-modal-subtitle" testID="skip-set-modal-subtitle">
            La serie salteada se registra como omitida. Podés elegir saltar una sola serie o el ejercicio completo.
          </Text>
          <View className="mt-4 gap-3" nativeID="skip-set-modal-options" testID="skip-set-modal-options">
            <Pressable
              className="h-11 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              disabled={busy}
              nativeID="skip-set-modal-series-button"
              onPress={onSkipSeries}
              testID="skip-set-modal-series-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="skip-set-modal-series-label" testID="skip-set-modal-series-label">Saltar esta serie</Text>
            </Pressable>
            <Pressable
              className="h-11 items-center justify-center rounded-full bg-amber-500 hover:opacity-90 active:opacity-80"
              disabled={busy}
              nativeID="skip-set-modal-exercise-button"
              onPress={onSkipExercise}
              testID="skip-set-modal-exercise-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-amber-950" nativeID="skip-set-modal-exercise-label" testID="skip-set-modal-exercise-label">Saltar todo el ejercicio</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FinishSummaryModal({ summary, onClose, visible }) {
  const colors = useThemeColors();
  return (
    <Modal animationType="fade" nativeID="finish-set-modal" onRequestClose={onClose} testID="finish-set-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="finish-set-modal-backdrop" onPress={onClose} testID="finish-set-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="finish-set-modal-card" onPress={() => {}} testID="finish-set-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="finish-set-modal-header" testID="finish-set-modal-header">
            <MaterialCommunityIcons color={colors.primary} name="flag-checkered" size={20} />
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="finish-set-modal-title" testID="finish-set-modal-title">Serie finalizada</Text>
          </View>
          <View className="gap-2" nativeID="finish-set-modal-rows" testID="finish-set-modal-rows">
            <View className="flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60" nativeID="finish-set-modal-wall" testID="finish-set-modal-wall">
              <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="finish-set-modal-wall-label" testID="finish-set-modal-wall-label">Tiempo total</Text>
              <Text className="text-sm font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="finish-set-modal-wall-value" testID="finish-set-modal-wall-value">{formatStopwatch(summary.wallMs)}</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60" nativeID="finish-set-modal-active" testID="finish-set-modal-active">
              <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="finish-set-modal-active-label" testID="finish-set-modal-active-label">Tiempo activo</Text>
              <Text className="text-sm font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="finish-set-modal-active-value" testID="finish-set-modal-active-value">{formatStopwatch(summary.activeMs)}</Text>
            </View>
            {summary.distanceMeters != null && (
              <View className="flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60" nativeID="finish-set-modal-distance" testID="finish-set-modal-distance">
                <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="finish-set-modal-distance-label" testID="finish-set-modal-distance-label">Distancia</Text>
                <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID="finish-set-modal-distance-value" testID="finish-set-modal-distance-value">{formatMeters(summary.distanceMeters)}</Text>
              </View>
            )}
          </View>
          <Pressable
            className="mt-5 h-12 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
            nativeID="finish-set-modal-next-button"
            onPress={onClose}
            testID="finish-set-modal-next-button"
          >
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="finish-set-modal-next-label" testID="finish-set-modal-next-label">Siguiente</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SessionCompleteModal({ visible, runId, counts, onClose }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const startedRef = useRef(false);

  const runSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const syncResult = await syncRun(runId);
      setResult(syncResult);
      if (syncResult.errors.length) {
        notifyError();
        Toast.show({ type: 'warning', text1: 'Sincronización incompleta', text2: `Faltan ${syncResult.errors.length} serie(s) — quedaron guardadas en el dispositivo.` });
      } else {
        notifySuccess();
        Toast.show({ type: 'success', text1: 'Sesión sincronizada', text2: `${syncResult.synced} registrada(s), ${syncResult.conflicts} ya existían.` });
      }
    } catch (error) {
      notifyError();
      setResult({ synced: 0, conflicts: 0, errors: [{ error }] });
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'No pudimos sincronizar. Reintentá o salí — los datos quedaron guardados en el dispositivo.' });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (visible && !startedRef.current) {
      startedRef.current = true;
      runSync();
    }
  }, [visible]);

  const hasErrors = (result?.errors?.length ?? 0) > 0;

  return (
    <Modal animationType="fade" nativeID="session-complete-modal" onRequestClose={onClose} testID="session-complete-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="session-complete-modal-backdrop" onPress={onClose} testID="session-complete-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="session-complete-modal-card" onPress={() => {}} testID="session-complete-modal-card">
          <View className="mb-3 items-center" nativeID="session-complete-modal-header" testID="session-complete-modal-header">
            <MaterialCommunityIcons color="#16a34a" name="check-decagram" size={40} />
            <Text className="mt-2 text-xl font-bold text-slate-900 dark:text-white" nativeID="session-complete-modal-title" testID="session-complete-modal-title">¡Sesión completada!</Text>
          </View>
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="session-complete-modal-subtitle" testID="session-complete-modal-subtitle">
            {counts.finished} serie(s) completadas y {counts.skipped} salteada(s). Estamos subiendo el registro.
          </Text>

          <View className="mt-4 h-11 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900/60" nativeID="session-complete-modal-sync-status" testID="session-complete-modal-sync-status">
            {syncing ? (
              <View className="flex-row items-center gap-2" nativeID="session-complete-modal-sync-progress" testID="session-complete-modal-sync-progress">
                <ActivityIndicator color="#8cc63e" size="small" />
                <Text className="text-sm font-medium text-slate-600 dark:text-slate-300" nativeID="session-complete-modal-sync-progress-label" testID="session-complete-modal-sync-progress-label">Sincronizando…</Text>
              </View>
            ) : result ? (
              hasErrors ? (
                <Text className="text-center px-2 text-sm font-medium text-amber-600 dark:text-amber-400" nativeID="session-complete-modal-sync-error" testID="session-complete-modal-sync-error">
                  {result.errors.length} serie(s) sin sincronizar
                </Text>
              ) : (
                <Text className="text-sm font-medium text-emerald-600 dark:text-emerald-400" nativeID="session-complete-modal-sync-ok" testID="session-complete-modal-sync-ok">
                  {result.synced} registrada(s) · {result.conflicts} ya existían
                </Text>
              )
            ) : (
              <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="session-complete-modal-sync-idle" testID="session-complete-modal-sync-idle">Esperando sincronización</Text>
            )}
          </View>

          <View className="mt-5 flex-row gap-3" nativeID="session-complete-modal-actions" testID="session-complete-modal-actions">
            {hasErrors && (
              <Pressable
                className="h-12 flex-1 items-center justify-center rounded-full border border-amber-400 active:opacity-70 dark:border-amber-500/60"
                disabled={syncing}
                nativeID="session-complete-modal-retry-button"
                onPress={runSync}
                testID="session-complete-modal-retry-button"
              >
                <Text className="text-sm font-semibold text-amber-700 dark:text-amber-400" nativeID="session-complete-modal-retry-label" testID="session-complete-modal-retry-label">Reintentar</Text>
              </Pressable>
            )}
            <Pressable
              className="h-12 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
              nativeID="session-complete-modal-close-button"
              onPress={onClose}
              testID="session-complete-modal-close-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="session-complete-modal-close-label" testID="session-complete-modal-close-label">
                {hasErrors ? 'Salir igualmente' : 'Terminar'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OverviewView({ sets, run, onOpenSet, onCancel }) {
  const colors = useThemeColors();
  const [cancelVisible, setCancelVisible] = useState(false);

  const groups = [];
  const byExercise = new Map();
  for (const set of sets) {
    const key = set.exercise_instance_id;
    if (!byExercise.has(key)) {
      const group = { exerciseName: set.exercise_name, exerciseInstanceId: key, sets: [] };
      byExercise.set(key, group);
      groups.push(group);
    }
    byExercise.get(key).sets.push(set);
  }

  const nextSet = sets.find((s) => s.status === 'pending');
  const finishedCount = sets.filter((s) => s.status === 'finished').length;
  const skippedCount = sets.filter((s) => s.status === 'skipped').length;
  const pendingCount = sets.filter((s) => s.status === 'pending').length;

  return (
    <View className="flex-1" nativeID="session-overview-container" testID="session-overview-container">
      <ScrollView contentContainerClassName="p-4" nativeID="session-overview-scroll" testID="session-overview-scroll">
        <View className="mb-3" nativeID="session-overview-header" testID="session-overview-header">
          <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID="session-overview-title" testID="session-overview-title">{run.session_name}</Text>
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400" nativeID="session-overview-date" testID="session-overview-date">{run.session_date}</Text>
        </View>

        <View className="mb-4 flex-row flex-wrap gap-2" nativeID="session-overview-counts" testID="session-overview-counts">
          <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 dark:bg-emerald-900/20" nativeID="session-overview-finished-count" testID="session-overview-finished-count">
            <View className="h-2 w-2 rounded-full bg-primary" nativeID="session-overview-finished-dot" testID="session-overview-finished-dot" />
            <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400" nativeID="session-overview-finished-count-label" testID="session-overview-finished-count-label">{finishedCount} completadas</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="session-overview-skipped-count" testID="session-overview-skipped-count">
            <View className="h-2 w-2 rounded-full bg-slate-400" nativeID="session-overview-skipped-dot" testID="session-overview-skipped-dot" />
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="session-overview-skipped-count-label" testID="session-overview-skipped-count-label">{skippedCount} salteadas</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="session-overview-pending-count" testID="session-overview-pending-count">
            <View className="h-2 w-2 rounded-full bg-amber-400" nativeID="session-overview-pending-dot" testID="session-overview-pending-dot" />
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="session-overview-pending-count-label" testID="session-overview-pending-count-label">{pendingCount} pendientes</Text>
          </View>
        </View>

        <View className="gap-3" nativeID="session-overview-exercises" testID="session-overview-exercises">
          {groups.map((group) => {
            const isNext = nextSet != null && String(group.exerciseInstanceId) === String(nextSet.exercise_instance_id);
            const hiddenPrefix = `session-overview-exercise-${group.exerciseInstanceId}`;
            return (
              <Pressable
                className={`rounded-2xl border p-3 ${isNext ? 'border-primary bg-primary/10 active:opacity-80' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                disabled={!isNext}
                key={group.exerciseInstanceId}
                nativeID={`${hiddenPrefix}-card`}
                onPress={() => onOpenSet(group.sets.find((s) => s.status === 'pending'))}
                testID={`${hiddenPrefix}-card`}
              >
                <View className="flex-row items-center justify-between" nativeID={`${hiddenPrefix}-header`} testID={`${hiddenPrefix}-header`}>
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${hiddenPrefix}-name`} testID={`${hiddenPrefix}-name`}>{group.exerciseName}</Text>
                  {isNext && <MaterialCommunityIcons color={colors.primary} name="play-circle-outline" size={20} />}
                </View>
                <View className="mt-2.5 flex-row items-center gap-2" nativeID={`${hiddenPrefix}-chips`} testID={`${hiddenPrefix}-chips`}>
                  {group.sets.map((set) => (
                    <SetStatusChip key={set.id} idPrefix={hiddenPrefix} set={set} />
                  ))}
                </View>
                {!isNext && (
                  <Text className="mt-2 text-xs text-slate-400 dark:text-slate-500" nativeID={`${hiddenPrefix}-locked-note`} testID={`${hiddenPrefix}-locked-note`}>
                    Se habilita cuando completes las anteriores
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="border-t border-slate-100 p-4 dark:border-slate-800" nativeID="session-overview-footer" testID="session-overview-footer">
        <HoldToCancelButton disabled={false} idPrefix="session-overview" onTrigger={() => setCancelVisible(true)} />
      </View>

      <ConfirmCancelModal visible={cancelVisible} onCancel={() => setCancelVisible(false)} onConfirm={onCancel} />
    </View>
  );
}

function SeriesView({ set, runId, gpsEnabled, totalSeriesForExercise, onAdvance, onBack, onCancelConfirmed, onDataChanged }) {
  const colors = useThemeColors();
  const stopwatch = useStopwatch();
  const gps = useGpsTracker(gpsEnabled);
  const [phase, setPhase] = useState(() => (set.status === 'started' && !set.ended_at ? 'paused' : 'ready'));
  const [countdown, setCountdown] = useState(3);
  const [distance, setDistance] = useState(set.distance_meters ?? null);
  const [skipVisible, setSkipVisible] = useState(false);
  const [summary, setSummary] = useState(null);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gpsWarning, setGpsWarning] = useState(false);

  const savedTimingsRef = useRef({ wallMs: set.duration_ms ?? 0, activeMs: set.active_duration_ms ?? 0 });
  const gpsActiveRef = useRef(false);
  const lastPointRef = useRef(null);
  const pointOrderRef = useRef(0);
  const distanceRef = useRef(set.distance_meters ?? null);
  const countdownRef = useRef(3);
  const countdownTimerRef = useRef(null);
  const gpsGraceTimerRef = useRef(null);

  const clearGpsGrace = () => {
    if (gpsGraceTimerRef.current) {
      clearTimeout(gpsGraceTimerRef.current);
      gpsGraceTimerRef.current = null;
    }
  };

  // Dame 5s desde el arranque de la serie para que llegue el primer punto GPS;
  // recién si pasó sin señal se muestra el aviso.
  const armGpsGrace = () => {
    if (!gpsEnabled) return;
    clearGpsGrace();
    setGpsWarning(false);
    gpsGraceTimerRef.current = setTimeout(() => {
      gpsGraceTimerRef.current = null;
      if (distanceRef.current == null) setGpsWarning(true);
    }, 5000);
  };

  useEffect(() => {
    logDebug(`SeriesView montado set=${set.id} nombre="${set.exercise_name}" serie=${set.set_number + 1} status="${set.status}" wallMs=${set.duration_ms} activeMs=${set.active_duration_ms} dist=${set.distance_meters}`);
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); clearGpsGrace(); gps.stop(); };
  }, []);

  const setCountdownValue = (value) => {
    countdownRef.current = value;
    setCountdown(value);
  };

  const handleGpsPoint = async ({ latitude, longitude, timestamp }) => {
    if (!gpsActiveRef.current) return;
    const point = { latitude, longitude, timestamp };
    if (!lastPointRef.current) {
      lastPointRef.current = point;
      pointOrderRef.current = 0;
      clearGpsGrace();
      setGpsWarning(false);
      await insertGpsPoint(set.id, 0, latitude, longitude, timestamp ?? Date.now());
      distanceRef.current = 0;
      setDistance(0);
      await updateSetDistance(set.id, 0);
      return;
    }
    const leg = haversineMeters(lastPointRef.current.latitude, lastPointRef.current.longitude, latitude, longitude);
    lastPointRef.current = { latitude, longitude, timestamp };
    pointOrderRef.current += 1;
    await insertGpsPoint(set.id, pointOrderRef.current, latitude, longitude, timestamp ?? Date.now());
    if (leg > 0) {
      const nextDistance = (distanceRef.current ?? 0) + leg;
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
      await updateSetDistance(set.id, nextDistance);
    }
  };

  const beginSet = async () => {
    logDebug(`beginSet set=${set.id} gps=${gpsEnabled}`);
    try {
      await markSetStarted(set.id, toIsoUtc());
      logDebug(`markSetStarted set=${set.id} ok`);
      savedTimingsRef.current = { wallMs: 0, activeMs: 0 };
      stopwatch.start();
      setPhase('running');
      await onDataChanged();
      if (gpsEnabled) {
        gpsActiveRef.current = true;
        pointOrderRef.current = 0;
        armGpsGrace();
        await gps.start({ onPoint: handleGpsPoint });
      }
    } catch (error) {
      logDebug('beginSet error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos iniciar la serie', text2: error.message });
    } finally {
      setBusy(false);
    }
  };

  const startCountdown = () => {
    setPhase('countdown');
    setCountdownValue(3);
    countdownTimerRef.current = setInterval(() => {
      const remaining = countdownRef.current - 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setBusy(true);
        beginSet();
      } else {
        setCountdownValue(remaining);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setPhase('ready');
    setCountdownValue(3);
  };

  const handlePlay = async () => {
    logDebug(`handlePlay set=${set.id} phase=${phase}`);
    if (busy) return;
    if (phase === 'ready') {
      startCountdown();
      return;
    }
    if (phase === 'paused') {
      setBusy(true);
      try {
        stopwatch.resumeFrom(savedTimingsRef.current);
        setPhase('running');
        if (gpsActiveRef.current) {
          if (distanceRef.current == null) armGpsGrace();
          await gps.start({ onPoint: handleGpsPoint });
        }
      } finally {
        setBusy(false);
      }
    }
  };

  const handlePause = async () => {
    logDebug(`handlePause set=${set.id}`);
    if (phase !== 'running' || busy) return;
    setBusy(true);
    try {
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await updateSetTimings(set.id, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
      await gps.stop();
      clearGpsGrace();
      setGpsWarning(false);
      setPhase('paused');
      await onDataChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    logDebug(`handleFinish set=${set.id} phase=${phase}`);
    if ((phase !== 'running' && phase !== 'paused') || busy) return;
    setBusy(true);
    try {
      const snap = phase === 'running' ? stopwatch.pause() : savedTimingsRef.current;
      await gps.stop();
      clearGpsGrace();
      setGpsWarning(false);
      await finishSet(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: snap.wallMs,
        activeDurationMs: snap.activeMs,
        distanceMeters: distanceRef.current,
      });
      logDebug(`finishSet set=${set.id} persistido wall=${snap.wallMs} active=${snap.activeMs} dist=${distanceRef.current}`);
      setSummary({ wallMs: snap.wallMs, activeMs: snap.activeMs, distanceMeters: distanceRef.current });
      setPhase('finishing');
      await onDataChanged();
    } catch (error) {
      logDebug('handleFinish error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos finalizar la serie', text2: error.message });
    } finally {
      setBusy(false);
    }
  };

  const skipSeries = async () => {
    logDebug(`skipSeries set=${set.id}`);
    if (busy) return;
    setBusy(true);
    try {
      await gps.stop();
      clearGpsGrace();
      setGpsWarning(false);
      await markSetSkipped(set.id);
      setSkipVisible(false);
      await onDataChanged();
      onAdvance();
    } finally {
      setBusy(false);
    }
  };

  const skipExercise = async () => {
    logDebug(`skipExercise set=${set.id}`);
    if (busy) return;
    setBusy(true);
    try {
      await gps.stop();
      clearGpsGrace();
      setGpsWarning(false);
      await skipSetsForExercise(runId, set.exercise_instance_id);
      setSkipVisible(false);
      await onDataChanged();
      onAdvance();
    } finally {
      setBusy(false);
    }
  };

  const handleExit = async () => {
    logDebug(`handleExit set=${set.id} phase=${phase}`);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (phase === 'running') {
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await updateSetTimings(set.id, { durationMs: snap.wallMs, activeDurationMs: snap.activeMs });
      await gps.stop();
    }
    clearGpsGrace();
    setGpsWarning(false);
    await onDataChanged();
    onBack();
  };

  const prepareCancel = async () => {
    logDebug(`prepareCancel set=${set.id} phase=${phase}`);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (phase === 'running') {
      const snap = stopwatch.pause();
      savedTimingsRef.current = { wallMs: snap.wallMs, activeMs: snap.activeMs };
      await markSetInterrupted(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: snap.wallMs,
        activeDurationMs: snap.activeMs,
        distanceMeters: distanceRef.current,
      });
    } else if (phase === 'paused') {
      await markSetInterrupted(set.id, {
        endedAtIso: toIsoUtc(),
        durationMs: savedTimingsRef.current.wallMs,
        activeDurationMs: savedTimingsRef.current.activeMs,
        distanceMeters: distanceRef.current,
      });
    }
    await gps.stop();
    clearGpsGrace();
    setGpsWarning(false);
    await onDataChanged();
  };

  const phaseMeta = PHASE_META[phase] ?? PHASE_META.ready;
  const showTimer = phase === 'running' || phase === 'paused' || phase === 'finishing';
  const idPrefix = `series-${set.id}`;

  return (
    <View className="flex-1 p-4" nativeID={`${idPrefix}-container`} testID={`${idPrefix}-container`}>
      <View className="flex-1 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" nativeID={`${idPrefix}-card`} testID={`${idPrefix}-card`}>
        <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
          <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID={`${idPrefix}-back-button`} onPress={handleExit} testID={`${idPrefix}-back-button`}>
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
          </Pressable>
          <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID={`${idPrefix}-phase-pill`} testID={`${idPrefix}-phase-pill`}>
            <View className={`h-2 w-2 rounded-full ${phase === 'running' ? 'bg-primary' : 'bg-amber-400'}`} nativeID={`${idPrefix}-phase-dot`} testID={`${idPrefix}-phase-dot`} />
            <Text className={`text-xs font-semibold ${phaseMeta.color}`} nativeID={`${idPrefix}-phase-label`} testID={`${idPrefix}-phase-label`}>{phaseMeta.label}</Text>
          </View>
        </View>

        <View className="mt-3 items-center" nativeID={`${idPrefix}-context`} testID={`${idPrefix}-context`}>
          <Text className="text-center text-lg font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-exercise-name`} testID={`${idPrefix}-exercise-name`}>{set.exercise_name}</Text>
          <Text className="mt-0.5 text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-series-count`} testID={`${idPrefix}-series-count`}>
            Serie {set.set_number + 1} de {totalSeriesForExercise}
          </Text>
        </View>

        <View className="flex-1 items-center justify-center" nativeID={`${idPrefix}-timer-area`} testID={`${idPrefix}-timer-area`}>
          {distance != null && (
            <View className="mb-4 flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 dark:bg-emerald-900/20" nativeID={`${idPrefix}-gps-pill`} testID={`${idPrefix}-gps-pill`}>
              <MaterialCommunityIcons color="#16a34a" name="crosshairs-gps" size={14} />
              <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400" nativeID={`${idPrefix}-gps-label`} testID={`${idPrefix}-gps-label`}>
                GPS · {formatMeters(distance)}
              </Text>
            </View>
          )}
          {gpsEnabled && gpsWarning && distance == null && phase !== 'ready' && (
            <View className="mb-4 flex-row items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 dark:bg-amber-900/20" nativeID={`${idPrefix}-gps-warning`} testID={`${idPrefix}-gps-warning`}>
              <MaterialCommunityIcons color="#d97706" name="crosshairs-off" size={14} />
              <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-gps-warning-label`} testID={`${idPrefix}-gps-warning-label`}>Sin señal GPS — esta serie no registra distancia</Text>
            </View>
          )}
          <Text className="text-6xl text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID={`${idPrefix}-timer`} testID={`${idPrefix}-timer`}>
            {showTimer ? formatStopwatch(stopwatch.wallMs) : '00:00:00'}
          </Text>
          <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-timer-hint`} testID={`${idPrefix}-timer-hint`}>
            {phase === 'ready' ? 'Toque Play para arrancar — se arma en 3 segundos' : ''}
          </Text>
        </View>

        {phase === 'ready' && (
          <View className="mb-4" nativeID={`${idPrefix}-skip-hint`} testID={`${idPrefix}-skip-hint`}>
            <Pressable className="h-11 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-skip-button`} onPress={() => setSkipVisible(true)} testID={`${idPrefix}-skip-button`}>
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-skip-label`} testID={`${idPrefix}-skip-label`}>Saltear</Text>
            </Pressable>
          </View>
        )}

        <View className="gap-3" nativeID={`${idPrefix}-controls`} testID={`${idPrefix}-controls`}>
          {phase === 'ready' && (
            <Pressable
              className="h-16 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80"
              nativeID={`${idPrefix}-play-button`}
              onPress={handlePlay}
              testID={`${idPrefix}-play-button`}
            >
              <MaterialCommunityIcons color={colors.onPrimary} name="play" size={28} />
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-play-label`} testID={`${idPrefix}-play-label`}>Iniciar serie</Text>
            </Pressable>
          )}

          {phase === 'paused' && (
            <>
              <Pressable
                className="h-16 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80"
                nativeID={`${idPrefix}-resume-button`}
                onPress={handlePlay}
                testID={`${idPrefix}-resume-button`}
              >
                <MaterialCommunityIcons color={colors.onPrimary} name="play" size={28} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-resume-label`} testID={`${idPrefix}-resume-label`}>Reanudar</Text>
              </Pressable>
              <View className="flex-row gap-3" nativeID={`${idPrefix}-secondary-controls`} testID={`${idPrefix}-secondary-controls`}>
                <Pressable className="h-12 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-skip-button`} onPress={() => setSkipVisible(true)} testID={`${idPrefix}-skip-button`}>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="skip-next" size={18} />
                </Pressable>
                <DragToFinishButton disabled={false} idPrefix={idPrefix} onTrigger={handleFinish} />
              </View>
            </>
          )}

          {phase === 'running' && (
            <View className="flex-row gap-3" nativeID={`${idPrefix}-running-controls`} testID={`${idPrefix}-running-controls`}>
              <DragToFinishButton idPrefix={`${idPrefix}-pause`} icon="pause" label="Deslizá para pausar" onTrigger={handlePause} variant="neutral" />
              <DragToFinishButton disabled={false} idPrefix={idPrefix} onTrigger={handleFinish} />
            </View>
          )}
        </View>

        <View className="mt-4" nativeID={`${idPrefix}-cancel-zone`} testID={`${idPrefix}-cancel-zone`}>
          <HoldToCancelButton disabled={busy} idPrefix={idPrefix} onTrigger={() => setCancelVisible(true)} />
        </View>
      </View>

      {phase === 'countdown' && <CountdownOverlay onCancelCountdown={cancelCountdown} value={countdown} />}

      <SkipMenuModal visible={skipVisible} onCancel={() => setSkipVisible(false)} onSkipSeries={skipSeries} onSkipExercise={skipExercise} busy={busy} />
      <FinishSummaryModal summary={summary ?? { wallMs: 0, activeMs: 0 }} onClose={onAdvance} visible={summary != null && phase === 'finishing'} />
      <ConfirmCancelModal
        visible={cancelVisible}
        onCancel={() => setCancelVisible(false)}
        onConfirm={async () => {
          await prepareCancel();
          await onCancelConfirmed();
        }}
      />
    </View>
  );
}

function TrainingSessionActiveScreenContent() {
  const router = useRouter();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const storeRunId = useLiveSessionStore((s) => s.runId);
  const storeGpsEnabled = useLiveSessionStore((s) => s.gpsEnabled);
  const setSessionStarted = useLiveSessionStore((s) => s.setSessionStarted);
  const clearLiveSession = useLiveSessionStore((s) => s.clearLiveSession);
  const userId = useAuthStore((s) => s.userId);

  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState(null);
  const [run, setRun] = useState(null);
  const [sets, setSets] = useState([]);
  const [mode, setMode] = useState('overview');
  const [currentSetId, setCurrentSetId] = useState(null);
  const [sessionCompleteVisible, setSessionCompleteVisible] = useState(false);

  const bootstrap = async () => {
    try {
      await initSessionDb();
      const sessionInstance = pendingSession.sessionInstance;
      const sessionDate = pendingSession.date;
      let runRow = storeRunId ? await getRun(storeRunId) : null;
      if (runRow) logDebug(`bootstrap: reuso run por storeRunId=${storeRunId}`);
      if (!runRow) runRow = await getActiveRun(sessionInstance.id, sessionDate);
      if (runRow && !storeRunId) logDebug('bootstrap: reuso run por getActiveRun');
      if (!runRow) {
        const createdId = await createRun({
          sessionInstanceId: sessionInstance.id,
          sessionName: sessionInstance.name ?? 'Entrenamiento',
          sessionDate,
          teamId: pendingSession.teamId,
          userId,
          gpsEnabled: storeGpsEnabled,
          exercises: sessionInstance.exercises ?? [],
        });
        runRow = await getRun(createdId);
        setSessionStarted(createdId, storeGpsEnabled);
        logDebug(`bootstrap: run creado id=${createdId}`);
      } else {
        setSessionStarted(runRow.id, Boolean(runRow.gps_enabled));
      }
      setRun(runRow);
      const bootSets = await getSetsForRun(runRow.id);
      setSets(bootSets);
      logDebug(`bootstrap ok run=${runRow.id} status="${runRow.status}" gps=${Boolean(runRow.gps_enabled)} sets=${bootSets.length}`);
      for (const s of bootSets) {
        logDebug(`  set id=${s.id} "${s.exercise_name}" #${s.set_number + 1} status="${s.status}" wall=${s.duration_ms} active=${s.active_duration_ms} dist=${s.distance_meters}`);
      }
      setBooted(true);
    } catch (error) {
      logDebug('bootstrap error', error);
      notifyError();
      setBootError(error);
    }
  };

  useEffect(() => {
    if (pendingSession) bootstrap();
  }, [pendingSession]);

  const reloadSets = async () => {
    if (run) setSets(await getSetsForRun(run.id));
  };

  const handleOpenSet = (set) => {
    logDebug(`handleOpenSet set=${set?.id} status="${set?.status}"`);
    if (!set) return;
    setCurrentSetId(set.id);
    setMode('series');
  };

  const handleAdvance = async () => {
    if (!run) return;
    try {
      const all = await getSetsForRun(run.id);
      setSets(all);
      const next = all.find((s) => s.status === 'pending');
      logDebug(`handleAdvance run=${run.id} actual=${currentSetId} next=${next ? next.id : 'ninguno'}`);
      if (next) {
        if (next.id === currentSetId) {
          logDebug('handleAdvance: la serie actual sigue pendiente — finish no persistio, vuelvo a overview');
          setMode('overview');
          return;
        }
        setCurrentSetId(next.id);
        setMode('series');
      } else {
        await finalizeRun(run.id);
        logDebug('handleAdvance: sin series pendientes — finalizo run');
        setMode('overview');
        setSessionCompleteVisible(true);
      }
    } catch (error) {
      logDebug('handleAdvance error', error);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos avanzar de serie', text2: error.message });
    }
  };

  const handleCancelConfirmed = async () => {
    if (!run) return;
    try {
      await interruptStartedSets(run.id);
      await cancelRun(run.id);
      const result = await syncRun(run.id);
      const total = result.synced + result.conflicts;
      if (result.errors.length) {
        notifyError();
        Toast.show({ type: 'warning', text1: 'Sesión cancelada', text2: 'Algunos datos no pudieron sincronizarse — quedaron guardados en el dispositivo.' });
      } else if (total) {
        notifySuccess();
        Toast.show({ type: 'success', text1: 'Sesión cancelada', text2: `Sincronizamos ${total} serie(s) registradas.` });
      } else {
        Toast.show({ type: 'info', text1: 'Sesión cancelada' });
      }
    } catch (error) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos cancelar la sesión', text2: error.message });
      return;
    }
    clearLiveSession();
    router.back();
  };

  if (!pendingSession) {
    return (
      <MobileOnlyRoute>
        <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="training-session-active-screen-empty" testID="training-session-active-screen-empty">
          <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-active-screen-empty-label" testID="training-session-active-screen-empty-label">No hay sesión en curso.</Text>
        </View>
      </MobileOnlyRoute>
    );
  }

  if (!booted) {
    return (
      <MobileOnlyRoute>
        <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="training-session-active-screen-loading" testID="training-session-active-screen-loading">
          <ActivityIndicator color="#8cc63e" size="large" />
          <Text className="mt-3 text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-active-screen-loading-label" testID="training-session-active-screen-loading-label">
            {bootError ? 'No pudimos preparar la sesión' : 'Preparando la sesión…'}
          </Text>
        </View>
      </MobileOnlyRoute>
    );
  }

  const currentSet = mode === 'series' ? sets.find((s) => s.id === currentSetId) : null;

  return (
    <MobileOnlyRoute>
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="training-session-active-screen-root" testID="training-session-active-screen-root">
        {__DEV__ && <DebugLogPanel />}
        {bootError ? (
          <View className="flex-1 items-center justify-center px-6" nativeID="training-session-active-screen-error" testID="training-session-active-screen-error">
            <Text className="text-center text-base text-red-600 dark:text-red-400" nativeID="training-session-active-screen-error-label" testID="training-session-active-screen-error-label">
              No pudimos preparar la sesión local. {bootError.message}
            </Text>
            <Pressable className="mt-4 h-11 items-center justify-center rounded-full border border-slate-300 px-6 dark:border-slate-600" nativeID="training-session-active-screen-error-back" onPress={() => router.back()} testID="training-session-active-screen-error-back">
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="training-session-active-screen-error-back-label" testID="training-session-active-screen-error-back-label">Volver</Text>
            </Pressable>
          </View>
        ) : currentSet ? (
          <SeriesView
            gpsEnabled={storeGpsEnabled}
            key={currentSet.id}
            onAdvance={handleAdvance}
            onBack={() => setMode('overview')}
            onCancelConfirmed={handleCancelConfirmed}
            onDataChanged={reloadSets}
            runId={run.id}
            set={currentSet}
            totalSeriesForExercise={sets.filter((s) => s.exercise_instance_id === currentSet.exercise_instance_id).length}
          />
        ) : (
          <OverviewView onCancel={handleCancelConfirmed} onOpenSet={handleOpenSet} run={run} sets={sets} />
        )}

        <SessionCompleteModal
          counts={{ finished: sets.filter((s) => s.status === 'finished').length, skipped: sets.filter((s) => s.status === 'skipped').length }}
          onClose={() => {
            clearLiveSession();
            router.back();
          }}
          runId={run.id}
          visible={sessionCompleteVisible}
        />
      </SafeAreaView>
    </MobileOnlyRoute>
  );
}

export function TrainingSessionActiveScreen() {
  return (
    <MobileOnlyRoute>
      <TrainingSessionActiveScreenContent />
    </MobileOnlyRoute>
  );
}