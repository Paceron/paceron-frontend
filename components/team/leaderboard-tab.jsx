import { useState } from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { LeaderboardPeriodModal } from './leaderboard-period-modal.jsx';
import { useTeamLeaderboard } from '../../hooks/use-team-leaderboard.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useThemeColors } from '../../theme/colors.js';
import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
import { rankMeta } from '../../utils/leaderboard-rank-meta.js';
import { toISODate } from '../../utils/date-field-format.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';

const PERIOD_OPTIONS = [
  { id: 'week', name: 'Última semana' },
  { id: 'month', name: 'Último mes' },
  { id: 'year', name: 'Último año' },
  { id: 'custom', name: 'Rango personalizado' },
  { id: 'all', name: 'Histórico' },
];

const METRIC_TABS = METRIC_OPTIONS.map((m) => ({ id: m.id, icon: m.icon, label: m.name }));

function RankBadge({ rank }) {
  const meta = rankMeta(rank);
  const idPrefix = `leaderboard-tab-rank-badge-${rank}`;

  if (meta) return <MaterialCommunityIcons color={meta.color} name={meta.icon} size={20} />;

  return (
    <View className="h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700" nativeID={idPrefix} testID={idPrefix}>
      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        {rank}
      </Text>
    </View>
  );
}

// `isRecord` (puesto 1 en modo Histórico) reusa el estilo ámbar que antes
// vivía en una card aparte, debajo de las 5 filas -- mezclado acá para que
// el puesto 1 sea LA MISMA fila que el récord, no dos números distintos
// para la misma persona compitiendo por atención (pedido real, 2026-10-15).
function LeaderboardRow({ row, metric, idPrefix, accent = false, isRecord = false }) {
  const containerClass = isRecord
    ? 'border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10'
    : accent
    ? 'border-l-4 border-primary bg-primary-tint-subtle dark:bg-primary/10'
    : 'bg-white dark:bg-surface';

  return (
    <View className={`flex-row items-center gap-3 rounded-xl p-2 ${containerClass}`} nativeID={idPrefix} testID={idPrefix}>
      <RankBadge rank={row.rank} />
      <AvatarPicker accessibilityLabel={`Foto de ${row.name}`} idPrefix={`${idPrefix}-avatar`} initials={getUserInitials(row.name)} size={32} uri={row.avatarUrl} />
      <View className="flex-1" nativeID={`${idPrefix}-text`} testID={`${idPrefix}-text`}>
        {isRecord && (
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-record-label`} testID={`${idPrefix}-record-label`}>
            Récord del equipo
          </Text>
        )}
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {row.name}
        </Text>
      </View>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-value`} testID={`${idPrefix}-value`}>
        {formatMetricValue(metric, row.value)}
      </Text>
    </View>
  );
}

export function LeaderboardTab({ teamId }) {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const viewerName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim() || 'Vos';

  const [activeMetric, setActiveMetric] = useState(METRIC_OPTIONS[0].id);
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [periodModalVisible, setPeriodModalVisible] = useState(false);

  // Todo el borrador (período + rango) vive local al modal -- Cancelar no
  // toca nada acá, Aplicar pisa los 3 juntos de una (ver
  // leaderboard-period-modal.jsx).
  const applyPeriod = (nextPeriod, from, to) => {
    setPeriod(nextPeriod);
    setFromDate(from);
    setToDate(to);
    setPeriodModalVisible(false);
  };

  const from = period === 'custom' && fromDate ? toISODate(fromDate) : undefined;
  const to = period === 'custom' && toDate ? toISODate(toDate) : undefined;
  const periodLabel = period === 'custom' ? `${fromDate} – ${toDate}` : (PERIOD_OPTIONS.find((p) => p.id === period)?.name ?? '');

  const { leaderboard, loading, error } = useTeamLeaderboard(teamId, { metric: activeMetric, period, from, to });

  const viewerInTop = Boolean(leaderboard?.rows?.some((row) => String(row.userId) === String(leaderboard?.viewerRank?.userId)));
  const isHistoric = period === 'all';
  // Histórico: mismas 5 filas de siempre + la posición propia si no está
  // en el top 5 -- el puesto 1 pasa a ser el récord del equipo (mismo dato,
  // no uno aparte) con estilo ámbar. Mismo criterio que antes de esta
  // reestructura (CLAUDE.md, pedido real 2026-10-15), sin cambios de
  // comportamiento -- solo se movió de "una vez por sección" a "una vez
  // para la métrica activa".
  const visibleRows = isHistoric && leaderboard?.record
    ? [
        { userId: leaderboard.record.userId, name: leaderboard.record.name, avatarUrl: null, value: leaderboard.record.value, rank: 1 },
        ...(leaderboard?.rows ?? []).filter((row) => row.rank !== 1),
      ]
    : (leaderboard?.rows ?? []);

  return (
    <View className="rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="leaderboard-tab-root" testID="leaderboard-tab-root">
      <View className="mb-3 flex-row items-center gap-2" nativeID="leaderboard-tab-header" testID="leaderboard-tab-header">
        <View className="min-w-0 flex-1" nativeID="leaderboard-tab-subtabs-wrap" testID="leaderboard-tab-subtabs-wrap">
          <TabBar active={activeMetric} onChange={setActiveMetric} scope="leaderboard-tab-subtabs" tabs={METRIC_TABS} variant="compact" />
        </View>
        <View className="h-6 w-px bg-slate-200 dark:bg-slate-700" nativeID="leaderboard-tab-header-divider" testID="leaderboard-tab-header-divider" />
        <Pressable
          className="h-9 max-w-[140px] flex-row items-center gap-1 rounded-lg border border-slate-200 px-2.5 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 dark:active:bg-slate-700"
          nativeID="leaderboard-tab-period-trigger"
          onPress={() => setPeriodModalVisible(true)}
          testID="leaderboard-tab-period-trigger"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-month-outline" size={14} />
          <Text className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200" nativeID="leaderboard-tab-period-trigger-label" numberOfLines={1} testID="leaderboard-tab-period-trigger-label">
            {periodLabel}
          </Text>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={14} />
        </Pressable>
      </View>

      <View className="border-t border-slate-100 pt-3 dark:border-slate-800" nativeID="leaderboard-tab-body" testID="leaderboard-tab-body">
        {loading && (
          <View className="items-center py-4" nativeID="leaderboard-tab-loading" testID="leaderboard-tab-loading">
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        )}

        {!loading && error && (
          <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-error" testID="leaderboard-tab-error">
            No pudimos cargar este leaderboard.
          </Text>
        )}

        {!loading && !error && leaderboard && visibleRows.length === 0 && (
          <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-empty" testID="leaderboard-tab-empty">
            Todavía no hay datos para esta métrica en este período.
          </Text>
        )}

        {!loading && !error && leaderboard && visibleRows.length > 0 && (
          <View className="gap-2" nativeID="leaderboard-tab-rows" testID="leaderboard-tab-rows">
            {visibleRows.map((row) => (
              <LeaderboardRow idPrefix={`leaderboard-tab-row-${row.userId}`} isRecord={isHistoric && row.rank === 1} key={row.userId} metric={activeMetric} row={row} />
            ))}
            {leaderboard.viewerRank && !viewerInTop && (
              <LeaderboardRow accent idPrefix="leaderboard-tab-viewer-row" metric={activeMetric} row={{ ...leaderboard.viewerRank, name: viewerName }} />
            )}
          </View>
        )}
      </View>

      <LeaderboardPeriodModal
        fromDate={fromDate}
        onApply={applyPeriod}
        onCancel={() => setPeriodModalVisible(false)}
        options={PERIOD_OPTIONS}
        period={period}
        toDate={toDate}
        visible={periodModalVisible}
      />
    </View>
  );
}
