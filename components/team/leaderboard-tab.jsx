import { useState } from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DateField } from '../forms/fields.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
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

function LeaderboardRow({ row, metric, idPrefix, accent = false }) {
  return (
    <View
      className={`flex-row items-center gap-3 rounded-xl p-3 ${accent ? 'border-l-4 border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'bg-white dark:bg-surface'}`}
      nativeID={idPrefix}
      testID={idPrefix}
    >
      <RankBadge rank={row.rank} />
      <AvatarPicker accessibilityLabel={`Foto de ${row.name}`} idPrefix={`${idPrefix}-avatar`} initials={getUserInitials(row.name)} size={32} uri={row.avatarUrl} />
      <Text className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
        {row.name}
      </Text>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-value`} testID={`${idPrefix}-value`}>
        {formatMetricValue(metric, row.value)}
      </Text>
    </View>
  );
}

function RecordCard({ record, metric, idPrefix }) {
  return (
    <View className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/10" nativeID={idPrefix} testID={idPrefix}>
      <Text className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>
        Récord del equipo
      </Text>
      <Text className="mt-1 text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-value`} testID={`${idPrefix}-value`}>
        {record.name} — {formatMetricValue(metric, record.value)}
      </Text>
    </View>
  );
}

// Una sección por métrica, siempre montada -- antes había un solo selector
// de métrica arriba y se veía una sola a la vez; pedido real 2026-10-15:
// mostrar las 6 siempre, colapsables, cada una con su propio período (no
// uno global). Expandida por default.
function MetricSection({ teamId, metricOption, viewerName, idPrefix }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(true);
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const metric = metricOption.id;
  const from = period === 'custom' && fromDate ? toISODate(fromDate) : undefined;
  const to = period === 'custom' && toDate ? toISODate(toDate) : undefined;

  const { leaderboard, loading, error } = useTeamLeaderboard(teamId, { metric, period, from, to });

  const viewerInTop = Boolean(leaderboard?.rows?.some((row) => String(row.userId) === String(leaderboard?.viewerRank?.userId)));
  const isHistoric = period === 'all';
  // Histórico: récord primero + 4 filas (no 5) -- 5 cards en total con el
  // récord incluido, en vez de apilar el récord debajo de las 5 filas del
  // período normal (pedido real 2026-10-15, antes el récord quedaba
  // colgado abajo de filas que ni siquiera eran del período histórico).
  const visibleRows = isHistoric ? (leaderboard?.rows ?? []).slice(0, 4) : (leaderboard?.rows ?? []);

  return (
    <View className="rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row flex-wrap items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>
          {metricOption.name}
        </Text>
        <View className="w-44" nativeID={`${idPrefix}-period-wrap`} testID={`${idPrefix}-period-wrap`}>
          {/* `label` único por sección aunque quede oculto (`hideLabel`) --
              SelectField/PickerField derivan su nativeID del label
              (`slugify`), sin esto las 6 secciones generarían el mismo id
              ("Período") y chocarían. */}
          <ResponsiveSelectField dense hideLabel label={`Período — ${metricOption.name}`} onChange={setPeriod} options={PERIOD_OPTIONS} value={period} />
        </View>
        {period === 'custom' && (
          <View className="flex-row flex-wrap items-center gap-2" nativeID={`${idPrefix}-custom-range`} testID={`${idPrefix}-custom-range`}>
            <View nativeID={`${idPrefix}-from-wrap`} style={{ width: 128 }} testID={`${idPrefix}-from-wrap`}>
              <DateField hideLabel label={`Desde — ${metricOption.name}`} onChange={setFromDate} value={fromDate} />
            </View>
            <View nativeID={`${idPrefix}-to-wrap`} style={{ width: 128 }} testID={`${idPrefix}-to-wrap`}>
              <DateField hideLabel label={`Hasta — ${metricOption.name}`} onChange={setToDate} value={toDate} />
            </View>
          </View>
        )}
        <IconTooltip idPrefix={`${idPrefix}-toggle-tooltip`} label={expanded ? 'Colapsar' : 'Expandir'} position="bottom">
          <Pressable
            className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition-colors duration-150 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600"
            nativeID={`${idPrefix}-toggle`}
            onPress={() => setExpanded((v) => !v)}
            testID={`${idPrefix}-toggle`}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
          </Pressable>
        </IconTooltip>
      </View>

      {expanded && (
        <View className="mt-3" nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
          {loading && (
            <View className="items-center py-4" nativeID={`${idPrefix}-loading`} testID={`${idPrefix}-loading`}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          )}

          {!loading && error && (
            <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-error`} testID={`${idPrefix}-error`}>
              No pudimos cargar este leaderboard.
            </Text>
          )}

          {!loading && !error && leaderboard && visibleRows.length === 0 && !(isHistoric && leaderboard.record) && (
            <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>
              Todavía no hay datos para esta métrica en este período.
            </Text>
          )}

          {!loading && !error && leaderboard && (visibleRows.length > 0 || (isHistoric && leaderboard.record)) && (
            <View className="gap-2" nativeID={`${idPrefix}-rows`} testID={`${idPrefix}-rows`}>
              {isHistoric && leaderboard.record && (
                <RecordCard idPrefix={`${idPrefix}-record`} metric={metric} record={leaderboard.record} />
              )}
              {visibleRows.map((row) => (
                <LeaderboardRow idPrefix={`${idPrefix}-row-${row.userId}`} key={row.userId} metric={metric} row={row} />
              ))}
              {leaderboard.viewerRank && !viewerInTop && (
                <LeaderboardRow accent idPrefix={`${idPrefix}-viewer-row`} metric={metric} row={{ ...leaderboard.viewerRank, name: viewerName }} />
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function LeaderboardTab({ teamId }) {
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const viewerName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim() || 'Vos';

  return (
    <View className="gap-3" nativeID="leaderboard-tab-root" testID="leaderboard-tab-root">
      {METRIC_OPTIONS.map((metricOption) => (
        <MetricSection
          idPrefix={`leaderboard-tab-section-${metricOption.id}`}
          key={metricOption.id}
          metricOption={metricOption}
          teamId={teamId}
          viewerName={viewerName}
        />
      ))}
    </View>
  );
}
