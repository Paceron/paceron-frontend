import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useLiveSessionRuntime } from '../../hooks/use-live-session-runtime.js';
import { useStopwatch } from '../../hooks/use-stopwatch.js';
import { formatStopwatch } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
import { notifyError, notifySuccess } from '../../utils/haptics.js';

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

function SeriesRow({ set, isNext, onStart, onFinish, onSkip, distance }) {
  const colors = useThemeColors();
  const stopwatch = useStopwatch();
  const idPrefix = `training-session-live-set-${set.id}`;
  const running = set.status === 'started';

  const handlePlay = async () => {
    stopwatch.start();
    await onStart(set.id);
  };

  const handleFinish = async () => {
    const snap = stopwatch.pause();
    await onFinish(set.id, snap);
  };

  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" nativeID={`${idPrefix}-card`} testID={`${idPrefix}-card`}>
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
          {set.exercise_name} · Serie {set.set_number + 1}
        </Text>
        <Text className="text-xs uppercase text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-status`} testID={`${idPrefix}-status`}>
          {set.status}
        </Text>
      </View>
      {running && (
        <Text className="mt-2 text-3xl text-slate-900 dark:text-white" style={{ fontFamily: 'Orbitron_700Bold' }} nativeID={`${idPrefix}-timer`} testID={`${idPrefix}-timer`}>
          {formatStopwatch(stopwatch.wallMs)}
        </Text>
      )}
      {distance != null && (
        <Text className="mt-1 text-sm text-emerald-700 dark:text-emerald-400" nativeID={`${idPrefix}-distance`} testID={`${idPrefix}-distance`}>
          {formatMeters(distance)}
        </Text>
      )}
      {isNext && set.status === 'pending' && (
        <View className="mt-3 flex-row gap-2" nativeID={`${idPrefix}-actions-pending`} testID={`${idPrefix}-actions-pending`}>
          <Pressable className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80" nativeID={`${idPrefix}-play-button`} onPress={handlePlay} testID={`${idPrefix}-play-button`}>
            <MaterialCommunityIcons color={colors.onPrimary} name="play" size={18} />
            <Text className="text-sm font-bold uppercase text-[#111518]" nativeID={`${idPrefix}-play-label`} testID={`${idPrefix}-play-label`}>Iniciar</Text>
          </Pressable>
          <Pressable className="h-11 items-center justify-center rounded-full border border-slate-200 px-4 active:opacity-70 dark:border-slate-700" nativeID={`${idPrefix}-skip-button`} onPress={() => onSkip(set.id)} testID={`${idPrefix}-skip-button`}>
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-skip-label`} testID={`${idPrefix}-skip-label`}>Saltear</Text>
          </Pressable>
        </View>
      )}
      {running && (
        <Pressable className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80" nativeID={`${idPrefix}-finish-button`} onPress={handleFinish} testID={`${idPrefix}-finish-button`}>
          <MaterialCommunityIcons color={colors.onPrimary} name="flag-checkered" size={18} />
          <Text className="text-sm font-bold uppercase text-[#111518]" nativeID={`${idPrefix}-finish-label`} testID={`${idPrefix}-finish-label`}>Finalizar</Text>
        </Pressable>
      )}
    </View>
  );
}

function TrainingSessionLiveScreenContent() {
  const router = useRouter();
  const clearLiveSession = useLiveSessionStore((s) => s.clearLiveSession);
  const {
    booted,
    bootError,
    sets,
    connectionStatus,
    pendingControl,
    clearPendingControl,
    distanceBySetId,
    startSet,
    finishSet,
    skipSet,
    cancelSession,
    finalizeSession,
  } = useLiveSessionRuntime();
  const [finishing, setFinishing] = useState(false);

  const nextSet = sets.find((s) => s.status === 'pending');

  // Side effects de un mensaje de control entrante van en un efecto, nunca
  // directo en el cuerpo del render (llamar Toast.show/finalizeSession ahí
  // dispararía en cada render, no solo cuando pendingControl cambia).
  useEffect(() => {
    if (!pendingControl) return;
    if (pendingControl.event === 'announcement') {
      Toast.show({ type: 'info', text1: 'Aviso del entrenador', text2: pendingControl.payload?.message ?? '' });
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

  const handleFinishAll = async () => {
    try {
      await finalizeSession();
      notifySuccess();
    } catch {
      notifyError();
    } finally {
      clearLiveSession();
      router.back();
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSession();
    } finally {
      clearLiveSession();
      router.back();
    }
  };

  return (
    <MobileOnlyRoute>
      <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="training-session-live-root" testID="training-session-live-root">
        <View className="items-center py-2" nativeID="training-session-live-banner-container" testID="training-session-live-banner-container">
          <ConnectionBanner status={connectionStatus} />
        </View>
        <ScrollView contentContainerClassName="gap-3 p-4" nativeID="training-session-live-scroll" testID="training-session-live-scroll">
          {sets.map((set) => (
            <SeriesRow
              distance={distanceBySetId.get(set.id)}
              isNext={nextSet?.id === set.id}
              key={set.id}
              onFinish={finishSet}
              onSkip={skipSet}
              onStart={startSet}
              set={set}
            />
          ))}
        </ScrollView>
        <View className="flex-row gap-3 border-t border-slate-100 p-4 dark:border-slate-800" nativeID="training-session-live-footer" testID="training-session-live-footer">
          <Pressable className="h-12 flex-1 items-center justify-center rounded-full border border-red-300 active:opacity-70 dark:border-red-900/60" nativeID="training-session-live-cancel-button" onPress={handleCancel} testID="training-session-live-cancel-button">
            <Text className="text-sm font-semibold text-red-700 dark:text-red-400" nativeID="training-session-live-cancel-label" testID="training-session-live-cancel-label">Cancelar</Text>
          </Pressable>
          <Pressable className="h-12 flex-1 items-center justify-center rounded-full bg-primary active:opacity-80" nativeID="training-session-live-finish-all-button" onPress={handleFinishAll} testID="training-session-live-finish-all-button">
            <Text className="text-sm font-bold uppercase text-[#111518]" nativeID="training-session-live-finish-all-label" testID="training-session-live-finish-all-label">Finalizar sesión</Text>
          </Pressable>
        </View>
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
