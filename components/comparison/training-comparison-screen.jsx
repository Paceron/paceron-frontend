import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isMobile, isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingsHistoryFiltersStore } from '../../store/trainings-history-filters-store.js';
import { useMyMemberTeams } from '../../hooks/use-teams.js';
import { EXERCISE_KIND_OPTIONS } from '../../hooks/use-exercises.js';
import { useComparisonList } from '../../hooks/use-activity-comparison.js';
import { buildComparisonRange, defaultComparisonRange } from '../../utils/comparison-range.js';
import {
  averageBasisLabel,
  averageValueLabel,
  EMPTY_COMPARISON_MESSAGE,
  formatComparisonDate,
  formatCompliance,
  kindLabel,
  PENDING_AVERAGE_LABEL,
  sessionStatusLabel,
  totalsDistanceLabel,
  totalsDurationLabel,
} from '../../utils/comparison-format.js';
import { buildRangeComparisonCsv, rangeComparisonFileName } from '../../utils/comparison-csv.js';
import { buildRangeComparisonHtml } from '../../utils/comparison-pdf-html.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DateField } from '../forms/fields.jsx';
import { FilterPanel } from '../shared/filter-panel.jsx';
import { ScreenCard } from '../shared/screen-card.jsx';
import { StatTile } from '../shared/stat-tile.jsx';
import { ComplianceBadge } from './compliance-badge.jsx';
import { ComplianceChart } from './compliance-chart.jsx';
import { ComparisonExportButtons } from './comparison-export-buttons.jsx';

// Resumen de "Comparar entrenamientos" (HU planificado vs realizado, Gap 35):
// cumplimiento de cada sesión del rango, un gráfico y la exportación. Arranca
// con el equipo y el rango que tenía el historial; sin rango, los últimos 30
// días. Ver docs/superpowers/specs/2026-10-13-training-comparison-design.md.

function initialRange() {
  const { dateFromInput, dateToInput } = useTrainingsHistoryFiltersStore.getState();
  if (dateFromInput && dateToInput && !buildComparisonRange(dateFromInput, dateToInput).error) {
    return { fromInput: dateFromInput, toInput: dateToInput };
  }
  return defaultComparisonRange();
}

function SessionRow({ session, isWide, onPress }) {
  const id = `training-comparison-session-${session.sessionInstanceId}`;
  const meta = [session.teamName, session.groupName, session.kinds.map(kindLabel).join(', ')].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityLabel={`${session.sessionName}, ${formatComparisonDate(session.date)}, cumplimiento ${formatCompliance(session.compliancePct)}`}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 active:opacity-80 dark:border-transparent dark:bg-surface-2 dark:hover:bg-surface-3"
      nativeID={id}
      onPress={onPress}
      testID={id}
    >
      <View className={isWide ? 'flex-row items-center gap-4' : 'gap-2'} nativeID={`${id}-content`} testID={`${id}-content`}>
        <View className="min-w-0 flex-1" nativeID={`${id}-main`} testID={`${id}-main`}>
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${id}-date`} testID={`${id}-date`}>
            {formatComparisonDate(session.date)} · {sessionStatusLabel(session.status)}
          </Text>
          {session.countsForAverage === false ? (
            <Text className="text-xs italic text-slate-500 dark:text-slate-400" nativeID={`${id}-pending-average`} testID={`${id}-pending-average`}>
              {PENDING_AVERAGE_LABEL}
            </Text>
          ) : null}
          <Text className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white" nativeID={`${id}-name`} numberOfLines={1} testID={`${id}-name`}>
            {session.sessionName}
          </Text>
          {meta ? (
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-meta`} numberOfLines={1} testID={`${id}-meta`}>
              {meta}
            </Text>
          ) : null}
        </View>
        <View className={isWide ? 'w-56' : ''} nativeID={`${id}-totals`} testID={`${id}-totals`}>
          <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${id}-sets`} testID={`${id}-sets`}>
            {session.totals.completedSets}/{session.totals.plannedSets} series · {session.totals.skippedSets} salteadas
          </Text>
          <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${id}-duration`} testID={`${id}-duration`}>
            Duración {totalsDurationLabel(session.totals)}
          </Text>
          {session.totals.plannedDistanceM != null || session.totals.actualDistanceM > 0 ? (
            <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${id}-distance`} testID={`${id}-distance`}>
              Distancia {totalsDistanceLabel(session.totals)}
            </Text>
          ) : null}
        </View>
        <View className={`flex-row items-center gap-1 ${isWide ? '' : 'self-start'}`} nativeID={`${id}-pct`} testID={`${id}-pct`}>
          <ComplianceBadge idPrefix={id} pct={session.compliancePct} />
          <MaterialCommunityIcons color="#94a3b8" name="chevron-right" size={18} />
        </View>
      </View>
    </Pressable>
  );
}

function TrainingComparisonContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isWide = isWeb && !isNarrowWeb;
  const userId = useAuthStore((s) => s.userId);
  const historyTeamId = useTrainingsHistoryFiltersStore((s) => s.teamId);
  const { teams } = useMyMemberTeams(userId);

  const [range, setRange] = useState(initialRange);
  const [teamId, setTeamId] = useState(historyTeamId || '');
  const [kind, setKind] = useState('');
  const { dateFrom, dateTo, error: rangeError } = buildComparisonRange(range.fromInput, range.toInput);

  const { list, loading, fetching, error, refetch } = useComparisonList({ dateFrom, dateTo, teamId: teamId || undefined, kind: kind || undefined });
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());

  const openSession = (session) => router.push({ pathname: '/training-comparison/session', params: { sessionInstanceId: session.sessionInstanceId, date: session.date } });
  const sessions = list?.sessions ?? [];
  const hasFilters = Boolean(teamId || kind);
  const clearFilters = () => {
    setTeamId('');
    setKind('');
    setRange(defaultComparisonRange());
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="training-comparison-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="training-comparison-scroll"
    >
      <ScreenCard maxWidthClassName="max-w-5xl" nativeID="training-comparison-container" testID="training-comparison-container">
        <View className="mb-6 flex-row items-center gap-2" nativeID="training-comparison-header" testID="training-comparison-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="training-comparison-back-button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/calendar'))}
            testID="training-comparison-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="training-comparison-back-label" testID="training-comparison-back-label">Entrenamientos</Text>
          </Pressable>
          <Text className="text-sm text-slate-400 dark:text-slate-600" nativeID="training-comparison-breadcrumb-separator" testID="training-comparison-breadcrumb-separator">/</Text>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="training-comparison-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="training-comparison-title">
            Comparar
          </Text>
        </View>

        <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="training-comparison-intro" testID="training-comparison-intro">
          Lo que hiciste contra lo que tenías planificado. Cada serie suma según el tiempo (o la distancia) que hiciste, hasta un 100 %; las salteadas o sin registro cuentan 0.
        </Text>

        <FilterPanel hasActiveFilters={hasFilters} idPrefix="training-comparison-filter" loading={fetching} onClear={clearFilters}>
          <View className="min-w-[280px] flex-1 flex-row gap-2" nativeID="training-comparison-filter-range" testID="training-comparison-filter-range">
            <View className="flex-1" nativeID="training-comparison-filter-from" testID="training-comparison-filter-from">
              <DateField label="Desde" onChange={(v) => setRange((r) => ({ ...r, fromInput: v }))} value={range.fromInput} />
            </View>
            <View className="flex-1" nativeID="training-comparison-filter-to" testID="training-comparison-filter-to">
              <DateField label="Hasta" onChange={(v) => setRange((r) => ({ ...r, toInput: v }))} value={range.toInput} />
            </View>
          </View>
          <View className="min-w-[140px] flex-1" nativeID="training-comparison-filter-kind" testID="training-comparison-filter-kind">
            <ResponsiveSelectField dense hideErrorRow label="Tipo" onChange={setKind} options={EXERCISE_KIND_OPTIONS} placeholder="Todos los tipos" value={kind} />
          </View>
          <View className="min-w-[140px] flex-1" nativeID="training-comparison-filter-team" testID="training-comparison-filter-team">
            <ResponsiveSelectField
              dense
              disabled={teams.length === 0}
              hideErrorRow
              label="Equipo"
              onChange={setTeamId}
              options={teams.map((t) => ({ id: t.id, name: t.name }))}
              placeholder="Todos los equipos"
              value={teamId}
            />
          </View>
        </FilterPanel>

        {rangeError ? (
          <Text className="mb-3 text-xs text-red-500 dark:text-red-400" nativeID="training-comparison-range-error" testID="training-comparison-range-error">
            {rangeError}
          </Text>
        ) : null}

        {loading ? (
          <View className="items-center py-10" nativeID="training-comparison-loading" testID="training-comparison-loading">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View className="items-center rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-900/50 dark:bg-surface" nativeID="training-comparison-error" testID="training-comparison-error">
            <MaterialCommunityIcons color="#f43f5e" name="alert-circle-outline" size={28} />
            <Text className="mt-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100" nativeID="training-comparison-error-title" testID="training-comparison-error-title">
              No pudimos armar la comparación
            </Text>
            <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="training-comparison-error-message" testID="training-comparison-error-message">
              {error.message}
            </Text>
            <Pressable className="mt-4 rounded-full bg-primary px-5 py-2 hover:opacity-90 active:opacity-80" nativeID="training-comparison-retry" onPress={() => refetch()} testID="training-comparison-retry">
              <Text className="text-sm font-semibold text-[#111518]" nativeID="training-comparison-retry-label" testID="training-comparison-retry-label">Reintentar</Text>
            </Pressable>
          </View>
        ) : list && sessions.length === 0 ? (
          <View className="items-center rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-transparent dark:bg-surface-2" nativeID="training-comparison-empty" testID="training-comparison-empty">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="scale-balance" size={32} />
            <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="training-comparison-empty-label" testID="training-comparison-empty-label">
              {EMPTY_COMPARISON_MESSAGE}
            </Text>
          </View>
        ) : list ? (
          <View className="gap-4" nativeID="training-comparison-results" testID="training-comparison-results">
            <View className="flex-row gap-3" nativeID="training-comparison-tiles" testID="training-comparison-tiles">
              <StatTile icon="percent-circle-outline" idPrefix="training-comparison-tile" hint={averageBasisLabel(list.summary)} label="Cumplimiento promedio" value={averageValueLabel(list.summary)} />
              <StatTile icon="calendar-check-outline" idPrefix="training-comparison-tile" label="Sesiones planificadas" value={String(list.summary.sessionsPlanned)} />
              <StatTile icon="run" idPrefix="training-comparison-tile" label="Con actividad" value={String(list.summary.sessionsWithActivity)} />
            </View>

            <View className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-transparent dark:bg-surface-2" nativeID="training-comparison-chart-card" testID="training-comparison-chart-card">
              <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2" nativeID="training-comparison-chart-header" testID="training-comparison-chart-header">
                <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100" nativeID="training-comparison-chart-title" testID="training-comparison-chart-title">
                  Cumplimiento por sesión
                </Text>
                <ComparisonExportButtons
                  buildCsv={() => buildRangeComparisonCsv(list)}
                  buildPdfHtml={() => buildRangeComparisonHtml(list)}
                  fileBaseName={rangeComparisonFileName(list, '').replace(/\.$/, '')}
                  idPrefix="training-comparison-export"
                />
              </View>
              <ComplianceChart onSelectSession={(id) => openSession(sessions.find((s) => s.sessionInstanceId === id))} sessions={sessions} />
            </View>

            <View className="gap-2" nativeID="training-comparison-list" testID="training-comparison-list">
              {sessions.map((session) => (
                <SessionRow isWide={isWide} key={session.sessionInstanceId} onPress={() => openSession(session)} session={session} />
              ))}
            </View>
          </View>
        ) : null}
      </ScreenCard>
    </ScrollView>
  );
}

export function TrainingComparisonScreen() {
  return (
    <RequireAuth>
      <TrainingComparisonContent />
    </RequireAuth>
  );
}
