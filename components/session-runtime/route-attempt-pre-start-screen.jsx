import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { useLiveSessionStore } from '../../store/live-session-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { useGpsTracker } from '../../hooks/use-gps-tracker.js';
import { requestSessionGpsPermission } from '../../utils/session-gps-permission.js';
import { haversineMeters, formatMeters } from '../../utils/distance.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { RouteMapPreview } from '../team/route-map-preview.jsx';
import { CompetitionRankingModal } from '../team/competition-ranking-modal.jsx';

// Pre-start dedicado de un intento de competencia por trayectoria (Spec
// 4c probó en dispositivo que el pre-start genérico, session-pre-start-
// screen.jsx, no sirve para esto -- ver docs/superpowers/specs/
// 2026-10-19-route-attempt-pre-start-design.md). session-pre-start-
// screen.jsx NO se toca -- entrenamientos normales y competencias
// type='metric' siguen por ese camino.
function RouteAttemptPreStartScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const pendingSession = useSessionRuntimeStore((s) => s.pendingSession);
  const setGpsEnabled = useLiveSessionStore((s) => s.setGpsEnabled);
  const routeAttempt = pendingSession?.routeAttempt ?? null;

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

  if (!pendingSession || !routeAttempt) return <Redirect href="/" />;

  const acceptanceRadiusMeters = routeAttempt.acceptanceRadiusMeters;
  const withinRange = distanceToStart != null && distanceToStart <= acceptanceRadiusMeters;
  const canPlay = gpsPermissionGranted === true && withinRange;

  const gpsHint = gpsPermissionGranted === false
    ? 'Activá la ubicación para poder arrancar.'
    : distanceToStart == null
      ? 'Buscando tu ubicación…'
      : withinRange
        ? 'Estás en el punto de inicio.'
        : `Estás a ${formatMeters(distanceToStart)} del punto de inicio (necesitás estar a ${acceptanceRadiusMeters} m o menos).`;

  const handlePlay = () => {
    if (!canPlay) return;
    setGpsEnabled(true);
    router.push('/training-session-active');
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
        {pendingSession.teamName && (
          <View className="mt-1 flex-row items-center gap-1" nativeID="route-attempt-pre-start-screen-team" testID="route-attempt-pre-start-screen-team">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={16} />
            <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="route-attempt-pre-start-screen-team-label" testID="route-attempt-pre-start-screen-team-label">
              {pendingSession.teamName}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1 px-4" nativeID="route-attempt-pre-start-screen-map-wrap" testID="route-attempt-pre-start-screen-map-wrap">
        <RouteMapPreview coordinates={routeAttempt.route?.coordinates ?? []} interactive nativeID="route-attempt-pre-start-screen-map" testID="route-attempt-pre-start-screen-map" />
      </View>

      <View className="items-center gap-2 border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800" nativeID="route-attempt-pre-start-screen-footer" testID="route-attempt-pre-start-screen-footer">
        <Text className="px-6 text-center text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-pre-start-screen-gps-hint" testID="route-attempt-pre-start-screen-gps-hint">
          {gpsHint}
        </Text>
        <Pressable
          className={`h-24 w-24 items-center justify-center rounded-full bg-primary active:opacity-80 ${canPlay ? '' : 'opacity-50'}`}
          disabled={!canPlay}
          nativeID="route-attempt-pre-start-screen-play-button"
          onPress={handlePlay}
          testID="route-attempt-pre-start-screen-play-button"
        >
          {gpsPermissionGranted == null ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <MaterialCommunityIcons color={colors.onPrimary} name="play" size={44} />}
        </Pressable>
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
