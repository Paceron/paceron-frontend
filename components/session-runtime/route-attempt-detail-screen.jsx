import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
// Tolerancia del 5% -- ruido típico de medición GPS, no exige llegar al
// metro exacto de la ruta marcada para contar como "cumplido".
const EXPECTED_TOLERANCE = 0.95;

// Timestamp completo DD/MM/AAAA HH:mm -- mismo patrón sin exportar que
// `formatDayTime` en session-review-screen.jsx, no hay un formatter
// exportado para esto (solo para fecha sola YYYY-MM-DD).
function formatAttemptDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function StatBox({ idPrefix, label, value }) {
  return (
    <View className="flex-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>{label}</Text>
      <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-value`} numberOfLines={1} testID={`${idPrefix}-value`}>{value}</Text>
    </View>
  );
}

// Box de comparación logrado-vs-esperado, fila entera, dos caras -- pedido
// real 2026-10-21. `met` null = todavía no hay distancia esperada para
// comparar (tono neutro); true/false colorea verde/ámbar.
function ComparisonBox({ achievedLabel, achievedValue, expectedLabel, expectedValue, met }) {
  const tone = met == null
    ? { bg: 'bg-slate-100 dark:bg-slate-800/40', border: 'border-slate-200 dark:border-slate-700', icon: null }
    : met
      ? { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-800/70', icon: 'check-circle' }
      : { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-800/70', icon: 'alert-circle-outline' };
  return (
    <View className={`flex-row overflow-hidden rounded-xl border ${tone.bg} ${tone.border}`} nativeID="route-attempt-detail-screen-comparison" testID="route-attempt-detail-screen-comparison">
      <View className="flex-1 items-center gap-0.5 p-3" nativeID="route-attempt-detail-screen-comparison-achieved" testID="route-attempt-detail-screen-comparison-achieved">
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-comparison-achieved-label" testID="route-attempt-detail-screen-comparison-achieved-label">{achievedLabel}</Text>
        <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-comparison-achieved-value" testID="route-attempt-detail-screen-comparison-achieved-value">{achievedValue}</Text>
      </View>
      <View className="w-px bg-slate-200 dark:bg-slate-700" nativeID="route-attempt-detail-screen-comparison-divider" testID="route-attempt-detail-screen-comparison-divider" />
      <View className="flex-1 items-center gap-0.5 p-3" nativeID="route-attempt-detail-screen-comparison-expected" testID="route-attempt-detail-screen-comparison-expected">
        <View className="flex-row items-center gap-1" nativeID="route-attempt-detail-screen-comparison-expected-row" testID="route-attempt-detail-screen-comparison-expected-row">
          {tone.icon && <MaterialCommunityIcons color={met ? '#047857' : '#b45309'} name={tone.icon} size={14} />}
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-comparison-expected-label" testID="route-attempt-detail-screen-comparison-expected-label">{expectedLabel}</Text>
        </View>
        <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-comparison-expected-value" testID="route-attempt-detail-screen-comparison-expected-value">{expectedValue}</Text>
      </View>
    </View>
  );
}

// Pantalla de detalle de un intento de competencia de ruta -- genérica
// (busca por competitionId+athleteUserId, no asume "el único intento" ni
// "el que recién terminó"), multiplataforma, reusable fuera del flujo
// post-intento (ver ranking de la competencia, cualquier participante es
// visible con el mismo criterio que el ranking ya usa). Reemplaza a
// route-attempt-result-screen.jsx. Sin SafeAreaView/shell propio -- vive
// bajo app/(tabs)/, que ya envuelve con AppWebShell/AppMobileShell.
//
// Layout sin scroll -- pedido real 2026-10-21: columna con el mapa en
// `flex-1` (toma el alto que las stats, de alto fijo/natural, no usan) en
// vez de un ScrollView que dejaba medio mapa vacío y un espacio enorme
// debajo. Mismo esquema en mobile y web.
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
  const met = detail.expectedMeters != null && detail.distanceMeters != null
    ? detail.distanceMeters >= detail.expectedMeters * EXPECTED_TOLERANCE
    : null;

  // Mismo destino en los dos casos (recién terminado o abierto desde el
  // ranking) -- pedido real 2026-10-21: "Listo"/volver mandaba a home en
  // vez de a la vista de competencias de donde salió. `/teams/{id}` ya
  // soporta `?tab=competencias` como deep-link (team-detail-screen.jsx).
  const goToCompetitions = () => {
    if (detail.teamId) {
      router.replace({ pathname: `/teams/${detail.teamId}`, params: { tab: 'competencias' } });
    } else {
      router.back();
    }
  };

  return (
    <View className={`flex-1 w-full self-center bg-paper p-4 dark:bg-ink ${isWeb ? 'max-w-3xl' : ''}`} nativeID="route-attempt-detail-screen-root" testID="route-attempt-detail-screen-root">
      {justFinished ? (
        <View className="mb-3 flex-row items-center gap-2 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40" nativeID="route-attempt-detail-screen-banner" testID="route-attempt-detail-screen-banner">
          <MaterialCommunityIcons color={colors.primary} name="flag-checkered" size={20} />
          <Text className="flex-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300" nativeID="route-attempt-detail-screen-banner-text" testID="route-attempt-detail-screen-banner-text">
            ¡Completaste tu intento!
          </Text>
        </View>
      ) : (
        <View className="mb-3 flex-row items-center gap-2" nativeID="route-attempt-detail-screen-header" testID="route-attempt-detail-screen-header">
          <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID="route-attempt-detail-screen-back-button" onPress={goToCompetitions} testID="route-attempt-detail-screen-back-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
          </Pressable>
          <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="route-attempt-detail-screen-title">
            Detalle de intento
          </Text>
        </View>
      )}

      {detail.status === 'pending' && (
        <View className="flex-1 items-center justify-center gap-2" nativeID="route-attempt-detail-screen-pending" testID="route-attempt-detail-screen-pending">
          <ActivityIndicator color={colors.primary} />
          <Text className="text-center text-sm text-amber-600 dark:text-amber-400" nativeID="route-attempt-detail-screen-pending-label" testID="route-attempt-detail-screen-pending-label">
            Este intento todavía no terminó o no se sincronizó.
          </Text>
        </View>
      )}

      {detail.status === 'not_found' && (
        <View className="flex-1 items-center justify-center" nativeID="route-attempt-detail-screen-not-found" testID="route-attempt-detail-screen-not-found">
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-not-found-label" testID="route-attempt-detail-screen-not-found-label">
            Este participante no tiene un intento registrado en esta competencia.
          </Text>
        </View>
      )}

      {(detail.status === 'local' || detail.status === 'synced') && (
        <View className="flex-1 gap-3" nativeID="route-attempt-detail-screen-content" testID="route-attempt-detail-screen-content">
          <View className="flex-1 w-full" nativeID="route-attempt-detail-screen-map-wrap" testID="route-attempt-detail-screen-map-wrap">
            <LiveTrajectoryMap referenceRoute={detail.referenceRoute} traveledPoints={detail.traveledPoints} />
          </View>

          <View className="gap-2" nativeID="route-attempt-detail-screen-stats" testID="route-attempt-detail-screen-stats">
            <ComparisonBox
              achievedLabel="Lograste"
              achievedValue={formatMeters(detail.distanceMeters ?? 0)}
              expectedLabel="Esperado"
              expectedValue={detail.expectedMeters != null ? formatMeters(detail.expectedMeters) : '—'}
              met={met}
            />
            <View className="flex-row gap-2" nativeID="route-attempt-detail-screen-stats-row" testID="route-attempt-detail-screen-stats-row">
              <StatBox idPrefix="route-attempt-detail-screen-duration" label="Tiempo" value={formatStopwatch(detail.durationMs ?? 0)} />
              <StatBox idPrefix="route-attempt-detail-screen-date" label="Fecha" value={attemptDate ?? '—'} />
              <StatBox idPrefix="route-attempt-detail-screen-team" label="Equipo" value={team?.name ?? '—'} />
            </View>
          </View>
        </View>
      )}

      {justFinished && (
        <Pressable className="mt-3 h-12 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80" nativeID="route-attempt-detail-screen-close-button" onPress={goToCompetitions} testID="route-attempt-detail-screen-close-button">
          <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="route-attempt-detail-screen-close-label" testID="route-attempt-detail-screen-close-label">Listo</Text>
        </Pressable>
      )}
    </View>
  );
}

export function RouteAttemptDetailScreen() {
  return (
    <RequireAuth>
      <RouteAttemptDetailScreenContent />
    </RequireAuth>
  );
}
