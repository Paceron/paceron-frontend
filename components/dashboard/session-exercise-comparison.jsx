import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useDashboardSeries } from '../../hooks/use-dashboard-series.js';
import { useDashboardGroupAthletes, useDashboardSessionComparison } from '../../hooks/use-dashboard-session-comparison.js';
import { DASHBOARD_MAX_PAGE_SIZE } from '../../services/dashboard.js';
import { useThemeColors } from '../../theme/colors.js';
import { formatDelta, formatMetric } from '../../utils/dashboard-format.js';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';
import { defaultDashboardDateRange, resolveDashboardDateRange } from '../../utils/date-field-format.js';
import {
  dashboardSessionExercises,
  buildDashboardSessionOptions,
  reconcileDashboardSessionId,
  updateDashboardSessionSide,
} from '../../utils/dashboard-session-options.js';
import { isSameId } from '../../utils/id-match.js';
import { SearchablePickerField } from '../forms/searchable-picker-field.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DashboardDateField } from './dashboard-date-field.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { DashboardState, StateAction } from './state-shell.jsx';
import { StateError } from './state-error.jsx';
import { StateForbidden } from './state-forbidden.jsx';
import { StateInvalidRequest } from './state-invalid-request.jsx';
import { SessionComparisonChart, SESSION_SIDE_COLORS } from './session-comparison-chart.jsx';

const EMPTY_SIDE = { groupId: '', athleteUserId: '', exerciseId: '', sessionInstanceId: '' };

export function SessionExerciseComparison({
  id = 'dashboard-session-comparison',
  teamId,
  availableDateRange,
  groups = [],
  athletes = [],
  exercises = [],
  isTrainer,
  isNarrow,
  periodComparison = null,
}) {
  const userId = useAuthStore((state) => state.userId);
  const metricExercises = useMemo(() => dashboardSessionExercises(exercises), [exercises]);
  const [comparisonMode, setComparisonMode] = useState('sessions');
  const [comparisonRequested, setComparisonRequested] = useState(false);
  const [athleteMode, setAthleteMode] = useState('same');
  const [sameAthleteId, setSameAthleteId] = useState('');
  const [sideA, setSideA] = useState(EMPTY_SIDE);
  const [sideB, setSideB] = useState(EMPTY_SIDE);
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const seededTeamRef = useRef(null);
  const dateSignature = `${String(teamId ?? '')}|${compareFrom}|${compareTo}`;
  const dateSignatureRef = useRef(dateSignature);
  const dateRangeChanged = dateSignatureRef.current !== dateSignature;
  const compareDateRange = useMemo(
    () => resolveDashboardDateRange({ from: compareFrom, to: compareTo, requireTo: true }),
    [compareFrom, compareTo],
  );
  const seededSameAthleteRef = useRef(false);
  const availableMin = availableDateRange?.min;
  const availableMax = availableDateRange?.max;
  const initialCompareRange = useMemo(
    () => defaultDashboardDateRange({ min: availableMin, max: availableMax }),
    [availableMin, availableMax],
  );
  const defaultGroupId = groups[0]?.id == null ? '' : String(groups[0].id);
  const defaultExerciseId = metricExercises[0]?.id == null ? '' : String(metricExercises[0].id);

  // Primer render con catálogo cargado: ambos lados arrancan en el primer grupo
  // y ejercicio principal. El corredor no elige identidad; siempre se usa el ID
  // del token para las dos referencias.
  useEffect(() => {
    if (!defaultGroupId || !defaultExerciseId) return;
    setSideA((current) => current.groupId ? current : { ...current, groupId: defaultGroupId, exerciseId: defaultExerciseId });
    setSideB((current) => current.groupId ? current : { ...current, groupId: defaultGroupId, exerciseId: defaultExerciseId });
  }, [defaultGroupId, defaultExerciseId]);

  // El comparador se inicializa con el rango real de datos del equipo, pero su
  // estado es propio: editar las fechas del dashboard principal no lo mueve.
  useEffect(() => {
    if (!availableMin || !availableMax) return;
    if (String(seededTeamRef.current) === String(teamId)) return;
    seededTeamRef.current = teamId;
    setCompareFrom(initialCompareRange.from);
    setCompareTo(initialCompareRange.to);
    setComparisonRequested(false);
    setSideA((current) => ({ ...current, sessionInstanceId: '' }));
    setSideB((current) => ({ ...current, sessionInstanceId: '' }));
  }, [teamId, availableMin, availableMax, initialCompareRange]);

  // Cualquier cambio del rango propio invalida ambas sesiones y bloquea el POST
  // en el mismo render. La query de candidatas vuelve a pedir páginas en esas
  // fechas antes de habilitar una comparación nueva.
  useEffect(() => {
    if (!dateRangeChanged) return;
    dateSignatureRef.current = dateSignature;
    setComparisonRequested(false);
    setSideA((current) => ({ ...current, sessionInstanceId: '' }));
    setSideB((current) => ({ ...current, sessionInstanceId: '' }));
  }, [dateRangeChanged, dateSignature]);

  const rosterA = useDashboardGroupAthletes({ teamId, groupId: sideA.groupId, enabled: isTrainer });
  const rosterB = useDashboardGroupAthletes({ teamId, groupId: sideB.groupId, enabled: isTrainer });
  const groupAthletesA = useMemo(
    () => athletesForGroup(athletes, rosterA.athleteIds),
    [athletes, rosterA.athleteIds],
  );
  const groupAthletesB = useMemo(
    () => athletesForGroup(athletes, rosterB.athleteIds),
    [athletes, rosterB.athleteIds],
  );
  const commonAthletes = useMemo(() => {
    const ids = new Set(groupAthletesB.map((athlete) => String(athlete.id)));
    return groupAthletesA.filter((athlete) => ids.has(String(athlete.id)));
  }, [groupAthletesA, groupAthletesB]);

  useEffect(() => {
    if (seededSameAthleteRef.current || !isTrainer || athleteMode !== 'same' || !commonAthletes.length) return;
    seededSameAthleteRef.current = true;
    setSameAthleteId(String(commonAthletes[0].id));
  }, [isTrainer, athleteMode, commonAthletes]);

  // En modo mismo corredor, elegir dos grupos que no comparten roster deja la
  // identidad sin selección, en vez de ofrecer una combinación que terminaría
  // en 403. En modo separado se limpia solo el corredor del lado afectado.
  useEffect(() => {
    if (!isTrainer) return;
    if (athleteMode === 'same') {
      if (sameAthleteId && !rosterA.loading && !rosterB.loading && !rosterA.failed && !rosterB.failed
        && !commonAthletes.some((athlete) => isSameId(athlete.id, sameAthleteId))) {
        setSameAthleteId('');
        setSideA((current) => ({ ...current, sessionInstanceId: '' }));
        setSideB((current) => ({ ...current, sessionInstanceId: '' }));
      }
      return;
    }
    if (sideA.athleteUserId && !rosterA.loading && !rosterA.failed
      && !groupAthletesA.some((athlete) => isSameId(athlete.id, sideA.athleteUserId))) {
      setSideA((current) => ({ ...current, athleteUserId: '', sessionInstanceId: '' }));
    }
    if (sideB.athleteUserId && !rosterB.loading && !rosterB.failed
      && !groupAthletesB.some((athlete) => isSameId(athlete.id, sideB.athleteUserId))) {
      setSideB((current) => ({ ...current, athleteUserId: '', sessionInstanceId: '' }));
    }
  }, [
    isTrainer, athleteMode, sameAthleteId, rosterA.loading, rosterA.failed, rosterB.loading, rosterB.failed,
    commonAthletes, sideA.athleteUserId, sideB.athleteUserId, groupAthletesA, groupAthletesB,
  ]);

  useEffect(() => {
    if (!isTrainer || athleteMode !== 'different') return;
    if (!sideA.athleteUserId && !rosterA.loading && !rosterA.failed && groupAthletesA.length) {
      setSideA((current) => ({ ...current, athleteUserId: String(groupAthletesA[0].id) }));
    }
    if (!sideB.athleteUserId && !rosterB.loading && !rosterB.failed && groupAthletesB.length) {
      setSideB((current) => ({ ...current, athleteUserId: String(groupAthletesB[0].id) }));
    }
  }, [
    isTrainer, athleteMode, sideA.athleteUserId, sideB.athleteUserId,
    rosterA.loading, rosterA.failed, rosterB.loading, rosterB.failed,
    groupAthletesA, groupAthletesB,
  ]);

  const athleteIdA = isTrainer
    ? (athleteMode === 'same' ? sameAthleteId : sideA.athleteUserId)
    : userId;
  const athleteIdB = isTrainer
    ? (athleteMode === 'same' ? sameAthleteId : sideB.athleteUserId)
    : userId;
  const sideAAllowed = !isTrainer || (athleteMode === 'same'
    ? Boolean(sameAthleteId) && commonAthletes.some((athlete) => isSameId(athlete.id, sameAthleteId))
    : Boolean(athleteIdA) && groupAthletesA.some((athlete) => isSameId(athlete.id, athleteIdA)));
  const sideBAllowed = !isTrainer || (athleteMode === 'same'
    ? Boolean(sameAthleteId) && commonAthletes.some((athlete) => isSameId(athlete.id, sameAthleteId))
    : Boolean(athleteIdB) && groupAthletesB.some((athlete) => isSameId(athlete.id, athleteIdB)));

  const requestA = toComparisonRef(sideA, athleteIdA);
  const requestB = toComparisonRef(sideB, athleteIdB);
  const requestComplete = !dateRangeChanged && compareDateRange.valid && Boolean(sideAAllowed && sideBAllowed)
    && isCompleteRef(requestA) && isCompleteRef(requestB);
  const comparison = useDashboardSessionComparison({
    teamId,
    from: compareFrom,
    to: compareTo,
    a: requestA,
    b: requestB,
    enabled: comparisonMode === 'sessions' && comparisonRequested && requestComplete,
  });

  const setSideValue = useCallback((side, key, value) => {
    const setter = side === 'a' ? setSideA : setSideB;
    setComparisonRequested(false);
    setter((current) => updateDashboardSessionSide(current, key, value));
  }, []);

  const changeAthleteMode = useCallback((nextMode) => {
    setAthleteMode(nextMode);
    setComparisonRequested(false);
    setSideA((current) => ({ ...current, athleteUserId: '', sessionInstanceId: '' }));
    setSideB((current) => ({ ...current, athleteUserId: '', sessionInstanceId: '' }));
  }, []);

  const comparisonTabs = [
    { id: 'sessions', label: 'Sesiones A/B', icon: 'compare-horizontal' },
    ...(periodComparison ? [{ id: 'periods', label: 'Períodos', icon: 'calendar-range' }] : []),
  ];
  const currentComparisonMode = comparisonTabs.some((tab) => tab.id === comparisonMode) ? comparisonMode : 'sessions';

  return (
    <View nativeID={id} testID={id}>
      {periodComparison ? (
        <TabBar
          active={currentComparisonMode}
          onChange={setComparisonMode}
          scope={`${id}-mode`}
          tabs={comparisonTabs}
          variant="compact"
        />
      ) : null}

      {currentComparisonMode === 'periods' && periodComparison ? periodComparison : (
        <View nativeID={`${id}-sessions-mode`} testID={`${id}-sessions-mode`}>
          {isTrainer ? (
            <View className="mb-4" nativeID={`${id}-athlete-settings`} testID={`${id}-athlete-settings`}>
              <TabBar
                active={athleteMode}
                onChange={changeAthleteMode}
                scope={`${id}-athlete-mode`}
                tabs={[
                  { id: 'same', label: 'Mismo corredor', icon: 'account-sync-outline' },
                  { id: 'different', label: 'Dos corredores', icon: 'account-multiple-outline' },
                ]}
                variant="compact"
              />
              {athleteMode === 'same' ? (
                <View nativeID={`${id}-same-athlete-control`} testID={`${id}-same-athlete-control`}>
                  <SearchablePickerField
                    idPrefix={`${id}-same-athlete`}
                    label="Corredor de A y B"
                    loading={rosterA.loading || rosterB.loading}
                    onChange={(value) => {
                      setComparisonRequested(false);
                      setSameAthleteId(value == null ? '' : String(value));
                      setSideA((current) => ({ ...current, sessionInstanceId: '' }));
                      setSideB((current) => ({ ...current, sessionInstanceId: '' }));
                    }}
                    options={commonAthletes.map((athlete) => ({ id: athlete.id, name: athleteFullName(athlete) }))}
                    placeholder="Elegí un corredor"
                    value={sameAthleteId}
                  />
                  {!rosterA.loading && !rosterB.loading && !rosterA.failed && !rosterB.failed && !commonAthletes.length ? (
                    <InlineNotice id={`${id}-same-athlete-empty`} message="Elegí grupos que compartan un corredor o compará dos corredores distintos." />
                  ) : null}
                </View>
              ) : null}
              {isTrainer && (rosterA.failed || rosterB.failed) ? (
                <InlineError id={`${id}-roster-error`} error={rosterA.error ?? rosterB.error} onRetry={() => { rosterA.refetch(); rosterB.refetch(); }} />
              ) : null}
            </View>
          ) : null}

          <View className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900" nativeID={`${id}-date-range`} testID={`${id}-date-range`}>
            <Text className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${id}-date-range-title`} testID={`${id}-date-range-title`}>
              Fechas de A y B
            </Text>
            <Text className="mb-3 text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-date-range-hint`} testID={`${id}-date-range-hint`}>
              Este rango es independiente de los filtros principales.
            </Text>
            <View className={isNarrow ? 'gap-1' : 'flex-row gap-3'} nativeID={`${id}-date-range-fields`} testID={`${id}-date-range-fields`}>
              <View className="flex-1" nativeID={`${id}-date-from-slot`} testID={`${id}-date-from-slot`}>
                <DashboardDateField
                  className=""
                  dense
                  disableFutureLimit
                  error={compareDateRange.errors.from}
                  idPrefix={`${id}-date-from`}
                  label="Desde"
                  onChange={(value) => setCompareFrom(value)}
                  value={compareFrom}
                />
              </View>
              <View className="flex-1" nativeID={`${id}-date-to-slot`} testID={`${id}-date-to-slot`}>
                <DashboardDateField
                  className=""
                  dense
                  disableFutureLimit
                  error={compareDateRange.errors.to}
                  idPrefix={`${id}-date-to`}
                  label="Hasta"
                  onChange={(value) => setCompareTo(value)}
                  value={compareTo}
                />
              </View>
            </View>
          </View>

          <View className={isNarrow ? 'gap-3' : 'flex-row items-start gap-3'} nativeID={`${id}-selectors`} testID={`${id}-selectors`}>
            <SessionSideSelector
              athleteId={athleteIdA}
              athleteOptions={groupAthletesA}
              canQuery={sideAAllowed}
              exercises={metricExercises}
              datesValid={compareDateRange.valid && !dateRangeChanged}
              from={compareFrom}
              groupOptions={groups}
              groupRoster={rosterA}
              id={`${id}-side-a`}
              isNarrow={isNarrow}
              isTrainer={isTrainer}
              onChangeAthlete={(value) => setSideValue('a', 'athleteUserId', value)}
              onChangeExercise={(value) => setSideValue('a', 'exerciseId', value)}
              onChangeGroup={(value) => setSideValue('a', 'groupId', value)}
              onChangeSession={(value) => setSideValue('a', 'sessionInstanceId', value)}
              selected={sideA}
              side="a"
              showAthlete={isTrainer && athleteMode === 'different'}
              teamId={teamId}
              to={compareTo}
            />
            <DeltaHero
              data={comparison.data}
              id={`${id}-${isNarrow ? 'narrow' : 'wide'}-delta`}
              units={comparison.data?.units}
            />
            <SessionSideSelector
              athleteId={athleteIdB}
              athleteOptions={groupAthletesB}
              canQuery={sideBAllowed}
              exercises={metricExercises}
              datesValid={compareDateRange.valid && !dateRangeChanged}
              from={compareFrom}
              groupOptions={groups}
              groupRoster={rosterB}
              id={`${id}-side-b`}
              isNarrow={isNarrow}
              isTrainer={isTrainer}
              onChangeAthlete={(value) => setSideValue('b', 'athleteUserId', value)}
              onChangeExercise={(value) => setSideValue('b', 'exerciseId', value)}
              onChangeGroup={(value) => setSideValue('b', 'groupId', value)}
              onChangeSession={(value) => setSideValue('b', 'sessionInstanceId', value)}
              selected={sideB}
              side="b"
              showAthlete={isTrainer && athleteMode === 'different'}
              teamId={teamId}
              to={compareTo}
            />
          </View>

          <View className="mt-3 items-end" nativeID={`${id}-apply-slot`} testID={`${id}-apply-slot`}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !requestComplete || comparison.loading || comparison.fetching }}
              className={`h-11 w-full flex-row items-center justify-center gap-2 rounded-full px-5 active:opacity-80 ${requestComplete && !comparison.loading && !comparison.fetching ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-800'}`}
              disabled={!requestComplete || comparison.loading || comparison.fetching}
              nativeID={`${id}-compare-button`}
              onPress={() => setComparisonRequested(true)}
              testID={`${id}-compare-button`}
            >
              <MaterialCommunityIcons color={requestComplete ? '#111518' : '#64748b'} name="compare-horizontal" size={17} />
              <Text className={`text-sm font-semibold ${requestComplete ? 'text-[#111518]' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${id}-compare-button-label`} testID={`${id}-compare-button-label`}>
                {comparison.loading || comparison.fetching ? 'Comparando sesiones…' : 'Comparar sesiones'}
              </Text>
            </Pressable>
          </View>
          {requestComplete && !comparisonRequested ? (
            <InlineNotice id={`${id}-apply-hint`} message="Completá A y B y presioná “Comparar sesiones” para ver los resultados." />
          ) : null}
          {comparisonRequested && requestComplete && comparison.loading ? <ComparisonLoading id={`${id}-loading`} /> : null}
          {comparisonRequested && comparison.failed ? (
            <InlineError
              id={`${id}-comparison-error`}
              error={comparison.error}
              onClear={() => {
                setSideA((current) => ({ ...current, sessionInstanceId: '' }));
                setSideB((current) => ({ ...current, sessionInstanceId: '' }));
              }}
              onRetry={comparison.refetch}
            />
          ) : null}
          {comparisonRequested && comparison.data ? (
            <SessionComparisonResult data={comparison.data} id={`${id}-result`} isNarrow={isNarrow} />
          ) : null}
        </View>
      )}
    </View>
  );
}

function SessionSideSelector({
  id, side, selected, athleteId, showAthlete, isTrainer, athleteOptions = [], groupOptions = [], exercises = [],
  groupRoster, canQuery, datesValid, teamId, from, to, isNarrow,
  onChangeGroup, onChangeAthlete, onChangeExercise, onChangeSession,
}) {
  const seriesQuery = useDashboardSeries({
    teamId,
    groupId: selected.groupId || null,
    athleteUserId: athleteId || null,
    exerciseId: selected.exerciseId || null,
    from,
    to,
    // Los filtros numéricos del dashboard no forman parte de A/B: la API debe
    // recibir la sesión completa, no solo las series que pasan esos filtros.
    pageSize: DASHBOARD_MAX_PAGE_SIZE,
    enabled: Boolean(canQuery && datesValid && selected.groupId && athleteId && selected.exerciseId && from && to),
  });
  const sessionOptions = useMemo(() => buildDashboardSessionOptions(seriesQuery.series), [seriesQuery.series]);
  const { error, failed, hasMore, loadMore, loading, loadingMore, refetch, refreshing } = seriesQuery;
  const optionsLoading = loading || refreshing || loadingMore || hasMore;

  useEffect(() => {
    if (!hasMore || loadingMore || failed || !canQuery || !datesValid) return;
    loadMore();
  }, [hasMore, loadingMore, failed, loadMore, canQuery, datesValid]);

  useEffect(() => {
    if (!selected.sessionInstanceId || optionsLoading || failed) return;
    const nextSessionId = reconcileDashboardSessionId(sessionOptions, selected.sessionInstanceId);
    if (nextSessionId !== String(selected.sessionInstanceId)) onChangeSession(nextSessionId);
  }, [selected.sessionInstanceId, optionsLoading, failed, sessionOptions, onChangeSession]);

  const groupSelectOptions = groupOptions.map((group) => ({ id: String(group.id), name: group.name }));
  const exerciseSelectOptions = exercises.map((exercise) => ({ id: exercise.id, name: exercise.name, kind: exercise.kind }));
  const hasRosterError = isTrainer && groupRoster.failed;
  const rosterLoading = isTrainer && groupRoster.loading;
  const noExercises = exercises.length === 0;
  const noGroups = groupOptions.length === 0;
  const membershipMessage = isTrainer && selected.groupId && !rosterLoading && !hasRosterError && !athleteOptions.length
    ? 'Este grupo no tiene corredores disponibles para comparar.'
    : null;

  return (
    <View
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface ${isNarrow ? '' : 'flex-1'}`}
      nativeID={id}
      testID={id}
    >
      <View className="mb-4 flex-row items-center gap-2" nativeID={`${id}-header`} testID={`${id}-header`}>
        <View className="h-7 w-7 items-center justify-center rounded-lg" nativeID={`${id}-badge`} style={{ backgroundColor: side === 'a' ? SESSION_SIDE_COLORS.a : SESSION_SIDE_COLORS.b }} testID={`${id}-badge`}>
          <Text className="text-xs font-bold text-[#111518]" nativeID={`${id}-badge-label`} testID={`${id}-badge-label`}>{side.toUpperCase()}</Text>
        </View>
        <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
          Sesión {side.toUpperCase()}
        </Text>
      </View>

      <ResponsiveSelectField
        dense
        disabled={noGroups}
        idPrefix={`${id}-group`}
        label="Grupo"
        onChange={onChangeGroup}
        options={groupSelectOptions}
        placeholder={noGroups ? 'Sin grupos disponibles' : 'Elegí un grupo'}
        value={selected.groupId}
      />

      {showAthlete ? (
        <SearchablePickerField
          dense
          disabled={!selected.groupId || hasRosterError}
          idPrefix={`${id}-athlete`}
          label="Corredor"
          loading={rosterLoading}
          onChange={onChangeAthlete}
          options={athleteOptions.map((athlete) => ({ id: athlete.id, name: athleteFullName(athlete) }))}
          placeholder="Elegí un corredor"
          value={selected.athleteUserId}
        />
      ) : null}

      <SearchablePickerField
        dense
        disabled={noExercises}
        idPrefix={`${id}-exercise`}
        label="Ejercicio principal"
        onChange={onChangeExercise}
        options={exerciseSelectOptions}
        placeholder={noExercises ? 'Sin ejercicios principales' : 'Elegí un ejercicio'}
        renderOptionMeta={(option) => option.kind?.replaceAll('_', ' ')}
        value={selected.exerciseId}
      />

      <SearchablePickerField
        dense
        disabled={!canQuery || !datesValid || optionsLoading || failed}
        emptyMessage="Sin sesiones en estas fechas. Ampliá el rango A/B o elegí otro ejercicio."
        idPrefix={`${id}-session`}
        label="Sesión"
        loading={optionsLoading}
        onChange={onChangeSession}
        options={sessionOptions}
        placeholder={!datesValid ? 'Corregí las fechas' : canQuery ? 'Elegí una sesión' : 'Completá grupo, corredor y ejercicio'}
        renderOptionMeta={(option) => `${option.seriesCount} ${option.seriesCount === 1 ? 'serie' : 'series'}`}
        value={selected.sessionInstanceId}
      />

      {membershipMessage ? <InlineNotice id={`${id}-no-athletes`} message={membershipMessage} tone="muted" /> : null}
      {failed ? <InlineError id={`${id}-sessions-error`} error={error} onRetry={refetch} /> : null}
      {canQuery && datesValid && !optionsLoading && !failed && !sessionOptions.length ? (
        <InlineNotice id={`${id}-sessions-empty`} message="Sin sesiones en estas fechas. Ampliá el rango A/B o elegí otro ejercicio." tone="muted" />
      ) : null}
    </View>
  );
}

function SessionComparisonResult({ id, data, isNarrow }) {
  const sides = isNarrow ? (
    <View className="gap-3" nativeID={`${id}-sides`} testID={`${id}-sides`}>
      <SessionMetricsCard id={`${id}-a`} side="a" data={data.a} units={data.units} />
      <SessionMetricsCard id={`${id}-b`} side="b" data={data.b} units={data.units} />
    </View>
  ) : (
    <View className="flex-row items-stretch gap-3" nativeID={`${id}-sides`} testID={`${id}-sides`}>
      <SessionMetricsCard id={`${id}-a`} side="a" data={data.a} units={data.units} />
      <SessionMetricsCard id={`${id}-b`} side="b" data={data.b} units={data.units} />
    </View>
  );

  return (
    <View className="mt-4 gap-4" nativeID={id} testID={id}>
      {sides}
      <SessionComparisonChart a={data.a} b={data.b} distanceDeltaM={data.delta?.distance_delta_m} id={`${id}-chart`} units={data.units} />
    </View>
  );
}

function SessionMetricsCard({ id, side, data, units }) {
  const accent = SESSION_SIDE_COLORS[side];
  const metadata = [data.group_name, `${data.athlete_name ?? ''} ${data.athlete_surname ?? ''}`.trim(), displayDate(data.session_date), data.exercise_name]
    .filter(Boolean);

  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={id} testID={id}>
      <View className="mb-2 flex-row items-center gap-2" nativeID={`${id}-header`} testID={`${id}-header`}>
        <View className="h-2.5 w-2.5 rounded-full" nativeID={`${id}-marker`} style={{ backgroundColor: accent }} testID={`${id}-marker`} />
        <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
          Ejercicio {side.toUpperCase()}
        </Text>
      </View>
      <Text className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400" nativeID={`${id}-context`} testID={`${id}-context`}>
        {metadata.join(' · ')}
      </Text>
      <View className="flex-row flex-wrap gap-2" nativeID={`${id}-counts`} testID={`${id}-counts`}>
        <CountChip id={`${id}-registered`} label="Registradas" value={data.series_count} />
        <CountChip id={`${id}-valid`} label="Válidas" value={data.valid_series} />
      </View>
      <View className="mt-3 gap-2" nativeID={`${id}-extremes`} testID={`${id}-extremes`}>
        <ExtremeRow id={`${id}-best`} label="Mejor serie" kind={data.kind} point={data.best} units={units} />
        <ExtremeRow id={`${id}-worst`} label="Peor serie" kind={data.kind} point={data.worst} units={units} />
      </View>
      <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-2" nativeID={`${id}-averages`} testID={`${id}-averages`}>
        <MiniMetric id={`${id}-speed`} label="Velocidad media" value={formatMetric(data.mean_speed_kph, units?.speed)} />
        <MiniMetric id={`${id}-distance`} label="Distancia total" value={formatMetric(data.total_distance_m, units?.distance)} />
        <MiniMetric id={`${id}-rpe`} label={`RPE medio · n=${data.rpe_count ?? 0}`} value={data.mean_rpe == null ? '—' : `${formatMetric(data.mean_rpe, '')} / 10`} />
      </View>
    </View>
  );
}

function CountChip({ id, label, value }) {
  return (
    <View className="rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800" nativeID={id} testID={id}>
      <Text className="text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${id}-label`} testID={`${id}-label`}>{label}</Text>
      <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-value`} testID={`${id}-value`}>{value ?? '—'}</Text>
    </View>
  );
}

function ExtremeRow({ id, label, kind, point, units }) {
  const value = formatExtreme(kind, point, units);
  return (
    <View className="flex-row items-center justify-between gap-2" nativeID={id} testID={id}>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-label`} testID={`${id}-label`}>{label}</Text>
      <Text className="text-right text-xs font-semibold text-slate-900 dark:text-white" nativeID={`${id}-value`} testID={`${id}-value`}>{value}</Text>
    </View>
  );
}

function formatExtreme(kind, point, units) {
  if (!point) return '—';
  if (kind === 'ritmo_continuo') {
    const duration = formatMetric(point.active_duration_ms ?? point.duration_ms, units?.duration);
    const distance = formatMetric(point.distance_meters, units?.distance);
    return `${duration} · ${distance}`;
  }
  if (kind === 'velocidad_distancia') return formatMetric(point.speed_kph, units?.speed);
  if (kind === 'velocidad_tiempo') return formatMetric(point.distance_meters, units?.distance);
  return '—';
}

function MiniMetric({ id, label, value }) {
  return (
    <View className="min-w-[92px]" nativeID={id} testID={id}>
      <Text className="text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${id}-label`} testID={`${id}-label`}>{label}</Text>
      <Text className="text-xs font-semibold text-slate-900 dark:text-white" nativeID={`${id}-value`} testID={`${id}-value`}>{value}</Text>
    </View>
  );
}

function DeltaHero({ id, data, units }) {
  const colors = useThemeColors();
  const delta = data?.delta?.speed_delta_kph;
  const deltaPct = data?.delta?.speed_delta_pct;
  const tone = typeof delta !== 'number' ? colors.onSurfaceVariant : delta > 0 ? colors.primary : delta < 0 ? colors.error : colors.onSurfaceVariant;
  return (
    <View className="my-3 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900" nativeID={id} testID={id}>
      <Text className="text-[10px] font-semibold text-slate-500 dark:text-slate-400" nativeID={`${id}-label`} testID={`${id}-label`}>Velocidad · B − A</Text>
      <Text className="mt-1 text-xl font-bold" nativeID={`${id}-value`} style={{ color: tone, fontFamily: 'Orbitron_700Bold' }} testID={`${id}-value`}>
        {formatDelta(delta, units?.speed)}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-percent`} testID={`${id}-percent`}>
        {formatDelta(deltaPct, '%')}
      </Text>
    </View>
  );
}

function ComparisonLoading({ id }) {
  return (
    <View accessibilityLiveRegion="polite" className="mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-slate-50 p-4 dark:bg-slate-900" nativeID={id} testID={id}>
      <ActivityIndicator color="#8cc63e" size="small" />
      <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${id}-label`} testID={`${id}-label`}>Comparando sesiones…</Text>
    </View>
  );
}

function InlineError({ id, error, onRetry, onClear }) {
  const resolved = resolveDashboardError(error);
  if (resolved.kind === 'forbidden') return <StateForbidden id={id} error={error} />;
  if (resolved.kind === 'invalid') return <StateInvalidRequest id={id} error={error} onFix={onClear} />;
  if (resolved.kind === 'not_found') {
    return (
      <DashboardState icon="calendar-remove" id={id} message={resolved.message} title="No encontramos las series de esa sesión" tone="warning">
        {onClear ? <StateAction id={`${id}-clear`} label="Elegir otras sesiones" onPress={onClear} primary /> : null}
      </DashboardState>
    );
  }
  return <StateError error={error} id={id} onRetry={onRetry} />;
}

function InlineNotice({ id, message, tone = 'muted' }) {
  return (
    <View className={`mt-1 rounded-lg px-3 py-2 ${tone === 'danger' ? 'bg-red-50 dark:bg-red-950/20' : 'bg-slate-50 dark:bg-slate-900'}`} nativeID={id} testID={id}>
      <Text className={`text-xs ${tone === 'danger' ? 'text-red-700 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${id}-text`} testID={`${id}-text`}>
        {message}
      </Text>
    </View>
  );
}

function athletesForGroup(athletes, athleteIds) {
  const allowed = new Set((athleteIds ?? []).map(String));
  return (athletes ?? []).filter((athlete) => allowed.has(String(athlete.id)));
}

function athleteFullName(athlete) {
  return `${athlete?.name ?? ''} ${athlete?.surname ?? ''}`.trim() || String(athlete?.id ?? '');
}

function toComparisonRef(side, athleteId) {
  return {
    groupId: side.groupId,
    athleteUserId: athleteId,
    sessionInstanceId: side.sessionInstanceId,
    exerciseId: side.exerciseId,
  };
}

function isCompleteRef(ref) {
  return Object.values(ref).every((value) => value !== null && value !== undefined && value !== '');
}

function displayDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(isoDate ?? '');
}
