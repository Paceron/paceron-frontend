import { useState } from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Row, Col, DateField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { useTeamLeaderboard } from '../../hooks/use-team-leaderboard.js';
import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
import { rankMeta } from '../../utils/leaderboard-rank-meta.js';
import { toISODate } from '../../utils/date-field-format.js';
import { getUserInitials } from '../../utils/user-initials.js';

const METRIC_OPTIONS = [
  { id: 'distance', name: 'Distancia' },
  { id: 'duration', name: 'Tiempo de entrenamiento' },
  { id: 'pace', name: 'Mejor ritmo' },
  { id: 'peak_speed', name: 'Velocidad pico' },
  { id: 'sessions_count', name: 'Entrenamientos realizados' },
  { id: 'attendance_count', name: 'Asistencias' },
];

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

export function LeaderboardTab({ teamId }) {
  const [metric, setMetric] = useState('distance');
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const from = period === 'custom' && fromDate ? toISODate(fromDate) : undefined;
  const to = period === 'custom' && toDate ? toISODate(toDate) : undefined;

  const { leaderboard, loading, error } = useTeamLeaderboard(teamId, { metric, period, from, to });

  const viewerInTop = Boolean(leaderboard?.rows?.some((row) => String(row.userId) === String(leaderboard?.viewerRank?.userId)));

  return (
    <View nativeID="leaderboard-tab-root" testID="leaderboard-tab-root">
      <Row>
        <Col>
          <ResponsiveSelectField dense label="Métrica" onChange={setMetric} options={METRIC_OPTIONS} value={metric} />
        </Col>
        <Col>
          <ResponsiveSelectField dense label="Período" onChange={setPeriod} options={PERIOD_OPTIONS} value={period} />
        </Col>
      </Row>

      {period === 'custom' && (
        <Row>
          <Col>
            <DateField label="Desde" onChange={setFromDate} value={fromDate} />
          </Col>
          <Col>
            <DateField label="Hasta" onChange={setToDate} value={toDate} />
          </Col>
        </Row>
      )}

      {loading && (
        <Text className="mt-4 text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-loading" testID="leaderboard-tab-loading">
          Cargando…
        </Text>
      )}

      {!loading && error && (
        <Text className="mt-4 text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-error" testID="leaderboard-tab-error">
          No pudimos cargar el leaderboard.
        </Text>
      )}

      {!loading && !error && leaderboard && leaderboard.rows.length === 0 && (
        <Text className="mt-4 text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-empty" testID="leaderboard-tab-empty">
          Todavía no hay datos para esta métrica en este período.
        </Text>
      )}

      {!loading && !error && leaderboard && leaderboard.rows.length > 0 && (
        <View className="mt-4 gap-2" nativeID="leaderboard-tab-rows" testID="leaderboard-tab-rows">
          {leaderboard.rows.map((row) => (
            <LeaderboardRow idPrefix={`leaderboard-tab-row-${row.userId}`} key={row.userId} metric={metric} row={row} />
          ))}
          {leaderboard.viewerRank && !viewerInTop && (
            <LeaderboardRow accent idPrefix="leaderboard-tab-viewer-row" metric={metric} row={{ ...leaderboard.viewerRank, name: 'Tu posición' }} />
          )}
        </View>
      )}

      {!loading && !error && period === 'all' && leaderboard?.record && (
        <View className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/10" nativeID="leaderboard-tab-record" testID="leaderboard-tab-record">
          <Text className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID="leaderboard-tab-record-title" testID="leaderboard-tab-record-title">
            Récord del equipo
          </Text>
          <Text className="mt-1 text-sm text-slate-700 dark:text-slate-200" nativeID="leaderboard-tab-record-value" testID="leaderboard-tab-record-value">
            {leaderboard.record.name} — {formatMetricValue(metric, leaderboard.record.value)}
          </Text>
        </View>
      )}
    </View>
  );
}
