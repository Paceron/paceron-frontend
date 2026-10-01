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
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useLiveSessionRuntime } from '../../hooks/use-live-session-runtime.js';
import { formatStopwatch } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/haptics.js';
import { isWeb } from '../../utils/platform.js';
import { logDebug } from '../../utils/debug-log.js';

// Runtime de la sesión PRESENCIAL -- calca a propósito la experiencia de
// training-session-active-screen.jsx (asíncrona, sin tocar: overview con
// chips por serie, vista de serie a pantalla completa con cronómetro grande,
// deslizar para pausar/finalizar, mantener para cancelar). La diferencia real
// vive por detrás: el cronómetro/fase de la serie activa y el GPS continuo
// viven en use-live-session-runtime.js (no acá, no por fila), porque
// necesitan reaccionar a un control:session_paused remoto del entrenador y
// transmitir cada transición en vivo -- ver ese hook para el detalle.

const CONNECTION_META = {
  open: { label: 'En vivo', dot: 'bg-primary', text: 'text-emerald-700 dark:text-emerald-400' },
  connecting: { label: 'Conectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  reconnecting: { label: 'Reconectando…', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400' },
  closed: { label: 'Sin conexión — guardando localmente', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
};

function ConnectionBanner({ status }) {
  const meta = CONNECTION_META[status] ?? CONNECTION_META.closed;
  return (
    <View className="flex-row items-center gap-2 self-center rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="training-session-live-connection-banner" testID="training-session-live-connection-banner">
      <View className={`h-2 w-2 rounded-full ${meta.dot}`} nativeID="training-session-live-connection-dot" testID="training-session-live-connection-dot" />
      <Text className={`text-xs font-semibold ${meta.text}`} nativeID="training-session-live-connection-label" testID="training-session-live-connection-label">
        {meta.label}
      </Text>
    </View>
  );
}

// Acceso directo al escáner de asistencia (módulo aparte, ya construido en
// develop) -- la pantalla no necesita pasarle nada más que `returnTo`, el QR
// trae su propio contexto de sesión. Ver components/checkin/checkin-screen.jsx
// y destinationForOutcome en utils/checkin-outcome.js (sin `returnTo`, un
// escaneo exitoso sacaba al corredor de la sesión en curso -- bug real,
// 2026-10-01).
function AttendanceQuickAccessButton({ router, idPrefix }) {
  const colors = useThemeColors();
  return (
    <Pressable
      className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
      nativeID={`${idPrefix}-attendance-button`}
      onPress={() => router.push({ pathname: '/attendance/register', params: { returnTo: '/training-session-live' } })}
      testID={`${idPrefix}-attendance-button`}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="qrcode-scan" size={20} />
    </Pressable>
  );
}

const STATUS_META = {
  pending: { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-200', label: 'Pendiente' },
  started: { bg: 'bg-amber-400', text: 'text-amber-950', label: 'En curso' },
  paused: { bg: 'bg-amber-300', text: 'text-amber-950', label: 'Pausada' },
  skipped: { bg: 'bg-slate-400 dark:bg-slate-600', text: 'text-white', label: 'Salteada' },
  finished: { bg: 'bg-primary', text: 'text-[#111518]', label: 'Completada' },
  interrupted: { bg: 'bg-red-400', text: 'text-red-950', label: 'Interrumpida' },
};

function SetStatusChip({ set, isActive, phase, idPrefix }) {
  const metaKey = isActive && phase === 'paused' ? 'paused' : set.status;
  const meta = STATUS_META[metaKey] ?? STATUS_META.pending;
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

const HOLD_MS = 3000;

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
  finish: {
    trackBorder: 'border-emerald-300 dark:border-emerald-800/70',
    fill: 'bg-emerald-500/20',
    thumb: 'bg-emerald-500/70 border border-emerald-600/60',
    iconColor: '#ffffff',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
  neutral: {
    trackBorder: 'border-slate-200 dark:border-slate-700/60',
    fill: 'bg-slate-300/25',
    thumb: 'bg-slate-300/80 border border-slate-400/60',
    iconColor: '#ffffff',
    label: 'text-slate-500 dark:text-slate-400',
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
      <View
        className={`h-24 flex-1 rounded-full border ${colors.trackBorder} ${disabled ? 'opacity-50' : ''}`}
        nativeID={`${idPrefix}-drag-track`}
        onLayout={(event) => { widthSV.value = Math.round(event.nativeEvent.layout.width); }}
        testID={`${idPrefix}-drag-track`}
      >
        <Animated.View className={`absolute inset-y-0 left-0 rounded-full ${colors.fill}`} nativeID={`${idPrefix}-drag-fill`} style={fillStyle} testID={`${idPrefix}-drag-fill`} />
        <Animated.View className={`absolute left-0.5 top-4 h-16 w-16 items-center justify-center rounded-full ${colors.thumb}`} nativeID={`${idPrefix}-drag-thumb`} style={thumbStyle} testID={`${idPrefix}-drag-thumb`}>
          <MaterialCommunityIcons color={colors.iconColor} name={icon} size={26} />
        </Animated.View>
        <View className="absolute inset-0 items-center justify-center px-20" nativeID={`${idPrefix}-drag-content`} pointerEvents="none" testID={`${idPrefix}-drag-content`}>
          <Text className={`text-center text-base font-bold uppercase tracking-wide ${colors.label}`} nativeID={`${idPrefix}-drag-label`} numberOfLines={1} testID={`${idPrefix}-drag-label`}>
            {label}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

function CountdownOverlay({ value, onCancelCountdown }) {
  return (
    <View className="absolute inset-0 z-20 items-center justify-center rounded-3xl bg-black/70" nativeID="training-session-live-countdown-overlay" testID="training-session-live-countdown-overlay">
      <Text className="text-base font-semibold uppercase tracking-wide text-white/80" nativeID="training-session-live-countdown-label" testID="training-session-live-countdown-label">Empezamos en</Text>
      <Text className="mt-2 text-8xl text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="training-session-live-countdown-value" testID="training-session-live-countdown-value">{value}</Text>
      <Pressable className="mt-6 h-9 items-center justify-center rounded-full border border-white/30 px-4" nativeID="training-session-live-countdown-cancel" onPress={onCancelCountdown} testID="training-session-live-countdown-cancel">
        <Text className="text-xs font-semibold text-white" nativeID="training-session-live-countdown-cancel-label" testID="training-session-live-countdown-cancel-label">Cancelar inicio</Text>
      </Pressable>
    </View>
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
    <Modal animationType="fade" nativeID="training-session-live-cancel-modal" onRequestClose={handleCancel} testID="training-session-live-cancel-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="training-session-live-cancel-modal-backdrop" onPress={handleCancel} testID="training-session-live-cancel-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="training-session-live-cancel-modal-card" onPress={() => {}} testID="training-session-live-cancel-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="training-session-live-cancel-modal-header" testID="training-session-live-cancel-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="stop-circle-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="training-session-live-cancel-modal-title" testID="training-session-live-cancel-modal-title">Cancelar sesión</Text>
          </View>
          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="training-session-live-cancel-modal-description" testID="training-session-live-cancel-modal-description">
            Vas a cancelar toda la sesión. Las series ya completadas o salteadas se van a sincronizar y quedan guardadas; la serie que esté en curso se descarta.
          </Text>
          <View className="mt-5 flex-row gap-3" nativeID="training-session-live-cancel-modal-actions" testID="training-session-live-cancel-modal-actions">
            <Pressable className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={loading} nativeID="training-session-live-cancel-modal-cancel-button" onPress={handleCancel} testID="training-session-live-cancel-modal-cancel-button">
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="training-session-live-cancel-modal-cancel-label" testID="training-session-live-cancel-modal-cancel-label">Seguir entrenando</Text>
            </Pressable>
            <Pressable className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 active:opacity-80" disabled={loading} nativeID="training-session-live-cancel-modal-confirm-button" onPress={handleConfirm} testID="training-session-live-cancel-modal-confirm-button">
              {loading ? <ActivityIndicator color="#ffffff" size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="training-session-live-cancel-modal-confirm-label" testID="training-session-live-cancel-modal-confirm-label">Cancelar sesión</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SkipMenuModal({ visible, onCancel, onSkipSeries, onSkipExercise }) {
  return (
    <Modal animationType="fade" nativeID="training-session-live-skip-modal" onRequestClose={onCancel} testID="training-session-live-skip-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="training-session-live-skip-modal-backdrop" onPress={onCancel} testID="training-session-live-skip-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="training-session-live-skip-modal-card" onPress={() => {}} testID="training-session-live-skip-modal-card">
          <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="training-session-live-skip-modal-title" testID="training-session-live-skip-modal-title">¿Qué querés saltear?</Text>
          <View className="mt-4 gap-3" nativeID="training-session-live-skip-modal-options" testID="training-session-live-skip-modal-options">
            <Pressable className="h-11 items-center justify-center rounded-full border border-slate-200 px-4 active:opacity-70 dark:border-slate-700" nativeID="training-session-live-skip-modal-series-button" onPress={onSkipSeries} testID="training-session-live-skip-modal-series-button">
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="training-session-live-skip-modal-series-label" testID="training-session-live-skip-modal-series-label">Saltar esta serie</Text>
            </Pressable>
            <Pressable className="h-11 items-center justify-center rounded-full bg-amber-500 px-4 active:opacity-80" nativeID="training-session-live-skip-modal-exercise-button" onPress={onSkipExercise} testID="training-session-live-skip-modal-exercise-button">
              <Text className="text-sm font-semibold uppercase tracking-wide text-amber-950" nativeID="training-session-live-skip-modal-exercise-label" testID="training-session-live-skip-modal-exercise-label">Saltar todo el ejercicio</Text>
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
    <Modal animationType="fade" nativeID="training-session-live-finish-set-modal" onRequestClose={onClose} testID="training-session-live-finish-set-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="training-session-live-finish-set-modal-backdrop" onPress={onClose} testID="training-session-live-finish-set-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="training-session-live-finish-set-modal-card" onPress={() => {}} testID="training-session-live-finish-set-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="training-session-live-finish-set-modal-header" testID="training-session-live-finish-set-modal-header">
            <MaterialCommunityIcons color={colors.primary} name="flag-checkered" size={20} />
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="training-session-live-finish-set-modal-title" testID="training-session-live-finish-set-modal-title">Serie finalizada</Text>
          </View>
          <View className="gap-2" nativeID="training-session-live-finish-set-modal-rows" testID="training-session-live-finish-set-modal-rows">
            <View className="flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60" nativeID="training-session-live-finish-set-modal-wall" testID="training-session-live-finish-set-modal-wall">
              <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-live-finish-set-modal-wall-label" testID="training-session-live-finish-set-modal-wall-label">Tiempo total</Text>
              <Text className="text-sm font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="training-session-live-finish-set-modal-wall-value" testID="training-session-live-finish-set-modal-wall-value">{formatStopwatch(summary.wallMs)}</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60" nativeID="training-session-live-finish-set-modal-active" testID="training-session-live-finish-set-modal-active">
              <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-live-finish-set-modal-active-label" testID="training-session-live-finish-set-modal-active-label">Tiempo activo</Text>
              <Text className="text-sm font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID="training-session-live-finish-set-modal-active-value" testID="training-session-live-finish-set-modal-active-value">{formatStopwatch(summary.activeMs)}</Text>
            </View>
            {summary.distanceMeters != null && (
              <View className="flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60" nativeID="training-session-live-finish-set-modal-distance" testID="training-session-live-finish-set-modal-distance">
                <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-live-finish-set-modal-distance-label" testID="training-session-live-finish-set-modal-distance-label">Distancia</Text>
                <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID="training-session-live-finish-set-modal-distance-value" testID="training-session-live-finish-set-modal-distance-value">{formatMeters(summary.distanceMeters)}</Text>
              </View>
            )}
          </View>
          <Pressable className="mt-5 h-12 flex-row items-center justify-center gap-2 self-stretch rounded-full bg-primary px-6 active:opacity-80" nativeID="training-session-live-finish-set-modal-next-button" onPress={onClose} testID="training-session-live-finish-set-modal-next-button">
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="training-session-live-finish-set-modal-next-label" numberOfLines={1} testID="training-session-live-finish-set-modal-next-label">Siguiente</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LiveOverviewView({ sets, run, activeSetId, activePhase, onOpenSet, onCancel, router }) {
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
    <View className="flex-1" nativeID="training-session-live-overview-container" testID="training-session-live-overview-container">
      <View className="flex-row items-center justify-between px-4 pt-2" nativeID="training-session-live-overview-header-row" testID="training-session-live-overview-header-row">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="training-session-live-overview-header-label" testID="training-session-live-overview-header-label">
          Sesión presencial
        </Text>
        <AttendanceQuickAccessButton idPrefix="training-session-live-overview" router={router} />
      </View>
      <ScrollView contentContainerClassName="p-4" nativeID="training-session-live-overview-scroll" testID="training-session-live-overview-scroll">
        <View className="mb-3" nativeID="training-session-live-overview-title-block" testID="training-session-live-overview-title-block">
          <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID="training-session-live-overview-title" testID="training-session-live-overview-title">{run.session_name}</Text>
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-live-overview-date" testID="training-session-live-overview-date">{run.session_date}</Text>
        </View>

        <View className="mb-4 flex-row flex-wrap gap-2" nativeID="training-session-live-overview-counts" testID="training-session-live-overview-counts">
          <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 dark:bg-emerald-900/20" nativeID="training-session-live-overview-finished-count" testID="training-session-live-overview-finished-count">
            <View className="h-2 w-2 rounded-full bg-primary" nativeID="training-session-live-overview-finished-dot" testID="training-session-live-overview-finished-dot" />
            <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400" nativeID="training-session-live-overview-finished-count-label" testID="training-session-live-overview-finished-count-label">{finishedCount} completadas</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="training-session-live-overview-skipped-count" testID="training-session-live-overview-skipped-count">
            <View className="h-2 w-2 rounded-full bg-slate-400" nativeID="training-session-live-overview-skipped-dot" testID="training-session-live-overview-skipped-dot" />
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="training-session-live-overview-skipped-count-label" testID="training-session-live-overview-skipped-count-label">{skippedCount} salteadas</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID="training-session-live-overview-pending-count" testID="training-session-live-overview-pending-count">
            <View className="h-2 w-2 rounded-full bg-amber-400" nativeID="training-session-live-overview-pending-dot" testID="training-session-live-overview-pending-dot" />
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="training-session-live-overview-pending-count-label" testID="training-session-live-overview-pending-count-label">{pendingCount} pendientes</Text>
          </View>
        </View>

        <View className="gap-3" nativeID="training-session-live-overview-exercises" testID="training-session-live-overview-exercises">
          {groups.map((group) => {
            const isNext = nextSet != null && String(group.exerciseInstanceId) === String(nextSet.exercise_instance_id);
            const isActiveGroup = group.sets.some((s) => s.id === activeSetId);
            // Ya resuelto (todas sus series completadas/salteadas, ninguna
            // pending) -- no es "el próximo" pero tampoco está bloqueado por
            // nada, así que no debería mostrar el aviso de "se habilita
            // cuando completes las anteriores" (bug real, 2026-09-30: se
            // mostraba en cualquier ejercicio que no fuera el actual, incluidos
            // los ya pasados).
            const isResolved = group.sets.every((s) => s.status !== 'pending');
            const hiddenPrefix = `training-session-live-overview-exercise-${group.exerciseInstanceId}`;
            return (
              <Pressable
                className={`rounded-2xl border p-3 ${isNext || isActiveGroup ? 'border-primary bg-primary/10 active:opacity-80' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                disabled={!isNext && !isActiveGroup}
                key={group.exerciseInstanceId}
                nativeID={`${hiddenPrefix}-card`}
                onPress={() => onOpenSet(group.sets.find((s) => s.id === activeSetId) ?? group.sets.find((s) => s.status === 'pending'))}
                testID={`${hiddenPrefix}-card`}
              >
                <View className="flex-row items-center justify-between" nativeID={`${hiddenPrefix}-header`} testID={`${hiddenPrefix}-header`}>
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${hiddenPrefix}-name`} testID={`${hiddenPrefix}-name`}>{group.exerciseName}</Text>
                  {(isNext || isActiveGroup) && <MaterialCommunityIcons color={colors.primary} name="play-circle-outline" size={20} />}
                </View>
                <View className="mt-2.5 flex-row items-center gap-2" nativeID={`${hiddenPrefix}-chips`} testID={`${hiddenPrefix}-chips`}>
                  {group.sets.map((set) => (
                    <SetStatusChip idPrefix={hiddenPrefix} isActive={set.id === activeSetId} key={set.id} phase={activePhase} set={set} />
                  ))}
                </View>
                {!isNext && !isActiveGroup && !isResolved && (
                  <Text className="mt-2 text-xs text-slate-400 dark:text-slate-500" nativeID={`${hiddenPrefix}-locked-note`} testID={`${hiddenPrefix}-locked-note`}>
                    Se habilita cuando completes las anteriores
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="border-t border-slate-100 p-4 dark:border-slate-800" nativeID="training-session-live-overview-footer" testID="training-session-live-overview-footer">
        <HoldToCancelButton disabled={false} idPrefix="training-session-live-overview" onTrigger={() => setCancelVisible(true)} />
      </View>

      <ConfirmCancelModal onCancel={() => setCancelVisible(false)} onConfirm={onCancel} visible={cancelVisible} />
    </View>
  );
}

function LiveSeriesView({
  set,
  totalSeriesForExercise,
  activePhase,
  wallMs,
  distance,
  onStart,
  onPause,
  onResume,
  onFinish,
  onSkipSeries,
  onSkipExercise,
  onBack,
  onAdvance,
  onCancelConfirmed,
}) {
  const colors = useThemeColors();
  const [countdown, setCountdown] = useState(null); // null = sin countdown corriendo
  const [skipVisible, setSkipVisible] = useState(false);
  const [summary, setSummary] = useState(null);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const countdownTimerRef = useRef(null);

  useEffect(() => {
    logDebug(`LiveSeriesView montado set=${set.id} nombre="${set.exercise_name}" serie=${set.set_number + 1} status="${set.status}"`);
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginAfterCountdown = async () => {
    try {
      await onStart(set.id);
    } catch (error) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos iniciar la serie', text2: error.message });
    } finally {
      setBusy(false);
    }
  };

  // OJO acá: nunca llamar a beginAfterCountdown() (que termina disparando un
  // setState del HOOK PADRE vía onStart) desde DENTRO de un updater funcional
  // de setState de ESTE componente -- React lo rechaza con "Cannot update a
  // component while rendering a different component" (bug real, encontrado
  // en dispositivo 2026-09-29). Por eso el conteo se lleva en una variable
  // plana del closure del intervalo, no en el `prev` del updater -- mismo
  // patrón que ya usa el countdown de la pantalla asíncrona.
  const startCountdown = () => {
    let remaining = 3;
    setCountdown(remaining);
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
        setCountdown(null);
        setBusy(true);
        beginAfterCountdown();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    setCountdown(null);
  };

  const handlePlay = () => {
    if (busy) return;
    if (set.status === 'pending') { startCountdown(); return; }
    if (activePhase === 'paused') {
      setBusy(true);
      onResume().finally(() => setBusy(false));
    }
  };

  const handlePause = async () => {
    if (activePhase !== 'running' || busy) return;
    setBusy(true);
    try {
      await onPause();
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const snap = await onFinish(set.id);
      setSummary(snap);
    } catch (error) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos finalizar la serie', text2: error.message });
    } finally {
      setBusy(false);
    }
  };

  // onSkipSeries/onSkipExercise ya deciden y aplican la navegación (siguiente
  // serie o overview/finalizar) del lado del padre -- llamar a onBack() acá
  // encima pisaba esa decisión y siempre forzaba volver a overview, aunque
  // el padre hubiera elegido saltar directo a la próxima serie.
  const skipSeries = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSkipSeries(set.id);
      setSkipVisible(false);
    } finally {
      setBusy(false);
    }
  };

  const skipExercise = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSkipExercise(set.exercise_instance_id);
      setSkipVisible(false);
    } finally {
      setBusy(false);
    }
  };

  const running = activePhase === 'running' && set.status === 'started';
  const paused = activePhase === 'paused' && set.status === 'started';
  const showTimer = running || paused;
  const idPrefix = `training-session-live-series-${set.id}`;
  const phaseLabel = running ? 'En curso' : paused ? 'En pausa' : countdown != null ? 'Preparando…' : 'Listo para iniciar';

  return (
    <View className="flex-1 p-4" nativeID={`${idPrefix}-container`} testID={`${idPrefix}-container`}>
      <View className="flex-1 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" nativeID={`${idPrefix}-card`} testID={`${idPrefix}-card`}>
        <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
          <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" disabled={running || paused} nativeID={`${idPrefix}-back-button`} onPress={onBack} testID={`${idPrefix}-back-button`}>
            <MaterialCommunityIcons color={running || paused ? colors.onSurfaceVariant + '55' : colors.onSurfaceVariant} name="arrow-left" size={20} />
          </Pressable>
          <View className="flex-row items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" nativeID={`${idPrefix}-phase-pill`} testID={`${idPrefix}-phase-pill`}>
            <View className={`h-2 w-2 rounded-full ${running ? 'bg-primary' : 'bg-amber-400'}`} nativeID={`${idPrefix}-phase-dot`} testID={`${idPrefix}-phase-dot`} />
            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-phase-label`} testID={`${idPrefix}-phase-label`}>{phaseLabel}</Text>
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
            <View className="mb-4 flex-row items-center gap-2 rounded-full bg-emerald-50 px-5 py-2 dark:bg-emerald-900/20" nativeID={`${idPrefix}-gps-pill`} testID={`${idPrefix}-gps-pill`}>
              <MaterialCommunityIcons color="#16a34a" name="crosshairs-gps" size={24} />
              <Text className="text-4xl font-bold text-emerald-700 dark:text-emerald-400" nativeID={`${idPrefix}-gps-label`} testID={`${idPrefix}-gps-label`}>
                {formatMeters(distance)}
              </Text>
            </View>
          )}
          <Text className="text-6xl text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID={`${idPrefix}-timer`} testID={`${idPrefix}-timer`}>
            {showTimer ? formatStopwatch(wallMs) : '00:00:00'}
          </Text>
          <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-timer-hint`} testID={`${idPrefix}-timer-hint`}>
            {set.status === 'pending' ? 'Toque Play para arrancar — se arma en 3 segundos' : ''}
          </Text>
        </View>

        {set.status === 'pending' && (
          <View className="mb-4" nativeID={`${idPrefix}-skip-hint`} testID={`${idPrefix}-skip-hint`}>
            <Pressable className="h-11 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-skip-button`} onPress={() => setSkipVisible(true)} testID={`${idPrefix}-skip-button`}>
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-skip-label`} testID={`${idPrefix}-skip-label`}>Saltear</Text>
            </Pressable>
          </View>
        )}

        <View className="gap-3" nativeID={`${idPrefix}-controls`} testID={`${idPrefix}-controls`}>
          {set.status === 'pending' && countdown == null && (
            <Pressable className="h-16 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 active:opacity-80" nativeID={`${idPrefix}-play-button`} onPress={handlePlay} testID={`${idPrefix}-play-button`}>
              <MaterialCommunityIcons color={colors.onPrimary} name="play" size={28} />
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-play-label`} numberOfLines={1} testID={`${idPrefix}-play-label`}>Iniciar serie</Text>
            </Pressable>
          )}

          {paused && (
            <>
              <Pressable className="h-16 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 active:opacity-80" nativeID={`${idPrefix}-resume-button`} onPress={handlePlay} testID={`${idPrefix}-resume-button`}>
                <MaterialCommunityIcons color={colors.onPrimary} name="play" size={28} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-resume-label`} numberOfLines={1} testID={`${idPrefix}-resume-label`}>Reanudar</Text>
              </Pressable>
              <View className="flex-row gap-3" nativeID={`${idPrefix}-secondary-controls`} testID={`${idPrefix}-secondary-controls`}>
                <Pressable className="h-12 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700" disabled={busy} nativeID={`${idPrefix}-skip-button`} onPress={() => setSkipVisible(true)} testID={`${idPrefix}-skip-button`}>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="skip-next" size={18} />
                </Pressable>
                <DragToFinishButton disabled={false} idPrefix={idPrefix} label="Deslizá para finalizar" onTrigger={handleFinish} />
              </View>
            </>
          )}

          {running && (
            <View className="flex-row gap-3" nativeID={`${idPrefix}-running-controls`} testID={`${idPrefix}-running-controls`}>
              <DragToFinishButton icon="pause" idPrefix={`${idPrefix}-pause`} label="Deslizá para pausar" onTrigger={handlePause} variant="neutral" />
              <DragToFinishButton disabled={false} idPrefix={idPrefix} label="Deslizá para finalizar" onTrigger={handleFinish} />
            </View>
          )}
        </View>

        <View className="mt-4" nativeID={`${idPrefix}-cancel-zone`} testID={`${idPrefix}-cancel-zone`}>
          <HoldToCancelButton disabled={busy} idPrefix={idPrefix} onTrigger={() => setCancelVisible(true)} />
        </View>
      </View>

      {countdown != null && <CountdownOverlay onCancelCountdown={cancelCountdown} value={countdown} />}

      <SkipMenuModal onCancel={() => setSkipVisible(false)} onSkipExercise={skipExercise} onSkipSeries={skipSeries} visible={skipVisible} />
      <FinishSummaryModal onClose={() => { setSummary(null); onAdvance(); }} summary={summary ?? { wallMs: 0, activeMs: 0 }} visible={summary != null} />
      <ConfirmCancelModal
        onCancel={() => setCancelVisible(false)}
        onConfirm={async () => { await onCancelConfirmed(); }}
        visible={cancelVisible}
      />
    </View>
  );
}

function TrainingSessionLiveScreenContent() {
  const router = useRouter();
  const clearLiveSession = useLiveSessionStore((s) => s.clearLiveSession);
  const {
    booted,
    bootError,
    run,
    sets,
    connectionStatus,
    pendingControl,
    clearPendingControl,
    distanceBySetId,
    activeSetId,
    activePhase,
    stopwatchWallMs,
    startSet,
    pauseSet,
    resumeSet,
    finishSet,
    skipSet,
    skipExercise,
    cancelSession,
    finalizeSession,
  } = useLiveSessionRuntime();
  const [mode, setMode] = useState('overview'); // 'overview' | 'series'
  const [currentSetId, setCurrentSetId] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const finalizeTriggeredRef = useRef(false);

  // Detecta que no queda ninguna serie pendiente y finaliza -- reacciona a
  // `sets` (no a un chequeo puntual dentro de advance()) para cubrir DOS
  // casos con el mismo código: (1) se acaba de terminar/saltear la última
  // serie de la sesión, y (2) el corredor RE-ENTRA a una sesión que ya
  // había quedado sin pendientes de una vuelta anterior (antes no pasaba
  // nada visible en este caso -- bug real reportado 2026-09-29). También
  // evita el problema de leer `sets` desde un closure potencialmente
  // obsoleto justo después de un await (advance() lo hacía antes) -- acá
  // siempre corre con el `sets` ya confirmado por React.
  useEffect(() => {
    if (!booted || sets.length === 0 || finalizeTriggeredRef.current) return;
    // "pending" no alcanza -- una serie recién iniciada (status "started")
    // tampoco es "pending" pero sigue en curso, no resuelta. Con solo chequear
    // "sin pending" bastaba con arrancar el conteo regresivo de la ÚLTIMA
    // serie de la sesión para que este efecto la diera por terminada de
    // inmediato (bug real, 2026-09-30: la sesión se cortaba sola apenas
    // arrancaba la última serie, sin completarla ni saltearla, esa serie
    // quedaba sin ended_at/duración -- nunca la toma getSetsForSync, por eso
    // aparecía "Sin registro" solo para esa). El criterio correcto es que
    // TODAS las series estén en un estado terminal.
    const allResolved = sets.every((s) => s.status === 'finished' || s.status === 'skipped' || s.status === 'interrupted');
    if (!allResolved) return;
    finalizeTriggeredRef.current = true;
    finalizeSession()
      .then(() => { notifySuccess(); setSessionComplete(true); })
      .catch(() => { notifyError(); finalizeTriggeredRef.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, booted]);

  useEffect(() => {
    if (!pendingControl) return;
    if (pendingControl.event === 'announcement') {
      Toast.show({ type: 'info', text1: 'Aviso del entrenador', text2: pendingControl.payload?.message ?? '' });
      clearPendingControl();
      return;
    }
    if (pendingControl.event === 'session_paused') {
      // La pausa en sí ya la aplica el hook apenas llega el mensaje -- acá
      // solo se avisa.
      Toast.show({ type: 'info', text1: 'El entrenador pausó tu serie en curso' });
      clearPendingControl();
      return;
    }
    if (pendingControl.event === 'session_finished' && !finishing) {
      setFinishing(true);
      finalizeSession().finally(() => {
        clearLiveSession();
        router.back();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingControl]);

  if (!booted) {
    return (
      <MobileOnlyRoute>
        <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="training-session-live-loading" testID="training-session-live-loading">
          <ActivityIndicator color="#8cc63e" size="large" />
          <Text className="mt-3 text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-live-loading-label" testID="training-session-live-loading-label">
            {bootError ? 'No pudimos preparar la sesión' : 'Preparando la sesión…'}
          </Text>
        </View>
      </MobileOnlyRoute>
    );
  }

  const handleOpenSet = (set) => {
    if (!set) return;
    setCurrentSetId(set.id);
    setMode('series');
  };

  // Igual que el flujo asíncrono: al terminar/saltear una serie se salta
  // directo a la próxima (sin volver a overview en el medio). La detección
  // de "no queda ninguna pendiente -> finalizar" vive aparte, en el efecto
  // de arriba (reacciona a `sets` ya confirmado, no a este closure).
  // `sourceSets` opcional: cuando el caller ya tiene un array más fresco que
  // el `sets` de este render (ver skipSet/skipExercise en el hook -- su
  // propio reloadSets recién resuelto), se usa ese en vez del closure de acá.
  const advance = (sourceSets) => {
    const list = sourceSets ?? sets;
    const next = list.find((s) => s.status === 'pending');
    if (next) {
      setCurrentSetId(next.id);
      setMode('series');
      return;
    }
    setMode('overview');
  };

  const handleFinishSet = async (setId) => {
    const snap = await finishSet(setId);
    return snap;
  };

  const handleSkipSet = async (setId) => {
    const updated = await skipSet(setId);
    advance(updated);
  };

  const handleSkipExercise = async (exerciseInstanceId) => {
    const updated = await skipExercise(exerciseInstanceId);
    advance(updated);
  };

  const handleCancelConfirmed = async () => {
    try {
      await cancelSession();
      notifySuccess();
    } catch {
      notifyError();
    } finally {
      clearLiveSession();
      router.back();
    }
  };

  const currentSet = mode === 'series' ? sets.find((s) => s.id === currentSetId) : null;

  return (
    <MobileOnlyRoute>
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="training-session-live-root" testID="training-session-live-root">
        <View className="items-center py-2" nativeID="training-session-live-banner-container" testID="training-session-live-banner-container">
          {connectionStatus && <ConnectionBanner status={connectionStatus} />}
        </View>

        {currentSet ? (
          <LiveSeriesView
            activePhase={activePhase}
            distance={distanceBySetId.get(currentSet.id)}
            key={currentSet.id}
            onAdvance={advance}
            onBack={() => setMode('overview')}
            onCancelConfirmed={handleCancelConfirmed}
            onFinish={async (setId) => {
              const snap = await handleFinishSet(setId);
              return snap;
            }}
            onPause={pauseSet}
            onResume={resumeSet}
            onSkipExercise={handleSkipExercise}
            onSkipSeries={handleSkipSet}
            onStart={startSet}
            set={currentSet}
            totalSeriesForExercise={sets.filter((s) => s.exercise_instance_id === currentSet.exercise_instance_id).length}
            wallMs={stopwatchWallMs}
          />
        ) : (
          <LiveOverviewView
            activePhase={activePhase}
            activeSetId={activeSetId}
            onCancel={handleCancelConfirmed}
            onOpenSet={handleOpenSet}
            router={router}
            run={run}
            sets={sets}
          />
        )}

        <Modal animationType="fade" nativeID="training-session-live-complete-modal" onRequestClose={() => { clearLiveSession(); router.back(); }} testID="training-session-live-complete-modal" transparent visible={sessionComplete}>
          <Pressable
            className="flex-1 items-center justify-center bg-black/50 px-4"
            nativeID="training-session-live-complete-modal-backdrop"
            onPress={() => { clearLiveSession(); router.back(); }}
            testID="training-session-live-complete-modal-backdrop"
          >
            <Pressable className="w-full max-w-md items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="training-session-live-complete-modal-card" onPress={() => {}} testID="training-session-live-complete-modal-card">
              <MaterialCommunityIcons color="#16a34a" name="check-decagram" size={40} />
              <Text className="mt-2 text-xl font-bold text-slate-900 dark:text-white" nativeID="training-session-live-complete-modal-title" testID="training-session-live-complete-modal-title">¡Sesión completada!</Text>
              <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="training-session-live-complete-modal-subtitle" testID="training-session-live-complete-modal-subtitle">
                Completaste todos los ejercicios de la sesión.
              </Text>
              <Pressable
                className="mt-5 h-12 w-full items-center justify-center rounded-full bg-primary active:opacity-80"
                nativeID="training-session-live-complete-modal-close-button"
                onPress={() => { clearLiveSession(); router.back(); }}
                testID="training-session-live-complete-modal-close-button"
              >
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="training-session-live-complete-modal-close-label" testID="training-session-live-complete-modal-close-label">Terminar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </MobileOnlyRoute>
  );
}

export function TrainingSessionLiveScreen() {
  return (
    <MobileOnlyRoute>
      <TrainingSessionLiveScreenContent />
    </MobileOnlyRoute>
  );
}
