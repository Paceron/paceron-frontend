import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useCompetitionMutations } from '../../hooks/use-competitions.js';
import { useSessionInstance } from '../../hooks/use-session-instance.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useGpsTracker } from '../../hooks/use-gps-tracker.js';
import { requestSessionGpsPermission } from '../../utils/session-gps-permission.js';
import { haversineMeters, formatMeters } from '../../utils/distance.js';
import { totalRouteMeters } from '../../utils/route-geometry.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { notifyError } from '../../utils/haptics.js';
import { RouteMapPreview } from '../team/route-map-preview';
import { CompetitionRankingModal } from '../team/competition-ranking-modal.jsx';
import { logDebug } from '../../utils/debug-log.js';

// Pre-start dedicado de un intento de competencia por trayectoria (Spec
// 4c probó en dispositivo que el pre-start genérico, session-pre-start-
// screen.jsx, no sirve para esto -- ver docs/superpowers/specs/
// 2026-10-19-route-attempt-pre-start-design.md). session-pre-start-
// screen.jsx NO se toca -- entrenamientos normales y competencias
// type='metric' siguen por ese camino.
function RouteAttemptPreStartScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);
  const setGpsEnabled = useLiveSessionStore((s) => s.setGpsEnabled);
  const routeAttempt = pendingSession?.routeAttempt ?? null;
  const mutations = useCompetitionMutations(pendingSession?.teamId);
  const [starting, setStarting] = useState(false);

  // Bug real reportado 2026-10-31: el POST /competitions/{id}/attempts real
  // (a diferencia del mock) devuelve el estado del runner_session recién
  // creado (`id`/`session_instance_id`/`status`/...), NUNCA un objeto
  // `session_instance` embebido con nombre/ejercicios -- confirmado contra
  // `runnersession.RunnerSessionResponse` en el backend
  // (`cmd/api/domains/runnersession/runner_session.go`). `handlePlay` de
  // abajo asumía ese campo igual, así que `pendingSession.sessionInstance`
  // quedaba `undefined` en dispositivo real -- route-attempt-live-screen.jsx
  // nunca llegaba a loguear ni un solo paso de su bootstrap (su guard de
  // entrada corta ahí mismo), pantalla negra con loading infinito, sin
  // ningún error. Se pide acá, de entrada (mismo criterio que el permiso de
  // GPS de abajo), con el mismo hook que ya usa session-pre-start-screen.jsx
  // para el camino normal -- el intake ya NO necesita devolver nada más que
  // confirmar que se creó.
  const { sessionInstance, loading: sessionInstanceLoading } = useSessionInstance(routeAttempt?.sessionInstanceId, Boolean(routeAttempt?.sessionInstanceId));

  // Bug real reportado 2026-10-31: esta pantalla no se desmonta al navegar a
  // route-attempt-live (sigue en el stack) -- sin este reset, volver atrás
  // (gesto, botón, o el guard de salida de route-attempt-live-screen.jsx)
  // dejaba `starting` en `true` para siempre y el botón Play quedaba
  // atascado en loading pese a estar parado en el punto de inicio. Mismo
  // patrón ya usado en session-pre-start-screen.jsx para el mismo problema
  // (ahí con el mismo comentario), nunca replicado acá cuando esta pantalla
  // se separó de esa (Spec 4c).
  useFocusEffect(useCallback(() => { setStarting(false); }, []));

  const [rankingVisible, setRankingVisible] = useState(false);
  // CompetitionRankingModal pide SU PROPIO detalle (progress) por dentro,
  // gateado por `visible && Boolean(competition)` -- alcanza con pasarle
  // un objeto mínimo ya disponible sin fetch (mismo patrón que
  // competitions-tab.jsx#onOpenRanking, que le pasa la fila ya cargada de
  // la lista, no un detalle pedido aparte). Pedir el detalle ACÁ TAMBIÉN
  // antes de pasarlo sería un 2do fetch redundante y además mostraría un
  // "sin participantes" fantasma mientras ese 2do fetch todavía no
  // resuelve (el query interno del modal queda deshabilitado mientras
  // `competition` es null).
  const rankingCompetitionStub = routeAttempt ? { id: routeAttempt.competitionId, metric: null, name: null, route: routeAttempt.route, type: 'route' } : null;
  const { members } = useTeamRoster(pendingSession?.teamId);

  // Permiso de ubicación pedido apenas se entra -- a diferencia de la
  // pantalla genérica (que lo pide recién al tocar Play), acá el gate de
  // abajo necesita saber la posición ANTES de que el corredor pueda
  // tocar Play.
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const granted = await requestSessionGpsPermission('[route-attempt-pre-start]');
      if (!cancelled) setGpsPermissionGranted(granted);
    })();
    return () => { cancelled = true; };
  }, []);

  const tracker = useGpsTracker(gpsPermissionGranted === true);
  const [distanceToStart, setDistanceToStart] = useState(null);
  const startPoint = routeAttempt?.route?.coordinates?.[0] ?? null;

  useEffect(() => {
    if (gpsPermissionGranted !== true || !startPoint) return undefined;
    tracker.start({
      onPoint: (point) => {
        // `startPoint` es GeoJSON [lng, lat] -- haversineMeters pide
        // (lat1,lng1,lat2,lng2). Cada fix nuevo recalcula y re-renderiza:
        // es lo que hace que el botón se habilite solo, sin refresh
        // manual (pedido real del usuario, 2026-10-19).
        setDistanceToStart(haversineMeters(point.latitude, point.longitude, startPoint[1], startPoint[0]));
      },
    });
    return () => { tracker.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsPermissionGranted, startPoint]);

  // withinRange/canPlay/playState/playReady calculados ANTES del guard de
  // abajo (en vez de al lado de acceptanceRadiusMeters/gpsHint, puramente
  // de display) porque el pulso que sigue es un HOOK (useSharedValue +
  // useEffect) -- tiene que correr en TODOS los renders de este
  // componente, nunca después de un return condicional (regla de hooks).
  // `routeAttempt` puede ser null en el primer render (antes del guard),
  // de ahí el `?.` acá.
  const withinRange = distanceToStart != null && routeAttempt && distanceToStart <= routeAttempt.acceptanceRadiusMeters;
  const canPlay = gpsPermissionGranted === true && withinRange && Boolean(sessionInstance);
  const waitingForFix = gpsPermissionGranted === true && distanceToStart == null;
  // 3 estados visuales del botón Play -- pedido real 2026-10-19 ("un
  // estilo mas adecuado al play deshabilitado"): antes era un solo círculo
  // primary con opacity-50 sin importar el motivo. Ahora:
  // - loading: todavía no se sabe si se puede jugar (permiso sin
  //   resolver, esperando el primer fix de GPS, o mandando el intake) --
  //   spinner, fondo neutro.
  // - blocked: ya se sabe que NO se puede, con un motivo concreto (sin
  //   permiso vs. lejos) -- ícono que comunica el motivo, fondo neutro.
  // - ready: se puede jugar -- ícono de play, fondo primary, con el pulso
  //   de abajo invitando a tocar.
  const playState = gpsPermissionGranted == null || starting || waitingForFix || sessionInstanceLoading
    ? 'loading'
    : canPlay ? 'ready' : 'blocked';
  const playReady = playState === 'ready';

  // Mismo patrón que ConnectionBanner/ParticipantMarker en
  // trainer-session-live-screen.jsx -- withRepeat+withTiming en bucle
  // mientras `ready`, se asienta en 1 (withTiming corto, no instantáneo)
  // en cualquier otro estado. Solo transform:scale -- no toca layout ni
  // puede romper el hit-test del Pressable de adentro.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = playReady
      ? withRepeat(withTiming(1.06, { duration: 650 }), -1, true)
      : withTiming(1, { duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playReady]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Diagnóstico sin comportamiento (2026-10-31), mismo motivo que el de
  // competitions-tab.jsx -- este Play solo depende de permiso GPS +
  // cercanía al punto de inicio, nada de intentos/cupo, así que si vuelve
  // a reportarse "bloqueado" acá el log dice de entrada cuál de las dos
  // cosas es.
  useEffect(() => {
    logDebug(`route-attempt-pre-start playState=${playState} gpsPermissionGranted=${gpsPermissionGranted} distanceToStart=${distanceToStart} sessionInstanceLoading=${sessionInstanceLoading} sessionInstance=${sessionInstance ? sessionInstance.id : 'ninguna'}`);
  }, [playState, gpsPermissionGranted, distanceToStart, sessionInstanceLoading, sessionInstance]);

  if (!pendingSession || !routeAttempt) return <Redirect href="/" />;

  const acceptanceRadiusMeters = routeAttempt.acceptanceRadiusMeters;
  // Mismo cálculo que buildCompetitionTitle (utils/competition-title.js) --
  // no se importa esa función (arma un título completo con conteo de
  // puntos, no solo la distancia), se repite el remapeo GeoJSON->{lat,lng}
  // sobre totalRouteMeters directo.
  const totalMeters = totalRouteMeters((routeAttempt.route?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })));

  const gpsHint = gpsPermissionGranted === false
    ? 'Activá la ubicación para poder arrancar.'
    : distanceToStart == null
      ? 'Buscando tu ubicación…'
      : withinRange
        ? 'Estás en el punto de inicio.'
        : `Estás a ${formatMeters(distanceToStart)} del punto de inicio (necesitás estar a ${acceptanceRadiusMeters} m o menos).`;
  // Solo el caso "lejos del punto de inicio" se destaca con badge de aviso --
  // los otros 3 (sin permiso, buscando fix, ya en rango) son texto informativo
  // de paso, no una advertencia que requiera llamar la atención.
  const isFarFromStart = gpsPermissionGranted === true && distanceToStart != null && !withinRange;

  // El intake real (POST /competitions/{id}/attempts) se dispara ACÁ, no al
  // tocar "Correr esta trayectoria" en la lista (ver competitions-tab.jsx)
  // -- bug real reportado 2026-10-19: con el intake en la lista, solo
  // entrar a este pre-start y volver atrás sin jugar ya consumía el único
  // intento permitido (sin reintentos v1), y con el gate de GPS de arriba
  // el corredor puede tardar en llegar (o no llegar nunca) al punto de
  // inicio -- quedaba sin poder intentarlo de verdad jamás. Acá el intake
  // recién pasa cuando `canPlay` ya confirmó que está parado en el punto.
  const handlePlay = async () => {
    if (!canPlay || starting) return;
    setStarting(true);
    // String(userId) -- bug real reportado 2026-10-25: competitions-tab.jsx
    // y attempts-list-modal.jsx cachean/comparan athleteUserId como string
    // (roster normalizado, ver CLAUDE.md), pero `userId` acá viene de
    // auth-store.js sin coerción (número crudo del login). La invalidación
    // de ['competition-attempts', id, athleteUserId] en
    // use-competitions.js#useCompetitionMutations usa el MISMO valor que se
    // le pasa a esta mutación como parte de su query key -- con el tipo
    // distinto, TanStack Query trata number/string como cache keys
    // diferentes y nunca invalida la que de verdad está en pantalla: el
    // cupo restante/lista de intentos quedaba desactualizado y el corredor
    // podía volver a jugar la misma trayectoria.
    const result = await mutations.createCompetitionAttempt(routeAttempt.competitionId, String(userId));
    if (!result.success) {
      setStarting(false);
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos arrancar el intento', text2: result.error });
      return;
    }
    setPendingSession({ ...pendingSession, sessionInstance });
    setGpsEnabled(true);
    router.push('/route-attempt-live');
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="route-attempt-pre-start-screen-root" testID="route-attempt-pre-start-screen-root">
      <View className="flex-row items-center justify-between px-4 pt-2" nativeID="route-attempt-pre-start-screen-header-row" testID="route-attempt-pre-start-screen-header-row">
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
          nativeID="route-attempt-pre-start-screen-back-button"
          onPress={() => router.back()}
          testID="route-attempt-pre-start-screen-back-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
        </Pressable>
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:opacity-70 dark:bg-slate-800"
          nativeID="route-attempt-pre-start-screen-ranking-button"
          onPress={() => setRankingVisible(true)}
          testID="route-attempt-pre-start-screen-ranking-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="podium" size={20} />
        </Pressable>
      </View>

      <View className="items-center px-4 pb-2 pt-1" nativeID="route-attempt-pre-start-screen-title-block" testID="route-attempt-pre-start-screen-title-block">
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="route-attempt-pre-start-screen-date" testID="route-attempt-pre-start-screen-date">
          {formatWeekdayLabel(pendingSession.date)}, {formatDisplayDate(pendingSession.date)}
        </Text>
        <View className="mt-1.5 flex-row items-center gap-3" nativeID="route-attempt-pre-start-screen-meta-row" testID="route-attempt-pre-start-screen-meta-row">
          {pendingSession.teamName && (
            <View className="flex-row items-center gap-1" nativeID="route-attempt-pre-start-screen-team" testID="route-attempt-pre-start-screen-team">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={16} />
              <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="route-attempt-pre-start-screen-team-label" testID="route-attempt-pre-start-screen-team-label">
                {pendingSession.teamName}
              </Text>
            </View>
          )}
          <View className="flex-row items-center gap-1" nativeID="route-attempt-pre-start-screen-distance" testID="route-attempt-pre-start-screen-distance">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-distance" size={16} />
            <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="route-attempt-pre-start-screen-distance-label" testID="route-attempt-pre-start-screen-distance-label">
              {formatMeters(totalMeters)}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-1 px-4" nativeID="route-attempt-pre-start-screen-map-wrap" testID="route-attempt-pre-start-screen-map-wrap">
        <RouteMapPreview coordinates={routeAttempt.route?.coordinates ?? []} interactive nativeID="route-attempt-pre-start-screen-map" testID="route-attempt-pre-start-screen-map" />
      </View>

      <View className="border-t border-slate-100 bg-white items-center gap-2 px-4 pb-4 pt-3 dark:border-slate-800 dark:bg-surface" nativeID="route-attempt-pre-start-screen-footer" testID="route-attempt-pre-start-screen-footer">
        {isFarFromStart ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 dark:bg-amber-900/20" nativeID="route-attempt-pre-start-screen-gps-hint-badge" testID="route-attempt-pre-start-screen-gps-hint-badge">
            <MaterialCommunityIcons color="#d97706" name="alert-circle-outline" size={14} />
            <Text className="text-xs font-medium text-amber-700 dark:text-amber-400" nativeID="route-attempt-pre-start-screen-gps-hint" testID="route-attempt-pre-start-screen-gps-hint">
              {gpsHint}
            </Text>
          </View>
        ) : (
          <Text className="px-6 text-center text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-pre-start-screen-gps-hint" testID="route-attempt-pre-start-screen-gps-hint">
            {gpsHint}
          </Text>
        )}
        <Animated.View nativeID="route-attempt-pre-start-screen-play-button-pulse" style={pulseStyle} testID="route-attempt-pre-start-screen-play-button-pulse">
          <Pressable
            className={`h-24 w-24 items-center justify-center rounded-full ${playState === 'ready' ? 'bg-primary active:opacity-80' : 'bg-slate-200 dark:bg-slate-800'}`}
            disabled={playState !== 'ready'}
            nativeID="route-attempt-pre-start-screen-play-button"
            onPress={handlePlay}
            testID="route-attempt-pre-start-screen-play-button"
          >
            {playState === 'loading' ? (
              <ActivityIndicator color={colors.onSurfaceVariant} size="small" />
            ) : playState === 'ready' ? (
              <MaterialCommunityIcons color={colors.onPrimary} name="play" size={44} />
            ) : (
              // blocked -- el ícono distingue el motivo (sin permiso vs.
              // lejos del punto de inicio), no un play atenuado genérico.
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name={gpsPermissionGranted === false ? 'lock-outline' : 'map-marker-distance'} size={36} />
            )}
          </Pressable>
        </Animated.View>
      </View>

      <CompetitionRankingModal competition={rankingCompetitionStub} members={members} onClose={() => setRankingVisible(false)} visible={rankingVisible} />
    </SafeAreaView>
  );
}

export function RouteAttemptPreStartScreen() {
  return (
    <MobileOnlyRoute>
      <RequireAuth>
        <RouteAttemptPreStartScreenContent />
      </RequireAuth>
    </MobileOnlyRoute>
  );
}
