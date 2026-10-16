import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
import { useDashboardComparisons, useDashboardPeriodComparison } from '../../hooks/use-dashboard-comparisons.js';
import { useDashboardFilters } from '../../hooks/use-dashboard-filters.js';
import { useDashboardLeaderboard } from '../../hooks/use-dashboard-leaderboard.js';
import { useDashboardSummary } from '../../hooks/use-dashboard-summary.js';
import { useDashboardTimeseries } from '../../hooks/use-dashboard-timeseries.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import {
  DASHBOARD_GRANULARITIES,
  DASHBOARD_LEADERBOARD_SORTS,
  DASHBOARD_ORDERS,
} from '../../services/dashboard.js';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';
import { DEFAULT_TOLERANCE, formatKind } from '../../utils/dashboard-format.js';
import { fromISODate } from '../../utils/date-field-format.js';
import { exercisesForKind, reconcileExercise } from '../../utils/dashboard-filter-cascade.js';
import { resolveDashboardRange } from '../../utils/dashboard-range.js';
import { PALETTE_CASES, describePalette } from '../../utils/dashboard-palette.js';
import { ChartCard } from './charts/chart-surface.jsx';
import { RadarChart } from './charts/radar-chart.jsx';
import { ComparisonStrip } from './comparison-strip.jsx';
import { FiltersBar } from './filters-bar.jsx';
import { LeaderboardTable } from './leaderboard-table.jsx';
import { PaletteSwitch } from './palette-switch.jsx';
import { QualityBanner } from './quality-banner.jsx';
import { RunnerProgress } from './runner-progress.jsx';
import { StateEmpty } from './state-empty.jsx';
import { StateError } from './state-error.jsx';
import { StateForbidden } from './state-forbidden.jsx';
import { StateInvalidRequest } from './state-invalid-request.jsx';
import { StateNotFound } from './state-not-found.jsx';
import { StateOnboarding } from './state-onboarding.jsx';
import { StateSkeleton } from './state-skeleton.jsx';

// Orquestación de la pantalla de rendimiento: estados, filtros y las DOS
// variantes por rol.
//
// Las dos variantes NO son una filtrada por un flag de visibilidad: son dos
// subárboles distintos, decididos con `activeRole`, y el de corredor no monta ni
// el ranking ni las comparaciones — los hooks de leaderboard y comparisons viven
// DENTRO del componente del entrenador, así que para un corredor ni siquiera se
// llaman. Además el backend responde 403 a `/leaderboard` y a los dos
// `/comparisons` para quien no es dueño del equipo, así que la regla no queda
// solo en la UI.
//
// El contenedor y la barra de filtros están FUERA de la región que conmuta de
export function DashboardScreen({ teamId }) {
  const isNarrow = useIsNarrowWeb();
  const activeRole = useAuthStore((state) => state.activeRole);
  const isTrainer = activeRole === 'trainer';

  const [groupId, setGroupId] = useState('');
  const [athleteUserId, setAthleteUserId] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const [kind, setKind] = useState('');
  const [distanceFrom, setDistanceFrom] = useState('');
  const [distanceTo, setDistanceTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [granularity, setGranularity] = useState(DASHBOARD_GRANULARITIES[0]);
  const [sort, setSort] = useState(DASHBOARD_LEADERBOARD_SORTS[0]);
  const [order, setOrder] = useState(DASHBOARD_ORDERS[0]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // El rango se siembra con el `date_range` REAL que devuelve /dashboard/filters,
  // y solo la primera vez: después manda lo que eligió la persona. Sin este flag,
  // cada refetch de filtros le borraría el rango a quien lo tocó.
  const rangeSeeded = useRef(false);

  const filtersQuery = useDashboardFilters({ teamId });
  const filtersData = filtersQuery.data;
  const exercises = useMemo(() => filtersData?.exercises ?? [], [filtersData]);

  useEffect(() => {
    if (rangeSeeded.current) return;
    const range = filtersData?.date_range;
    if (!range?.min) return;
    rangeSeeded.current = true;
    setFrom(fromISODate(range.min));
    setTo(fromISODate(range.max));
  }, [filtersData]);

  // Los rangos se escriben en km y minutos, que es lo que se muestra; lo que
  // viaja al request queda en metros y minutos enteros. Un valor escrito a mano
  // que no se puede interpretar, o un rango invertido, NO se aplica: el error
  // va en el campo y el backend nunca llega a responder 400 (spec, rangos).
  const appliedRange = useMemo(
    () => resolveDashboardRange({ distanceFrom, distanceTo, timeFrom, timeTo }),
    [distanceFrom, distanceTo, timeFrom, timeTo],
  );

  const exerciseOptions = useMemo(() => exercisesForKind(exercises, kind), [exercises, kind]);

  const changeKind = useCallback((nextKind) => {
    const value = nextKind ?? '';
    setKind(value);
    // El ejercicio se deselecciona si deja de estar en la lista del tipo nuevo:
    // dejarlo puesto es un estado imposible visible (un filtro de distancia de
    // un tipo con un ejercicio del otro arriba). El id viaja como lo dejó la
    // lista de `/dashboard/filters`, no como el string del select.
    setExerciseId(reconcileExercise(exercises, value, exerciseId) ?? '');
  }, [exercises, exerciseId]);

  const scope = useMemo(
    () => ({
      teamId,
      groupId: groupId || null,
      exerciseId: exerciseId || null,
      // `kind` y `exercise_id` son excluyentes en el backend
      // (resolveExerciseFilter): con un ejercicio elegido, el tipo ya viene
      // implícito en él y mandarlo sería un 400.
      kind: exerciseId ? null : kind || null,
      distanceFromM: appliedRange.distanceFromM,
      distanceToM: appliedRange.distanceToM,
      timeFromMin: appliedRange.timeFromMin,
      timeToMin: appliedRange.timeToMin,
      from,
      to,
      tolerance: DEFAULT_TOLERANCE,
    }),
    [teamId, groupId, exerciseId, kind, appliedRange, from, to],
  );

  // `from` es obligatorio en los cinco GET de métricas (MISSING_FROM es uno de los
  // estados que hay que saber pintar), así que las queries no corren hasta que el
  // rango real existe. Con `enabled: false`, `isPending` sigue en true pero
  // `isFetching` en false, y por eso el `loading` de los hooks queda en false.
  const hasRange = Boolean(from);
  const summaryQuery = useDashboardSummary({ ...scope, enabled: hasRange });
  const timeseriesQuery = useDashboardTimeseries({ ...scope, granularity, enabled: hasRange });

  const summary = summaryQuery.data;
  const timeseries = timeseriesQuery.data;
  const metricsLoading = hasRange && (summaryQuery.loading || timeseriesQuery.loading);
  const metricsError = summaryQuery.failed ? summaryQuery.error : timeseriesQuery.failed ? timeseriesQuery.error : null;
  const selectedExercise = exercises.find((exercise) => String(exercise.id) === String(exerciseId));
  const effectiveKind = kind || selectedExercise?.kind || null;

  const widenRange = useCallback(() => {
    const range = filtersData?.date_range;
    if (range?.min && range?.max) {
      setFrom(fromISODate(range.min));
      setTo(fromISODate(range.max));
    }
  }, [filtersData]);

  const resetFilters = useCallback(() => {
    setGroupId('');
    setAthleteUserId('');
    setExerciseId('');
    setKind('');
    setDistanceFrom('');
    setDistanceTo('');
    setTimeFrom('');
    setTimeTo('');
    widenRange();
  }, [widenRange]);

  const toggleSort = useCallback((column) => {
    if (column === sort) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    // Al cambiar de columna se elige el sentido con el que ESA columna ordena
    // bien, no el que estaba puesto antes: `best_time_ms` y `compliance_rate`
    // arrancan ascendente (menor tiempo es mejor) y las otras dos descendente.
    setSort(column);
    setOrder(column === 'mean_speed_kph' || column === 'total_distance_m' ? 'desc' : 'asc');
  }, [sort]);

  return (
    // Sin `flex-1`: la pantalla se monta dentro del ScrollView del detalle de
    // equipo, y un hijo con flex-grow dentro del contentContainer de un
    // ScrollView queda con alto cero en nativo.
    <View nativeID="dashboard-screen" testID="dashboard-screen">
      <View className={`w-full self-center px-4 py-6 ${isNarrow ? '' : 'max-w-3xl'}`} nativeID="dashboard-screen-container" testID="dashboard-screen-container">
        <View className="mb-4 flex-row items-center gap-2" nativeID="dashboard-screen-header" testID="dashboard-screen-header">
          <MaterialCommunityIcons color="#8cc63e" name="chart-timeline-variant" size={20} />
          <Text className="flex-1 text-lg font-bold text-slate-900 dark:text-white" nativeID="dashboard-screen-title" testID="dashboard-screen-title">
            Rendimiento
          </Text>
        </View>

        <ScreenBody
          error={filtersQuery.failed ? filtersQuery.error : null}
          filtersLoading={filtersQuery.loading}
          hasDateRange={Boolean(filtersData?.date_range)}
          metricsError={metricsError}
          metricsLoading={metricsLoading}
          onRetry={filtersQuery.refetch}
          onResetFilters={resetFilters}
          onWidenRange={widenRange}
          seriesCount={summary?.series_count ?? null}
          summary={summary}
        />

        {summary ? (
          <View nativeID="dashboard-content" testID="dashboard-content">
            <QualityBanner id="dashboard-quality-banner" quality={summary.data_quality} />

            <FiltersBar
              athleteUserId={athleteUserId}
              athletes={filtersData?.athletes ?? []}
              distanceFrom={distanceFrom}
              distanceTo={distanceTo}
              exerciseId={exerciseId}
              exercises={exerciseOptions}
              from={from}
              groupId={groupId}
              groups={filtersData?.groups ?? []}
              kind={kind}
              loading={filtersQuery.loading}
              onChangeAthlete={setAthleteUserId}
              onChangeDistanceFrom={setDistanceFrom}
              onChangeDistanceTo={setDistanceTo}
              onChangeExercise={(value) => setExerciseId(value ?? '')}
              onChangeFrom={setFrom}
              onChangeGroup={(value) => setGroupId(value ?? '')}
              onChangeKind={changeKind}
              onChangeTimeFrom={setTimeFrom}
              onChangeTimeTo={setTimeTo}
              onChangeTo={setTo}
              rangeErrors={appliedRange.errors}
              scope={describeScope(filtersData, selectedExercise, kind)}
              showAthlete={isTrainer}
              to={to}
            />

            {isTrainer ? (
              <TrainerDashboard
                from={from}
                granularity={granularity}
                kind={effectiveKind}
                onGranularityChange={setGranularity}
                order={order}
                scope={scope}
                sort={sort}
                summary={summary}
                timeseries={timeseries}
                to={to}
                toggleSort={toggleSort}
              />
            ) : (
              <RunnerProgress
                granularity={granularity}
                kind={effectiveKind}
                onGranularityChange={setGranularity}
                summary={summary}
                timeseries={timeseries}
              />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Los siete estados, en el orden en que se evalúan. Vive aparte del componente
// para que la cadena de `return` de la pantalla no quede enterrada en el JSX.
function ScreenBody({
  filtersLoading,
  error,
  hasDateRange,
  metricsLoading,
  metricsError,
  seriesCount,
  onRetry,
  onResetFilters,
  onWidenRange,
}) {
  if (filtersLoading) return <StateSkeleton />;
  if (error) return <DashboardErrorState error={error} onRetry={onRetry} />;
  // `date_range: null` es "el scope no tiene ninguna sesión registrada", que es
  // un estado distinto de "hay datos acotados" — por eso el primer uso tiene su
  // propio componente y no se muestra un rango inventado.
  if (!hasDateRange) return <StateOnboarding />;
  if (metricsLoading) return <StateSkeleton />;
  if (metricsError) return <DashboardErrorState error={metricsError} onResetFilters={onResetFilters} />;
  // Sin series en el período el filtro es válido pero no hay nada que mostrar.
  // `series_count` es el de las series VÁLIDAS: un período con filas que no se
  // pueden calcular tampoco tiene indicadores que enseñar.
  if (!seriesCount) return <StateEmpty onWidenRange={onWidenRange} />;
  return null;
}

// Traduce la clasificación de utils/dashboard-error-codes.js al componente de
// estado. El botón de reintentar aparece SOLO en el transitorio: un 400/403/404
// devuelve lo mismo si se reintenta sin cambiar la request.
function DashboardErrorState({ error, onRetry, onResetFilters }) {
  const router = useRouter();
  const resolved = resolveDashboardError(error);

  if (resolved.kind === 'forbidden') return <StateForbidden error={error} />;
  if (resolved.kind === 'not_found') return <StateNotFound error={error} onBack={() => router.back()} />;
  if (resolved.kind === 'invalid') {
    return (
      <StateInvalidRequest
        error={error}
        onFix={onResetFilters}
        onResetParam={onResetFilters}
        onResetTolerance={onResetFilters}
      />
    );
  }
  return <StateError error={error} onRetry={onRetry} />;
}

// Variante del ENTRENADOR: KPIs, evolución, radar, ranking y comparaciones. Los
// hooks de leaderboard y comparisons viven acá, así que para un corredor no se
// llaman ni se montan.
function TrainerDashboard({ summary, timeseries, scope, kind, from, to, sort, order, toggleSort, granularity, onGranularityChange }) {
  const leaderboard = useDashboardLeaderboard({ ...scope, sort, order });
  const comparisons = useDashboardComparisons({ ...scope });
  const periods = useDashboardPeriodComparison({ ...scope, current: { from, to } });
  const palette = describePalette(summary, kind);
  const units = leaderboard.units ?? summary?.units ?? {};
  const selfPosition = leaderboard.items.find((item) => item.is_self)?.position ?? null;

  return (
    <View nativeID="dashboard-trainer" testID="dashboard-trainer">
      <PaletteSwitch
        comparisons={comparisons.series}
        granularity={granularity}
        id="dashboard-trainer-palette"
        kind={kind}
        onGranularityChange={onGranularityChange}
        summary={summary}
        timeseries={timeseries}
      />

      {palette.case !== PALETTE_CASES.withoutTarget ? (
        <ChartCard
          icon="radar"
          id="dashboard-trainer-radar-card"
          subtitle="Cada eje muestra su valor real al lado: el área del radar es un resumen, no el dato."
          title="Perfil del equipo en cinco ejes"
        >
          <RadarChart id="dashboard-trainer-radar" summary={summary} units={summary?.units} />
        </ChartCard>
      ) : null}

      <LeaderboardTable
        hasMore={leaderboard.hasMore}
        items={leaderboard.items}
        loadingMore={leaderboard.loadingMore}
        onLoadMore={leaderboard.loadMore}
        onSort={toggleSort}
        order={leaderboard.order}
        selfPosition={selfPosition}
        sort={leaderboard.sort}
        total={leaderboard.total}
        units={units}
      />

      <ComparisonStrip data={periods.data} rangeLabel={rangeCaption(from, to)} />
    </View>
  );
}

function describeScope(filtersData, selectedExercise, kind) {
  const parts = [];
  if (kind) parts.push(formatKind(kind));
  if (selectedExercise) parts.push(selectedExercise.name);
  if (!parts.length) parts.push('Todo el equipo');
  return parts.join(' · ');
}

// `from`/`to` ya están en 'DD/MM/YYYY' (lo que emite DateField) y el backend los
// normaliza a ISO en el borde de la request (services/dashboard.js), así que acá
// se muestran tal cual.
function rangeCaption(from, to) {
  if (!from || !to) return '';
  return `${from} → ${to} contra el período anterior de la misma longitud`;
}
