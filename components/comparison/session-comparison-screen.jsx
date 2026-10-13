import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isMobile, isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { useSessionComparison } from '../../hooks/use-activity-comparison.js';
import {
  formatComparisonDate,
  formatPace,
  formatSchedule,
  kindLabel,
  NO_TARGET_LABEL,
  plannedExerciseLabel,
  roleLabel,
  sessionStatusLabel,
  setActualLabel,
  setDeviationLabel,
  totalsDistanceLabel,
  totalsDurationLabel,
} from '../../utils/comparison-format.js';
import { buildSessionComparisonCsv, sessionComparisonFileName } from '../../utils/comparison-csv.js';
import { buildSessionComparisonHtml } from '../../utils/comparison-pdf-html.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { ComplianceBadge } from './compliance-badge.jsx';
import { ComparisonExportButtons } from './comparison-export-buttons.jsx';

// Detalle "planificado vs realizado" de una sesión (Gap 35): cada ejercicio
// con su objetivo y cada serie con lo hecho, la desviación y su cumplimiento.
// Los parámetros van en la URL (sessionInstanceId, date) para que un F5 en web
// no pierda la pantalla. Se llega desde el resumen, desde el menú de una fila
// del historial o al terminar la ejecución.

const STATUS_ICON = { completed: 'check-circle', skipped: 'skip-next-circle-outline', unregistered: 'circle-outline' };
const STATUS_COLOR = { completed: '#8cc63e', skipped: '#f59e0b', unregistered: '#94a3b8' };

function SetRow({ set, planned, isWide, idPrefix }) {
  const id = `${idPrefix}-set-${set.setNumber}`;
  const deviation = setDeviationLabel(set);
  const pace = formatPace(set.paceSecPerKm);
  return (
    <View className={`border-t border-slate-100 py-2.5 dark:border-slate-800 ${isWide ? 'flex-row items-center gap-3' : 'gap-1'}`} nativeID={id} testID={id}>
      <View className={`flex-row items-center gap-2 ${isWide ? 'w-28' : ''}`} nativeID={`${id}-number`} testID={`${id}-number`}>
        <MaterialCommunityIcons color={STATUS_COLOR[set.status] ?? '#94a3b8'} name={STATUS_ICON[set.status] ?? 'circle-outline'} size={16} />
        <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100" nativeID={`${id}-number-text`} testID={`${id}-number-text`}>
          Serie {set.setNumber}{set.extra ? ' (extra)' : ''}
        </Text>
      </View>
      <View className={isWide ? 'w-32' : ''} nativeID={`${id}-planned`} testID={`${id}-planned`}>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-planned-text`} testID={`${id}-planned-text`}>
          Planificado: {set.extra ? 'fuera del plan' : planned}
        </Text>
      </View>
      <View className="min-w-0 flex-1" nativeID={`${id}-actual`} testID={`${id}-actual`}>
        <Text className="text-sm text-slate-800 dark:text-slate-100" nativeID={`${id}-actual-text`} testID={`${id}-actual-text`}>
          Realizado: {setActualLabel(set)}{pace ? ` · ${pace}` : ''}{set.rpe != null ? ` · RPE ${set.rpe}` : ''}
        </Text>
        {deviation ? (
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-deviation`} testID={`${id}-deviation`}>
            Desviación {deviation}
          </Text>
        ) : null}
      </View>
      {set.extra ? null : <ComplianceBadge idPrefix={id} pct={set.compliancePct} />}
    </View>
  );
}

function ExerciseCard({ exercise, isWide, index }) {
  const id = `session-comparison-exercise-${index}`;
  const plannedSet = exercise.hasTarget ? plannedExerciseLabel(exercise.planned).replace(/^\d+ × /, '') : NO_TARGET_LABEL;
  const extras = [kindLabel(exercise.kind), exercise.planned.paceSecPerKm ? `ritmo ${formatPace(exercise.planned.paceSecPerKm)}` : null, exercise.intensity ? `intensidad ${exercise.intensity}` : null].filter(Boolean);
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={id} testID={id}>
      <View className="mb-1 flex-row items-start justify-between gap-3" nativeID={`${id}-header`} testID={`${id}-header`}>
        <View className="min-w-0 flex-1" nativeID={`${id}-title`} testID={`${id}-title`}>
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${id}-role`} testID={`${id}-role`}>
            {roleLabel(exercise.role)}
          </Text>
          <Text className="text-base font-semibold text-slate-900 dark:text-white" nativeID={`${id}-name`} testID={`${id}-name`}>
            {exercise.name}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-plan`} testID={`${id}-plan`}>
            Plan: {plannedExerciseLabel(exercise.planned)}{extras.length ? ` · ${extras.join(' · ')}` : ''}
          </Text>
        </View>
        <ComplianceBadge idPrefix={id} pct={exercise.compliancePct} />
      </View>
      {exercise.sets.map((set) => (
        <SetRow idPrefix={id} isWide={isWide} key={`${set.setNumber}-${set.extra}`} planned={plannedSet} set={set} />
      ))}
    </View>
  );
}

function SessionComparisonContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isWide = isWeb && !isNarrowWeb;
  const { sessionInstanceId } = useLocalSearchParams();
  const { comparison, loading, error, refetch } = useSessionComparison(sessionInstanceId);
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/training-comparison'));
  const schedule = comparison ? formatSchedule(comparison.startedAt, comparison.endedAt) : null;
  const notFound = error?.status === 404;

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="session-comparison-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="session-comparison-scroll"
    >
      <View className={`w-full self-center ${isWide ? 'max-w-4xl' : ''}`} nativeID="session-comparison-container" testID="session-comparison-container">
        <View className="mb-6 flex-row items-center gap-2" nativeID="session-comparison-header" testID="session-comparison-header">
          <Pressable className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70" nativeID="session-comparison-back-button" onPress={goBack} testID="session-comparison-back-button">
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="session-comparison-back-label" testID="session-comparison-back-label">Comparar</Text>
          </Pressable>
          <Text className="text-sm text-slate-400 dark:text-slate-600" nativeID="session-comparison-breadcrumb-separator" testID="session-comparison-breadcrumb-separator">/</Text>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="session-comparison-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="session-comparison-title">
            Sesión
          </Text>
        </View>

        {loading ? (
          <View className="items-center py-10" nativeID="session-comparison-loading" testID="session-comparison-loading">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View className="items-center rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-900/50 dark:bg-surface" nativeID="session-comparison-error" testID="session-comparison-error">
            <MaterialCommunityIcons color="#f43f5e" name="alert-circle-outline" size={28} />
            <Text className="mt-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100" nativeID="session-comparison-error-title" testID="session-comparison-error-title">
              {notFound ? 'No encontramos esta sesión' : 'No pudimos armar la comparación'}
            </Text>
            <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="session-comparison-error-message" testID="session-comparison-error-message">
              {notFound ? 'Puede que se haya reasignado o borrado.' : error.message}
            </Text>
            {notFound ? null : (
              <Pressable className="mt-4 rounded-full bg-primary px-5 py-2 hover:opacity-90 active:opacity-80" nativeID="session-comparison-retry" onPress={() => refetch()} testID="session-comparison-retry">
                <Text className="text-sm font-semibold text-[#111518]" nativeID="session-comparison-retry-label" testID="session-comparison-retry-label">Reintentar</Text>
              </Pressable>
            )}
          </View>
        ) : comparison ? (
          <View className="gap-4" nativeID="session-comparison-content" testID="session-comparison-content">
            <View className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID="session-comparison-summary" testID="session-comparison-summary">
              <View className={isWide ? 'flex-row items-center justify-between gap-4' : 'gap-3'} nativeID="session-comparison-summary-row" testID="session-comparison-summary-row">
                <View className="min-w-0 flex-1" nativeID="session-comparison-summary-info" testID="session-comparison-summary-info">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-comparison-date" testID="session-comparison-date">
                    {formatComparisonDate(comparison.date)}{schedule ? ` · ${schedule}` : ''} · {sessionStatusLabel(comparison.status)}
                  </Text>
                  <Text className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white" nativeID="session-comparison-name" testID="session-comparison-name">
                    {comparison.sessionName}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-comparison-meta" testID="session-comparison-meta">
                    {[comparison.teamName, comparison.groupName, comparison.kinds.map(kindLabel).join(', ')].filter(Boolean).join(' · ')}
                  </Text>
                  <Text className="mt-2 text-sm text-slate-700 dark:text-slate-200" nativeID="session-comparison-duration" testID="session-comparison-duration">
                    Duración planificada vs real: {totalsDurationLabel(comparison.totals)}
                  </Text>
                  <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="session-comparison-distance" testID="session-comparison-distance">
                    Distancia planificada vs real: {comparison.totals.plannedDistanceM == null && comparison.totals.actualDistanceM === 0 ? 'no aplica' : totalsDistanceLabel(comparison.totals)}
                  </Text>
                  <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="session-comparison-sets" testID="session-comparison-sets">
                    Series: {comparison.totals.completedSets} completadas, {comparison.totals.skippedSets} salteadas, {comparison.totals.unregisteredSets} sin registro de {comparison.totals.plannedSets}
                  </Text>
                </View>
                <View className={isWide ? 'items-end gap-3' : 'gap-3'} nativeID="session-comparison-summary-side" testID="session-comparison-summary-side">
                  <View className="items-start" nativeID="session-comparison-pct" testID="session-comparison-pct">
                    <Text className="mb-1 text-xs text-slate-500 dark:text-slate-400" nativeID="session-comparison-pct-label" testID="session-comparison-pct-label">Cumplimiento</Text>
                    <ComplianceBadge idPrefix="session-comparison-pct" pct={comparison.compliancePct} size="lg" />
                  </View>
                  <ComparisonExportButtons
                    buildCsv={() => buildSessionComparisonCsv(comparison)}
                    buildPdfHtml={() => buildSessionComparisonHtml(comparison)}
                    fileBaseName={sessionComparisonFileName(comparison, '').replace(/\.$/, '')}
                    idPrefix="session-comparison-export"
                  />
                </View>
              </View>
            </View>

            {comparison.exercises.map((exercise, index) => (
              <ExerciseCard exercise={exercise} index={index} isWide={isWide} key={exercise.exerciseInstanceId} />
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

export function SessionComparisonScreen() {
  return (
    <RequireAuth>
      <SessionComparisonContent />
    </RequireAuth>
  );
}
