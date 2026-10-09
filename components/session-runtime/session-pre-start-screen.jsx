import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { notifySuccess } from '../../utils/haptics.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useRunnerSession } from '../../hooks/use-runner-session.js';
import { useSessionInstance } from '../../hooks/use-session-instance.js';
import { createRunnerSession } from '../../services/runnerSession.js';
import { pendingSessionFromNavParams } from '../../utils/pending-session-nav.js';
import { buildReviewSlotNavParams } from '../../utils/review-slot-nav.js';
import { cancelRun, getLatestRun, initSessionDb, interruptStartedSets, RUN_STATUS } from '../../services/session-db.js';
import { syncRun } from '../../services/session-sync.js';
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
  const navParams = useLocalSearchParams();
  const storePendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const setReviewSlot = useSessionReviewStore((s) => s.setReviewSlot);
  const setGpsEnabled = useLiveSessionStore((s) => s.setGpsEnabled);
  const userId = useAuthStore((s) => s.userId);
  const [starting, setStarting] = useState(false);
  // 'completed' | 'cancelled' | null -- cubre el mismo hueco corto que antes
  // (local vs. confirmación remota) para los DOS cierres terminales (Gap 19:
  // cancelar ya no deja el runner_session en wip para siempre, así que
  // también necesita su propia ventana de "ya sé localmente que terminó").
  const [locallyTerminalStatus, setLocallyTerminalStatus] = useState(null);
  // Si el cierre terminal local (completed O cancelled -- las dos
  // terminaciones posibles, ver Gap 19 arriba) YA llegó a confirmar su
  // PATCH en el backend alguna vez (`session_runs.runner_session_finished`,
  // puesto por syncRun#markRunnerSessionFinished SOLO después de ese PATCH
  // exitoso, para CUALQUIERA de los dos cierres -- `synced` es de cada SET
  // individual, no del cierre del run; no sirve acá) -- se usa más abajo
  // para reconciliar contra el servidor, ver `finished`/`interrupted`.
  const [locallyTerminalWasSynced, setLocallyTerminalWasSynced] = useState(false);
  // Un run local YA en curso (volvió a entrar tras cerrar la app a mitad de
  // sesión) exime de la sala de espera de abajo -- es resumir lo que ya
  // arrancó, no un ingreso nuevo que el entrenador todavía no abrió.
  const [hasLocalInProgressRun, setHasLocalInProgressRun] = useState(false);

  // El store (Zustand, sin persist) es el camino rápido -- siempre
  // preferido, cero requests extra. Un F5 en web lo vacía (bug real,
  // 2026-10-05): ahí se reconstruye desde los params de la URL (puestos por
  // start-session-button.jsx) + un fetch de la instancia por id -- misma
  // sesión, sin mandar a home.
  const needsFallback = !storePendingSession;
  const fallbackSessionInstanceId = needsFallback ? navParams.sessionInstanceId : null;
  const { sessionInstance: fetchedSessionInstance } = useSessionInstance(fallbackSessionInstanceId, Boolean(fallbackSessionInstanceId));
  const pendingSession = storePendingSession ?? pendingSessionFromNavParams(navParams, fetchedSessionInstance);

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
      // En web no hay (ni va a haber) run local SQLite -- expo-sqlite no
      // corre ahí (sin headers COOP/COEP, ver CLAUDE.md), así que este chequeo
      // ni se intenta: el estado terminal en web sale solo de runnerSession
      // (REST), más abajo.
      if (isWeb) return undefined;
      let cancelled = false;
      (async () => {
        try {
          await initSessionDb();
          const latest = await getLatestRun(sessionInstanceId, pendingSession?.date, userId);
          if (!cancelled) {
            setLocallyTerminalStatus(
              latest?.status === RUN_STATUS.COMPLETED ? 'completed' : latest?.status === RUN_STATUS.CANCELLED ? 'cancelled' : null,
            );
            setHasLocalInProgressRun(latest?.status === RUN_STATUS.IN_PROGRESS);
            setLocallyTerminalWasSynced(
              (latest?.status === RUN_STATUS.COMPLETED || latest?.status === RUN_STATUS.CANCELLED) && latest.runner_session_finished === 1,
            );
          }
        } catch {
          if (!cancelled) {
            setLocallyTerminalStatus(null);
            setHasLocalInProgressRun(false);
            setLocallyTerminalWasSynced(false);
          }
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
  // El local "completed"/"cancelled" (SQLite, session_runs) vive en el
  // dispositivo -- sobrevive un reload de JS, cerrar la app, e incluso un
  // reset del backend (make demo-restore en dev), que solo toca la base
  // del servidor. Si ese cierre YA se había confirmado contra el backend
  // alguna vez (locallyTerminalWasSynced) y el servidor ahora confirma que
  // no existe NINGÚN runner_session para esta sesión (query resuelta, no
  // `wip`, no `finished`, directamente null -- un 404 real, no "todavía
  // cargando"), la única explicación es que algo externo al dispositivo
  // borró ese registro -- el servidor manda por sobre un local que ya
  // demostró poder sincronizar antes. Si el local NUNCA llegó a
  // sincronizarse (`!locallyTerminalWasSynced`, ej. se cerró sin conexión y
  // todavía no hizo el PATCH), NO se reconcilia -- ahí el servidor en null
  // es simplemente "todavía no llegó", y hay que seguir confiando en lo
  // local hasta que el sync lo resuelva (si no, un corredor sin señal
  // podría terminar re-arrancando una sesión que de verdad ya hizo/cortó).
  // Bug real reportado, 2026-10-08: después de un demo-restore el corredor
  // seguía viendo "Registro de Sesión" con todas las series en "sin
  // registro" para una sesión que el backend había vuelto a abrir -- el
  // gate de abajo nunca consultaba el servidor para nada que no fuera el
  // estado base, confiaba ciego en locallyTerminalStatus. Aplica a los DOS
  // cierres (completed Y cancelled) -- un cierre forzado por el entrenador
  // ANTES de que este corredor llegara a terminar su última serie
  // (training-session-live-screen.jsx, control:session_finished -- ver ese
  // archivo) pasa por cancelSession(), no finalizeSession(), dejando el run
  // local en CANCELLED -- la primera versión de este fix solo cubría
  // COMPLETED y no alcanzaba para ese caso real (reportado 2026-10-09,
  // seguía fallando tras el primer intento).
  const serverConfirmsNoRunnerSession = !runnerSessionLoading && runnerSession === null;
  const externallyResetLocally = locallyTerminalWasSynced && serverConfirmsNoRunnerSession
    && (locallyTerminalStatus === 'completed' || locallyTerminalStatus === 'cancelled');
  const finished = runnerSession?.status === 'finished' || (locallyTerminalStatus === 'completed' && !externallyResetLocally);
  // Gap 19: cancelar a mitad de camino es una terminación temprana, no
  // "deshacer" -- entra a Registro de Sesión igual que `finished` (lo ya
  // hecho queda ahí para revisar/editar), nunca vuelve a Play.
  const interrupted = runnerSession?.status === 'interrupted' || (locallyTerminalStatus === 'cancelled' && !externallyResetLocally);
  const mode = finished || interrupted ? 'review' : 'manual';
  const showReview = past || finished || interrupted;

  // Gap 26: la sesión presencial la abre/cierra el entrenador (su Play/
  // slide-to-finish) -- un corredor que todavía no arrancó nada no puede
  // ingresar hasta que eso pase. Alguien que YA tiene un run local en curso
  // (wip remoto o in_progress local) queda exento -- es resumir, no un
  // ingreso nuevo. Polling (sin WS acá) a GET /session-instances/:id, mismo
  // criterio que AttendanceSessionModal.
  const alreadyStarted = runnerSession?.status === 'wip' || hasLocalInProgressRun || finished || interrupted;
  // El polling sigue activo mientras el corredor tenga un run en curso --
  // no solo antes de arrancar -- para el caso de abajo (cierre forzado del
  // entrenador mientras este corredor estaba con la app cerrada). Se corta
  // una vez que el corredor ya tiene su propio cierre terminal (finished o
  // interrupted), ahí no hay nada más que vigilar.
  // En web el footer nunca muestra sala de espera/cerrada (siempre el aviso
  // de "solo app nativa" en su lugar) -- apagar el polling ahí evita pedidos
  // que no se van a reflejar en ningún lado.
  const instanceGateEnabled = !isWeb && Boolean(sessionInstanceId) && Boolean(pendingSession?.isPresencial) && !finished && !interrupted;
  const { sessionInstance: liveInstance } = useSessionInstance(sessionInstanceId, instanceGateEnabled, { refetchInterval: instanceGateEnabled ? 5000 : false, staleTime: 0 });
  const gateLoading = instanceGateEnabled && !alreadyStarted && liveInstance == null;
  const waitingForTrainer = instanceGateEnabled && !alreadyStarted && liveInstance != null && liveInstance.openedAt == null;
  // Nunca llegó a arrancar nada y el entrenador ya cerró -- caso límite, sin
  // alternativa de carga manual por ahora.
  const closedByTrainer = instanceGateEnabled && !alreadyStarted && liveInstance != null && liveInstance.closedAt != null;

  // El entrenador puede cerrar la sesión mientras este corredor estaba lejos
  // de la app (sin WS conectado para recibir el control:session_finished en
  // vivo) -- al volver a entrar acá con un run local todavía in_progress, se
  // fuerza la MISMA terminación temprana que un cancelar manual
  // (interruptStartedSets + cancelRun + sync), para que no quede colgado
  // esperando un Play que ya no corresponde ni vuelva a aparecer como si
  // pudiera reanudar. El pre-start pasa solo a mostrar "Registro de Sesión"
  // (vía `interrupted` más abajo), sin navegar a ningún lado por su cuenta.
  const [forcingClose, setForcingClose] = useState(false);
  useEffect(() => {
    if (!hasLocalInProgressRun || liveInstance?.closedAt == null || forcingClose) return;
    setForcingClose(true);
    (async () => {
      try {
        const latest = await getLatestRun(sessionInstanceId, pendingSession?.date, userId);
        if (latest?.status === RUN_STATUS.IN_PROGRESS) {
          await interruptStartedSets(latest.id);
          await cancelRun(latest.id);
          await syncRun(latest.id);
        }
      } catch {
        // Se reintenta solo (mismo polling, mismo chequeo) en el próximo tick
        // o el próximo focus -- nada que mostrarle al usuario acá.
      } finally {
        setLocallyTerminalStatus('cancelled');
        setHasLocalInProgressRun(false);
        setForcingClose(false);
      }
    })();
  }, [hasLocalInProgressRun, liveInstance?.closedAt, forcingClose, sessionInstanceId, pendingSession?.date, userId]);

  // Aviso de que se destrabó la sala de espera -- el polling de arriba ya
  // hace que el botón cambie solo (sin recargar ni volver a entrar), pero sin
  // esto no había ninguna señal de que el cambio pasó justo ahora.
  // `waitingForTrainer` pasar de true a false NO siempre significa "el
  // entrenador abrió la sesión" -- también pasa a false si `alreadyStarted`
  // se vuelve true (ej. runnerSession resuelve DESPUÉS que liveInstance,
  // en la misma carga inicial, confirmando que esta sesión ya se hizo) o si
  // `instanceGateEnabled` se apaga por otro motivo. Con el chequeo de antes
  // (comparar solo el booleano derivado) ese mismo caso disparaba la toast
  // igual, con un mensaje que no correspondía -- bug real reportado,
  // 2026-10-08, "cada vez que entro salta la toast". `nowOpen` repite la
  // MISMA condición puntual (`liveInstance.openedAt != null`) que de verdad
  // significa "se abrió", sin el atajo de "lo que sea que haga false a
  // waitingForTrainer cuenta".
  const wasWaitingRef = useRef(false);
  useEffect(() => {
    const nowOpen = instanceGateEnabled && !alreadyStarted && liveInstance != null && liveInstance.openedAt != null;
    if (wasWaitingRef.current && nowOpen) {
      notifySuccess();
      Toast.show({ type: 'success', text1: 'El entrenador abrió la sesión', text2: 'Ya podés iniciar.' });
    }
    wasWaitingRef.current = waitingForTrainer;
  }, [waitingForTrainer, instanceGateEnabled, alreadyStarted, liveInstance]);

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
    const slot = {
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
    };
    setReviewSlot(slot);
    router.push({ pathname: '/training-session-review', params: buildReviewSlotNavParams(slot) });
  };

  const reviewButtonId = 'session-pre-start-screen-review-button';

  const handleOpenAttendance = () => {
    router.push({ pathname: '/attendance/register', params: { returnTo: '/training-session' } });
  };

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="session-pre-start-screen-root" testID="session-pre-start-screen-root">
      <View className={`flex-1 w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="session-pre-start-screen-width-container" testID="session-pre-start-screen-width-container">
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
          {/* Solo nativo -- en web no hay cámara, así que de nada le sirve al
              corredor este acceso (terminaba siempre en un aviso de "función
              de la app"). Simplifica el control: en web directamente no
              está. El entrenador SÍ mantiene su acceso a asistencia en web
              (trainer-session-pre-start-screen.jsx), es otro caso: ahí es un
              modal de gestión completo, no un scanner de cámara. */}
          {pendingSession.isPresencial && !isWeb && (
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
              nativeID="session-pre-start-screen-attendance-button"
              onPress={handleOpenAttendance}
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
        ) : closedByTrainer ? (
          <View className="items-center" nativeID="session-pre-start-screen-closed-container" testID="session-pre-start-screen-closed-container">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700" nativeID="session-pre-start-screen-closed-icon" testID="session-pre-start-screen-closed-icon">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="lock-clock" size={36} />
            </View>
            <Text className="mt-2 px-6 text-center text-xs text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-closed-hint" testID="session-pre-start-screen-closed-hint">
              El entrenador ya cerró esta sesión.
            </Text>
          </View>
        ) : waitingForTrainer || gateLoading ? (
          <View className="items-center" nativeID="session-pre-start-screen-waiting-container" testID="session-pre-start-screen-waiting-container">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700" nativeID="session-pre-start-screen-waiting-icon" testID="session-pre-start-screen-waiting-icon">
              {gateLoading ? <ActivityIndicator color={colors.onSurfaceVariant} size="small" /> : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="timer-sand" size={36} />}
            </View>
            <Text className="mt-2 px-6 text-center text-xs text-slate-500 dark:text-slate-400" nativeID="session-pre-start-screen-waiting-hint" testID="session-pre-start-screen-waiting-hint">
              {gateLoading ? 'Verificando si la sesión ya está abierta…' : 'Sala de espera — esperando que el entrenador inicie la sesión.'}
            </Text>
          </View>
        ) : isWeb ? (
          <View className="flex-row items-center gap-1.5 self-center rounded-full bg-emerald-50 px-3 py-1.5 dark:bg-emerald-900/20" nativeID="session-pre-start-screen-web-notice" testID="session-pre-start-screen-web-notice">
            <MaterialCommunityIcons color="#16a34a" name="cellphone-check" size={14} />
            <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-400" nativeID="session-pre-start-screen-web-notice-label" testID="session-pre-start-screen-web-notice-label">
              El inicio y registro del entrenamiento solo está disponible en la app nativa
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
      </View>
    </View>
  );
}

export function SessionPreStartScreen() {
  return (
    <RequireAuth>
      <SessionPreStartScreenContent />
    </RequireAuth>
  );
}
