import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { LeaderboardDateRangeModal } from './leaderboard-date-range-modal.jsx';
import { useTeamLeaderboard } from '../../hooks/use-team-leaderboard.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useThemeColors } from '../../theme/colors.js';
import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
import { rankMeta } from '../../utils/leaderboard-rank-meta.js';
import { toISODate } from '../../utils/date-field-format.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';
import { isWeb } from '../../utils/platform.js';

const PERIOD_OPTIONS = [
  { id: 'week', name: 'Última semana' },
  { id: 'month', name: 'Último mes' },
  { id: 'year', name: 'Último año' },
  { id: 'custom', name: 'Rango personalizado' },
  { id: 'all', name: 'Histórico' },
];

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
  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  // Período justo antes de abrir el modal de rango -- si el usuario
  // cancela sin aplicar, se restaura este valor. Cuando se abre desde el
  // lápiz del chip (ya en 'custom') esto es un no-op: cancelar deja
  // `period` como estaba. Cuando se abre por elegir 'custom' en el select
  // desde otro período, cancelar vuelve a ese período anterior -- así
  // nunca queda trabado en 'custom' sin rango confirmado.
  const periodBeforeCustomRef = useRef('month');

  const handlePeriodChange = (next) => {
    if (next === 'custom') {
      periodBeforeCustomRef.current = period;
      setRangeModalVisible(true);
    }
    setPeriod(next);
  };

  const openRangeModal = () => {
    periodBeforeCustomRef.current = period;
    setRangeModalVisible(true);
  };

  const cancelRangeModal = () => {
    setRangeModalVisible(false);
    setPeriod(periodBeforeCustomRef.current);
  };

  const applyRangeModal = (from, to) => {
    setFromDate(from);
    setToDate(to);
    setRangeModalVisible(false);
  };

  const from = period === 'custom' && fromDate ? toISODate(fromDate) : undefined;
  const to = period === 'custom' && toDate ? toISODate(toDate) : undefined;
  const hasConfirmedRange = period === 'custom' && Boolean(fromDate) && Boolean(toDate);

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
      <View className="mb-3 flex-row items-center gap-3" nativeID="leaderboard-tab-header" testID="leaderboard-tab-header">
        <View nativeID="leaderboard-tab-metric-wrap" testID="leaderboard-tab-metric-wrap">
          <ResponsiveSelectField className={isWeb ? 'flex-row items-center gap-2' : 'mb-0'} hideErrorRow label="Métrica" onChange={setActiveMetric} options={METRIC_OPTIONS} outline required value={activeMetric} />
        </View>
        <View className="h-6 w-px bg-slate-200 dark:bg-slate-700" nativeID="leaderboard-tab-header-divider" testID="leaderboard-tab-header-divider" />
        <View nativeID="leaderboard-tab-period-wrap" testID="leaderboard-tab-period-wrap">
          <ResponsiveSelectField className={isWeb ? 'flex-row items-center gap-2' : 'mb-0'} hideErrorRow label="Período" onChange={handlePeriodChange} options={PERIOD_OPTIONS} outline required value={period} />
        </View>
      </View>

      {hasConfirmedRange && (
        <View className="mb-3 flex-row items-center gap-2" nativeID="leaderboard-tab-range-chip" testID="leaderboard-tab-range-chip">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-range" size={14} />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="leaderboard-tab-range-chip-label" testID="leaderboard-tab-range-chip-label">
            {fromDate} – {toDate}
          </Text>
          <IconTooltip idPrefix="leaderboard-tab-range-edit-tooltip" label="Editar rango" position="bottom">
            <Pressable
              className="h-6 w-6 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="leaderboard-tab-range-edit-button"
              onPress={openRangeModal}
              testID="leaderboard-tab-range-edit-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={14} />
            </Pressable>
          </IconTooltip>
        </View>
      )}

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

      <LeaderboardDateRangeModal
        initialFrom={fromDate}
        initialTo={toDate}
        onCancel={cancelRangeModal}
        onConfirm={applyRangeModal}
        visible={rangeModalVisible}
      />
    </View>
  );
}
