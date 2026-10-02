import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useRunnerSession } from '../../hooks/use-runner-session.js';
import { createRunnerSession } from '../../services/runnerSession.js';
import { getLatestRun, initSessionDb, RUN_STATUS } from '../../services/session-db.js';
import { isPastSessionDate } from '../../utils/session-start-window.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { logDebug } from '../../utils/debug-log.js';

// URL universal de Google Maps -- funciona igual en la app nativa (abre la
// app de mapas instalada si el sistema la asocia a ese link) y en web (nueva
// pestaña), sin ramificar por plataforma.
function openLocationInMaps(location) {
  if (!location?.lat || !location?.lng) return;
  // Coordenadas, no el label -- el label es solo para mostrar, puede ser
  // ambiguo (nombre repetido en otro lugar); lat/lng es siempre exacto.
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`);
}

function ExerciseRow({ exercise, idPrefix }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const rowId = `${idPrefix}-exercise-${exercise.id}`;
  const hasMultipleSeries = exercise.repeatCount > 1;

  return (
    <View className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={rowId} testID={rowId}>
      <Pressable
        className="flex-row items-center justify-between"
        disabled={!hasMultipleSeries}
        nativeID={`${rowId}-toggle`}
        onPress={() => setExpanded((v) => !v)}
        testID={`${rowId}-toggle`}
      >
        <View nativeID={`${rowId}-summary`} testID={`${rowId}-summary`}>
          <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${rowId}-name`} testID={`${rowId}-name`}>
            {exercise.name}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${rowId}-detail`} testID={`${rowId}-detail`}>
            {exercise.repeatCount} serie{hasMultipleSeries ? 's' : ''} · descanso {exercise.restMinutes} min
          </Text>
        </View>
        {hasMultipleSeries && <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />}
      </Pressable>
      {expanded && hasMultipleSeries && (
        <View className="mt-2 gap-1 border-t border-slate-100 pt-2 dark:border-slate-800" nativeID={`${rowId}-series-list`} testID={`${rowId}-series-list`}>
          {Array.from({ length: exercise.repeatCount }, (_, i) => (
            <Text className="text-xs text-slate-600 dark:text-slate-300" key={i} nativeID={`${rowId}-series-${i + 1}`} testID={`${rowId}-series-${i + 1}`}>
              Serie {i + 1}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function SessionPreStartScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const setReviewSlot = useSessionReviewStore((s) => s.setReviewSlot);
  const setGpsEnabled = useLiveSessionStore((s) => s.setGpsEnabled);
  const userId = useAuthStore((s) => s.userId);
  const [starting, setStarting] = useState(false);
  // 'completed' | 'cancelled' | null -- cubre el mismo hueco corto que antes
  // (local vs. confirmación remota) para los DOS cierres terminales (Gap 19:
  // cancelar ya no deja el runner_session en wip para siempre, así que
  // también necesita su propia ventana de "ya sé localmente que terminó").
  const [locallyTerminalStatus, setLocallyTerminalStatus] = useState(null);

  const sessionInstanceId = pendingSession?.sessionInstance?.id;
  const { runnerSession, loading: runnerSessionLoading, refetch } = useRunnerSession(sessionInstanceId, userId);

  useFocusEffect(
    useCallback(() => {
      refetch();
      // Esta pantalla no se desmonta al navegar a la sesión en vivo (sigue en
      // el stack) -- sin este reset, "starting" quedaba en true para siempre
      // al volver con router.back() y el botón Play quedaba bloqueado.
      setStarting(false);
      // finalizeSession() marca el run local como completado y dispara el
      // cierre remoto de runner_session SIN esperarlo (fire-and-forget, a
      // propósito) -- así que el refetch de arriba puede resolver ANTES que
      // ese PATCH llegue al backend, mostrando Play de nuevo aunque ya se
      // haya terminado todo (bug real, 2026-09-30: un tap rápido ahí creaba
      // un run nuevo desde cero). Chequeo local aparte (SQLite, sin red) para
      // no depender solo del estado remoto en esta ventana corta.
      let cancelled = false;
      (async () => {
        try {
          await initSessionDb();
          const latest = await getLatestRun(sessionInstanceId, pendingSession?.date, userId);
          if (!cancelled) {
            setLocallyTerminalStatus(
              latest?.status === RUN_STATUS.COMPLETED ? 'completed' : latest?.status === RUN_STATUS.CANCELLED ? 'cancelled' : null,
            );
          }
        } catch {
          if (!cancelled) setLocallyTerminalStatus(null);
        }
      })();
      return () => { cancelled = true; };
    }, [refetch, sessionInstanceId, pendingSession?.date, userId]),
  );

  // Registro de Sesión vs. Play (spec 2026-09-24). El `runner_session` manda
  // POR ENCIMA de la fecha: una sesión de HOY que el corredor acaba de
  // terminar tiene que ir al registro también, no al Play — si no, al volver
  // acá después de "Terminar" el botón Play sigue disponible y deja correr
  // dos veces la misma sesión (getActiveRun solo busca runs `in_progress`, así
  // que el segundo Play crea un run nuevo desde cero). `locallyCompleted`
  // cubre el hueco corto entre ese cierre local y la confirmación remota.
  const past = isPastSessionDate(pendingSession ?? { date: '' });
  const finished = runnerSession?.status === 'finished' || locallyTerminalStatus === 'completed';
  // Gap 19: cancelar a mitad de camino es una terminación temprana, no
  // "deshacer" -- entra a Registro de Sesión igual que `finished` (lo ya
  // hecho queda ahí para revisar/editar), nunca vuelve a Play.
  const interrupted = runnerSession?.status === 'interrupted' || locallyTerminalStatus === 'cancelled';
  const mode = finished || interrupted ? 'review' : 'manual';
  const showReview = past || finished || interrupted;

  if (!pendingSession) return <Redirect href="/" />;

  const exercises = pendingSession.sessionInstance?.exercises ?? [];

  // Permiso GPS una sola vez por sesión (se pide acá, al darle Play). Si el
  // usuario lo niega o el build no tiene el módulo, la sesión arranca igual
  // pero sin distancias — gpsEnabled queda en falso para toda la sesión.
  const handlePlay = async () => {
    // Guard contra doble tap: handlePlay es async (permiso GPS de por medio,
    // hasta 5s de timeout) -- sin esto, un segundo tap antes de que resuelva
    // dispara un segundo router.push, montando dos instancias del runtime
    // en simultáneo sobre el mismo canal WS (bug real, 2026-09-30: la
    // primera en desmontarse desuscribía el canal para la otra también,
    // "no suscripto al canal" en los logs).
    // runnerSessionLoading: al volver de una sesión recién completada, el
    // refetch de foco todavía puede no haber confirmado el estado "finished"
    // -- sin este guard, un tap rápido acá creaba un run local nuevo desde
    // cero para una sesión que el backend ya tiene cerrada (bug real,
    // 2026-09-30).
    if (starting || runnerSessionLoading) return;
    setStarting(true);
    // Fire-and-forget del estado runner_session (wip, idempotente): si el Play
    // arranca offline, el pipeline de sync reintenta el mismo upsert antes del
    // primer POST feedback. No se espera acá porque no bloquea la navegación.
    createRunnerSession(sessionInstanceId, { startDate: new Date().toISOString() }).catch(() => {});
    // Confirmado con logs (2026-09-30): getCurrentPositionAsync no respeta su
    // propio `timeout` -- se observó una resolución real de ~25s contra un
    // timeout de 5s pedido (quirk conocido de expo-location en ciertos
    // Android/proveedores de ubicación), bloqueando el Play entero por ese
    // tiempo. Ya no se espera acá: gpsEnabled se decide solo por el permiso
    // (rápido, típicamente <200ms) y se navega de inmediato. El tracker
    // continuo de la sesión (useSessionGpsTracker/useGpsTracker) usa
    // watchPositionAsync, una API distinta que no bloquea nada -- si el GPS
    // realmente no consigue un fix, simplemente no llegan puntos, mismo
    // resultado gracioso que cuando el permiso se niega.
    const gpsStartedAt = Date.now();
    let gpsEnabled = false;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      logDebug(`[pre-start] permiso GPS resuelto (${Date.now() - gpsStartedAt}ms) granted=${permission.granted}`);
      gpsEnabled = Boolean(permission.granted);
    } catch (error) {
      logDebug(`[pre-start] GPS ERROR (${Date.now() - gpsStartedAt}ms): ${error.message}`);
      gpsEnabled = false;
    }
    setGpsEnabled(gpsEnabled);
    router.push(pendingSession.isPresencial ? '/training-session-live' : '/training-session-active');
  };

  const handleOpenReview = () => {
    setReviewSlot({
      sessionInstance: pendingSession.sessionInstance,
      sessionInstanceId: pendingSession.sessionInstance?.id,
      date: pendingSession.date,
      sessionName: pendingSession.sessionInstance?.name,
      role: 'runner',
      athleteUserId: userId,
      mode,
      completionStatus: interrupted ? 'interrupted' : finished ? 'finished' : null,
      teamId: pendingSession.teamId ?? null,
      teamName: pendingSession.teamName ?? null,
      groupName: pendingSession.groupName ?? null,
    });
    router.push('/training-session-review');
  };

  const reviewButtonId = 'session-pre-start-screen-review-button';

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="session-pre-start-screen-root" testID="session-pre-start-screen-root">
      <ScrollView contentContainerClassName="px-4 py-6" nativeID="session-pre-start-screen-scroll" testID="session-pre-start-screen-scroll">
        <View className="flex-row items-center justify-between" nativeID="session-pre-start-screen-header-row" testID="session-pre-start-screen-header-row">
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
            nativeID="session-pre-start-screen-back-button"
            onPress={() => router.back()}
            testID="session-pre-start-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
          </Pressable>
          {pendingSession.isPresencial && (
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
              nativeID="session-pre-start-screen-attendance-button"
              onPress={() => router.push({ pathname: '/attendance/register', params: { returnTo: '/training-session' } })}
              testID="session-pre-start-screen-attendance-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="qrcode-scan" size={20} />
            </Pressable>
          )}
        </View>

        <View className="mb-6 mt-4 items-center" nativeID="session-pre-start-screen-title-block" testID="session-pre-start-screen-title-block">
          <Text className="text-base text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-date" testID="session-pre-start-screen-date">
            {formatWeekdayLabel(pendingSession.date)}, {formatDisplayDate(pendingSession.date)}
            {pendingSession.isPresencial && pendingSession.presencialTimeFrom ? ` · ${pendingSession.presencialTimeFrom}–${pendingSession.presencialTimeTo}` : ''}
          </Text>
          <Text className="mt-1 text-center text-3xl text-slate-900 dark:text-white" nativeID="session-pre-start-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="session-pre-start-screen-title">
            {pendingSession.sessionInstance?.name ?? 'Entrenamiento'}
          </Text>
          {(pendingSession.teamName || pendingSession.groupName) && (
            <View className="mt-2 flex-row items-center gap-4" nativeID="session-pre-start-screen-scope" testID="session-pre-start-screen-scope">
              {pendingSession.teamName && (
                <View className="flex-row items-center gap-1" nativeID="session-pre-start-screen-team" testID="session-pre-start-screen-team">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="session-pre-start-screen-team-label" testID="session-pre-start-screen-team-label">
                    {pendingSession.teamName}
                  </Text>
                </View>
              )}
              {pendingSession.groupName && (
                <View className="flex-row items-center gap-1" nativeID="session-pre-start-screen-group" testID="session-pre-start-screen-group">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={16} />
                  <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="session-pre-start-screen-group-label" testID="session-pre-start-screen-group-label">
                    {pendingSession.groupName}
                  </Text>
                </View>
              )}
            </View>
          )}
          {pendingSession.isPresencial && pendingSession.presencialLocation?.label && (
            <Pressable
              className="mt-2 max-w-full flex-row items-center gap-1 px-4"
              nativeID="session-pre-start-screen-presencial-location"
              onPress={() => openLocationInMaps(pendingSession.presencialLocation)}
              testID="session-pre-start-screen-presencial-location"
            >
              <MaterialCommunityIcons color={colors.primary} name="map-marker-outline" size={16} />
              <Text className="text-sm font-semibold text-primary underline" nativeID="session-pre-start-screen-presencial-location-label" numberOfLines={1} testID="session-pre-start-screen-presencial-location-label">
                {pendingSession.presencialLocation.label}
              </Text>
            </Pressable>
          )}
          {interrupted ? (
            <View className="mt-3 flex-row items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 dark:bg-red-900/20" nativeID="session-pre-start-screen-completed-badge" testID="session-pre-start-screen-completed-badge">
              <MaterialCommunityIcons color="#dc2626" name="alert-decagram" size={16} />
              <Text className="text-sm font-semibold text-red-700 dark:text-red-400" nativeID="session-pre-start-screen-completed-badge-label" testID="session-pre-start-screen-completed-badge-label">
                Sesión interrumpida
              </Text>
            </View>
          ) : finished ? (
            <View className="mt-3 flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 dark:bg-emerald-900/20" nativeID="session-pre-start-screen-completed-badge" testID="session-pre-start-screen-completed-badge">
              <MaterialCommunityIcons color="#16a34a" name="check-decagram" size={16} />
              <Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-400" nativeID="session-pre-start-screen-completed-badge-label" testID="session-pre-start-screen-completed-badge-label">
                Sesión completada
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mb-4" nativeID="session-pre-start-screen-exercise-container" testID="session-pre-start-screen-exercise-container">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-exercise-container-label" testID="session-pre-start-screen-exercise-container-label">
            Ejercicios de la sesión ({exercises.length})
          </Text>
          <View className="gap-2" nativeID="session-pre-start-screen-exercise-list" testID="session-pre-start-screen-exercise-list">
            {exercises.map((exercise) => (
              <ExerciseRow exercise={exercise} idPrefix="session-pre-start-screen" key={exercise.id} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Botonera fija fuera del ScrollView: la lista scrollea sin arrastrarlo. */}
      <View className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800" nativeID="session-pre-start-screen-footer" testID="session-pre-start-screen-footer">
        {showReview ? (
          <View className="items-center" nativeID="session-pre-start-screen-review-container" testID="session-pre-start-screen-review-container">
            <Pressable
              className="h-14 w-56 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80"
              nativeID={reviewButtonId}
              onPress={handleOpenReview}
              testID={reviewButtonId}
            >
              <MaterialCommunityIcons color={colors.onPrimary} name="clipboard-text-outline" size={20} />
              <Text className="text-sm font-bold uppercase tracking-wide text-[#111518]" nativeID={`${reviewButtonId}-label`} testID={`${reviewButtonId}-label`}>
                Registro de Sesión
              </Text>
            </Pressable>
            <Text className="mt-2 px-6 text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${reviewButtonId}-hint`} testID={`${reviewButtonId}-hint`}>
              {finished || interrupted ? 'Revisá y editá lo registrado en la sesión.' : 'Ingresá manualmente los datos de la sesión.'}
            </Text>
          </View>
        ) : (
          <Pressable
            className={`h-24 w-24 items-center justify-center self-center rounded-full bg-primary active:opacity-80 ${starting || runnerSessionLoading ? 'opacity-50' : ''}`}
            disabled={starting || runnerSessionLoading}
            nativeID="session-pre-start-screen-play-button"
            onPress={handlePlay}
            testID="session-pre-start-screen-play-button"
          >
            {runnerSessionLoading ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <MaterialCommunityIcons color={colors.onPrimary} name="play" size={44} />}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

export function SessionPreStartScreen() {
  return (
    <MobileOnlyRoute>
      <SessionPreStartScreenContent />
    </MobileOnlyRoute>
  );
}
