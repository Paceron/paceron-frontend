import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useAttemptDetail } from '../../hooks/use-attempt-detail.js';
import { useTeam } from '../../hooks/use-teams.js';
import { formatMeters } from '../../utils/distance.js';
import { formatStopwatch } from '../../utils/time.js';
import { isWeb } from '../../utils/platform.js';
import { LiveTrajectoryMap } from './live-trajectory-map';

const pad2 = (n) => String(n).padStart(2, '0');

// Timestamp completo DD/MM/AAAA HH:mm -- mismo patrón sin exportar que
// `formatDayTime` en session-review-screen.jsx, no hay un formatter
// exportado para esto (solo para fecha sola YYYY-MM-DD).
function formatAttemptDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// Pantalla de detalle de un intento de competencia de ruta -- genérica
// (busca por competitionId+athleteUserId, no asume "el único intento" ni
// "el que recién terminó"), multiplataforma, reusable fuera del flujo
// post-intento (ver ranking de la competencia, cualquier participante es
// visible con el mismo criterio que el ranking ya usa). Reemplaza a
// route-attempt-result-screen.jsx. Sin SafeAreaView/shell propio -- vive
// bajo app/(tabs)/, que ya envuelve con AppWebShell/AppMobileShell.
function RouteAttemptDetailScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const detail = useAttemptDetail({
    competitionId: params.competitionId,
    athleteUserId: params.athleteUserId,
    setId: params.setId,
    distanceMeters: params.distanceMeters,
    durationMs: params.durationMs,
  });
  const { team } = useTeam(detail.teamId);

  const justFinished = Boolean(params.setId);
  const attemptDate = formatAttemptDate(detail.startedAt);

  return (
    <ScrollView className={`flex-1 w-full self-center bg-paper dark:bg-ink ${isWeb ? 'max-w-3xl' : ''}`} contentContainerClassName="p-4" nativeID="route-attempt-detail-screen-scroll" testID="route-attempt-detail-screen-scroll">
      {justFinished ? (
        <View className="mb-3 flex-row items-center gap-2 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40" nativeID="route-attempt-detail-screen-banner" testID="route-attempt-detail-screen-banner">
          <MaterialCommunityIcons color={colors.primary} name="flag-checkered" size={20} />
          <Text className="flex-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300" nativeID="route-attempt-detail-screen-banner-text" testID="route-attempt-detail-screen-banner-text">
            ¡Completaste tu intento!
          </Text>
        </View>
      ) : (
        <Text className="mb-3 text-center text-2xl font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-title" testID="route-attempt-detail-screen-title">
          Detalle de intento
        </Text>
      )}

      {detail.status === 'pending' && (
        <View className="items-center gap-2 py-8" nativeID="route-attempt-detail-screen-pending" testID="route-attempt-detail-screen-pending">
          <ActivityIndicator color={colors.primary} />
          <Text className="text-center text-sm text-amber-600 dark:text-amber-400" nativeID="route-attempt-detail-screen-pending-label" testID="route-attempt-detail-screen-pending-label">
            Este intento todavía no terminó o no se sincronizó.
          </Text>
        </View>
      )}

      {detail.status === 'not_found' && (
        <View className="items-center py-8" nativeID="route-attempt-detail-screen-not-found" testID="route-attempt-detail-screen-not-found">
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-not-found-label" testID="route-attempt-detail-screen-not-found-label">
            Este participante no tiene un intento registrado en esta competencia.
          </Text>
        </View>
      )}

      {(detail.status === 'local' || detail.status === 'synced') && (
        <>
          <View className="h-96 w-full" nativeID="route-attempt-detail-screen-map-wrap" testID="route-attempt-detail-screen-map-wrap">
            <LiveTrajectoryMap referenceRoute={detail.referenceRoute} traveledPoints={detail.traveledPoints} />
          </View>

          <View className="mt-4 flex-row flex-wrap justify-around gap-3" nativeID="route-attempt-detail-screen-stats" testID="route-attempt-detail-screen-stats">
            <View nativeID="route-attempt-detail-screen-distance" testID="route-attempt-detail-screen-distance">
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-distance-label" testID="route-attempt-detail-screen-distance-label">Distancia</Text>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-distance-value" testID="route-attempt-detail-screen-distance-value">{formatMeters(detail.distanceMeters ?? 0)}</Text>
            </View>
            <View nativeID="route-attempt-detail-screen-duration" testID="route-attempt-detail-screen-duration">
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-duration-label" testID="route-attempt-detail-screen-duration-label">Tiempo</Text>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-duration-value" testID="route-attempt-detail-screen-duration-value">{formatStopwatch(detail.durationMs ?? 0)}</Text>
            </View>
            {detail.expectedMeters != null && (
              <View nativeID="route-attempt-detail-screen-expected" testID="route-attempt-detail-screen-expected">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-expected-label" testID="route-attempt-detail-screen-expected-label">Distancia esperada</Text>
                <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-expected-value" testID="route-attempt-detail-screen-expected-value">{formatMeters(detail.expectedMeters)}</Text>
              </View>
            )}
            {attemptDate && (
              <View nativeID="route-attempt-detail-screen-date" testID="route-attempt-detail-screen-date">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-date-label" testID="route-attempt-detail-screen-date-label">Fecha</Text>
                <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-date-value" testID="route-attempt-detail-screen-date-value">{attemptDate}</Text>
              </View>
            )}
            {team?.name && (
              <View nativeID="route-attempt-detail-screen-team" testID="route-attempt-detail-screen-team">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-team-label" testID="route-attempt-detail-screen-team-label">Equipo</Text>
                <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-team-value" testID="route-attempt-detail-screen-team-value">{team.name}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {justFinished && (
        <Pressable className="mt-6 h-12 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80" nativeID="route-attempt-detail-screen-close-button" onPress={() => router.replace('/')} testID="route-attempt-detail-screen-close-button">
          <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-attempt-detail-screen-close-label" testID="route-attempt-detail-screen-close-label">Listo</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

export function RouteAttemptDetailScreen() {
  return (
    <RequireAuth>
      <RouteAttemptDetailScreenContent />
    </RequireAuth>
  );
}
