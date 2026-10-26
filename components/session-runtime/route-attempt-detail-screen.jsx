import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useAttemptDetail } from '../../hooks/use-attempt-detail.js';
import { useTeam } from '../../hooks/use-teams.js';
import { useUser } from '../../hooks/use-user.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { formatMeters } from '../../utils/distance.js';
import { formatStopwatch } from '../../utils/time.js';
import { isWeb } from '../../utils/platform.js';
import { LiveTrajectoryMap } from './live-trajectory-map';
import { AvatarPicker } from '../shared/avatar-picker.jsx';

const pad2 = (n) => String(n).padStart(2, '0');
// % de cumplimiento (tiempo dentro del radio de aceptación) desde el que se
// considera "cumplido" -- pedido real 2026-10-21, reemplaza el criterio
// anterior (distancia lograda vs. esperada con tolerancia del 5%): más fiel
// a qué tan apegado estuvo el corredor a la ruta marcada, no solo si
// completó una distancia similar por cualquier camino.
const COMPLIANCE_MET_THRESHOLD = 90;

// Local, no el `formatPace` de leaderboard-metric-format.js -- pedido real
// 2026-10-21: "ritmo no tiene bien la unidad min/km" (ese formatter da
// "6:13 /km", sin el "min" que aclara qué es el número de la izquierda).
// No se toca el formatter compartido para no alterar el leaderboard, que
// nadie pidió cambiar.
function formatPaceMinPerKm(minutesPerKm) {
  if (minutesPerKm == null || !Number.isFinite(minutesPerKm)) return '—';
  const totalSeconds = Math.round(minutesPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} min/km`;
}

// Timestamp completo DD/MM/AAAA HH:mm -- mismo patrón sin exportar que
// `formatDayTime` en session-review-screen.jsx, no hay un formatter
// exportado para esto (solo para fecha sola YYYY-MM-DD).
function formatAttemptDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function StatBox({ idPrefix, icon, label, value }) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-label-row`} testID={`${idPrefix}-label-row`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={icon} size={14} />
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>{label}</Text>
      </View>
      <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-value`} numberOfLines={1} testID={`${idPrefix}-value`}>{value}</Text>
    </View>
  );
}

// Box de veredicto, fila entera, tres partes -- pedido real 2026-10-21
// (reemplaza la versión anterior de dos caras). Esperado | ícono+% de
// cumplimiento | logrado. `met` null = todavía no hay % que evaluar (tono
// neutro); true/false colorea verde/ámbar todo el box.
function VerdictBox({ expectedValue, achievedValue, complianceRatio, met }) {
  const tone = met == null
    ? { bg: 'bg-slate-100 dark:bg-slate-800/40', border: 'border-slate-200 dark:border-slate-700', icon: 'help-circle-outline', iconColor: '#64748b' }
    : met
      ? { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-800/70', icon: 'check-circle', iconColor: '#047857' }
      : { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-800/70', icon: 'alert-circle-outline', iconColor: '#b45309' };
  return (
    <View className={`flex-row overflow-hidden rounded-xl border ${tone.bg} ${tone.border}`} nativeID="route-attempt-detail-screen-verdict" testID="route-attempt-detail-screen-verdict">
      <View className="flex-1 items-center gap-0.5 p-3" nativeID="route-attempt-detail-screen-verdict-expected" testID="route-attempt-detail-screen-verdict-expected">
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-verdict-expected-label" testID="route-attempt-detail-screen-verdict-expected-label">Esperado</Text>
        <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-verdict-expected-value" testID="route-attempt-detail-screen-verdict-expected-value">{expectedValue}</Text>
      </View>
      <View className="w-px bg-slate-200 dark:bg-slate-700" nativeID="route-attempt-detail-screen-verdict-divider-1" testID="route-attempt-detail-screen-verdict-divider-1" />
      <View className="flex-1 items-center gap-0.5 p-3" nativeID="route-attempt-detail-screen-verdict-compliance" testID="route-attempt-detail-screen-verdict-compliance">
        <MaterialCommunityIcons color={tone.iconColor} name={tone.icon} size={22} />
        <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-verdict-compliance-value" testID="route-attempt-detail-screen-verdict-compliance-value">
          {complianceRatio != null ? `${Math.round(complianceRatio)}%` : '—'}
        </Text>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-verdict-compliance-label" testID="route-attempt-detail-screen-verdict-compliance-label">Cumplimiento</Text>
      </View>
      <View className="w-px bg-slate-200 dark:bg-slate-700" nativeID="route-attempt-detail-screen-verdict-divider-2" testID="route-attempt-detail-screen-verdict-divider-2" />
      <View className="flex-1 items-center gap-0.5 p-3" nativeID="route-attempt-detail-screen-verdict-achieved" testID="route-attempt-detail-screen-verdict-achieved">
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-verdict-achieved-label" testID="route-attempt-detail-screen-verdict-achieved-label">Registrada</Text>
        <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-verdict-achieved-value" testID="route-attempt-detail-screen-verdict-achieved-value">{achievedValue}</Text>
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
    startedAt: params.startedAt,
    // Gap 36 -- presente solo cuando se navega desde AttemptsListModal (un
    // intento puntual, no necesariamente el mejor); ausente desde el
    // ranking, que sigue resolviendo el mejor intento del atleta por su
    // cuenta (ver hooks/use-attempt-detail.js).
    sessionInstanceId: params.sessionInstanceId,
  });
  const { team } = useTeam(detail.teamId);
  const { user: athlete } = useUser(params.athleteUserId);
  const athleteName = athlete ? `${athlete.name ?? ''} ${athlete.surname ?? ''}`.trim() : null;

  const justFinished = Boolean(params.setId);
  const attemptDate = formatAttemptDate(detail.startedAt);
  const met = detail.complianceRatio != null ? detail.complianceRatio >= COMPLIANCE_MET_THRESHOLD : null;
  const paceMinPerKm = detail.durationMs > 0 && detail.distanceMeters > 0
    ? (detail.durationMs / 60_000) / (detail.distanceMeters / 1000)
    : null;

  // Dos caminos de entrada distintos, pedido real 2026-10-23: "volver"
  // tiene que preservar la posición/modal anterior cuando corresponde, no
  // siempre aterrizar en una vista de competencias en blanco.
  //
  // - Abierto desde el ranking/modal de intentos (NO justFinished): el
  //   team-detail YA está en el stack, un paso atrás (esta pantalla se
  //   llegó con `router.push`). `router.back()` vuelve a ESA instancia --
  //   mismo scroll, mismo estado de React -- en vez de `replace`, que
  //   descartaba esa instancia y montaba una nueva en blanco (bug real:
  //   perdía la posición y cualquier modal que hubiera estado abierto).
  // - Recién terminado (justFinished): se llegó acá vía pre-start → en
  //   vivo (con un `replace` intermedio, ver route-attempt-live-screen.jsx),
  //   así que `back()` aterrizaría en el pre-start, no en competencias. No
  //   hay "posición anterior" real que preservar en este camino (el
  //   usuario estaba corriendo, no navegando la lista) -- sigue yendo
  //   directo al tab, como antes.
  const goToCompetitions = () => {
    if (justFinished) {
      if (detail.teamId) {
        router.replace({ pathname: `/teams/${detail.teamId}`, params: { tab: 'competencias' } });
      } else {
        router.back();
      }
      return;
    }
    router.back();
  };

  return (
    <View className={`flex-1 w-full self-center bg-paper p-4 pb-6 dark:bg-ink ${isWeb ? 'max-w-3xl' : ''}`} nativeID="route-attempt-detail-screen-root" testID="route-attempt-detail-screen-root">
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
          {/* Sin Orbitron -- pedido real 2026-10-21, se veía mal en mobile.
              Ese font queda reservado para displays numéricos (cronómetro),
              no para títulos de texto -- mismo tratamiento que
              team-detail-screen.jsx/session-review-screen.jsx. */}
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="route-attempt-detail-screen-title">
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
          <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="route-attempt-detail-screen-athlete-row" testID="route-attempt-detail-screen-athlete-row">
            <AvatarPicker accessibilityLabel={athleteName ?? 'Corredor'} fallbackIcon="account" idPrefix="route-attempt-detail-screen-athlete-avatar" initials={getUserInitials(athlete)} size={40} uri={athlete?.photoUrl} />
            <View className="flex-1 gap-0.5" nativeID="route-attempt-detail-screen-athlete-info" testID="route-attempt-detail-screen-athlete-info">
              <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID="route-attempt-detail-screen-athlete-name" numberOfLines={1} testID="route-attempt-detail-screen-athlete-name">
                {athleteName || '—'}
              </Text>
              <View className="flex-row flex-wrap items-center gap-3" nativeID="route-attempt-detail-screen-athlete-meta" testID="route-attempt-detail-screen-athlete-meta">
                <View className="flex-row items-center gap-1" nativeID="route-attempt-detail-screen-athlete-date" testID="route-attempt-detail-screen-athlete-date">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-clock" size={14} />
                  <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-athlete-date-label" testID="route-attempt-detail-screen-athlete-date-label">
                    {attemptDate ?? '—'}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1" nativeID="route-attempt-detail-screen-athlete-team" testID="route-attempt-detail-screen-athlete-team">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={14} />
                  <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="route-attempt-detail-screen-athlete-team-label" numberOfLines={1} testID="route-attempt-detail-screen-athlete-team-label">
                    {team?.name ?? '—'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="flex-1 w-full" nativeID="route-attempt-detail-screen-map-wrap" testID="route-attempt-detail-screen-map-wrap">
            <LiveTrajectoryMap referenceRoute={detail.referenceRoute} traveledPoints={detail.traveledPoints} />
          </View>

          <View className="gap-2" nativeID="route-attempt-detail-screen-stats" testID="route-attempt-detail-screen-stats">
            <VerdictBox
              achievedValue={formatMeters(detail.distanceMeters ?? 0)}
              complianceRatio={detail.complianceRatio}
              expectedValue={detail.expectedMeters != null ? formatMeters(detail.expectedMeters) : '—'}
              met={met}
            />
            <View className="flex-row gap-2" nativeID="route-attempt-detail-screen-stats-row-2" testID="route-attempt-detail-screen-stats-row-2">
              <StatBox icon="clock-outline" idPrefix="route-attempt-detail-screen-duration" label="Tiempo" value={formatStopwatch(detail.durationMs ?? 0)} />
              <StatBox icon="speedometer" idPrefix="route-attempt-detail-screen-pace" label="Ritmo" value={formatPaceMinPerKm(paceMinPerKm)} />
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
