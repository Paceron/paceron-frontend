import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
import { useDashboardPeriodComparison } from '../../hooks/use-dashboard-comparisons.js';
import { useDashboardFilters } from '../../hooks/use-dashboard-filters.js';
import { useDashboardLeaderboard } from '../../hooks/use-dashboard-leaderboard.js';
import { useDashboardSeries } from '../../hooks/use-dashboard-series.js';
import { useDashboardSummary } from '../../hooks/use-dashboard-summary.js';
import { useDashboardTimeseries } from '../../hooks/use-dashboard-timeseries.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import {
  DASHBOARD_GRANULARITIES,
  DASHBOARD_LEADERBOARD_SORTS,
  DASHBOARD_MAX_PAGE_SIZE,
  DASHBOARD_ORDERS,
} from '../../services/dashboard.js';
// SIN extensión: en web tiene que cargar `dashboard-capture.web.js`.
import { captureDashboardView } from '../../services/dashboard-capture';
import { canReadPeriodComparison, canReadTeamRanking } from '../../utils/dashboard-capabilities.js';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';
import {
  DEFAULT_TOLERANCE,
  formatDelta,
  formatKind,
  formatMetric,
  hasInsufficientData,
  isLegacyNote,
} from '../../utils/dashboard-format.js';
import { fromISODate, toISODate } from '../../utils/date-field-format.js';
import { availableMetricKinds, exercisesForKind, reconcileExercise } from '../../utils/dashboard-filter-cascade.js';
import { resolveDashboardRange } from '../../utils/dashboard-range.js';
import { ComparisonStrip } from './comparison-strip.jsx';
import { DashboardBody } from './dashboard-body.jsx';
import { DashboardLoadingOverlay } from './dashboard-loading-overlay.jsx';
import { ExportActions } from './export-actions.jsx';
import { FiltersBar } from './filters-bar.jsx';
import { FilterPanel } from '../shared/filter-panel.jsx';
import { LeaderboardTable } from './leaderboard-table.jsx';
import { QualityBanner } from './quality-banner.jsx';
import { StateEmpty } from './state-empty.jsx';
import { StateError } from './state-error.jsx';
import { StateForbidden } from './state-forbidden.jsx';
import { StateInvalidRequest } from './state-invalid-request.jsx';
import { StateNotFound } from './state-not-found.jsx';
import { StateOnboarding } from './state-onboarding.jsx';
import { StateSkeleton } from './state-skeleton.jsx';

// Valor de los filtros sin nada puesto. Se usa para el estado "aplicado" (el
// que alimenta las queries) y como base del reset; las fechas las completa el
// `date_range` real de `/dashboard/filters`.
const EMPTY_FILTERS = {
  groupId: '',
  athleteUserId: '',
  exerciseId: '',
  kind: '',
  distanceFrom: '',
  distanceTo: '',
  timeFrom: '',
  timeTo: '',
  from: '',
  to: '',
};

// Orquestación de la pantalla de rendimiento: estados, filtros y el cuerpo
// compartido por los dos roles.
//
// Las dos variantes NO se distinguen por un flag de visibilidad escondido en un
// mismo árbol: el CUERPO es uno solo (`DashboardBody` — paleta, card de cinco
// ejes y cumplimiento, todo dato del scope que pide la pantalla) y lo que cambia
// por rol son dos secciones que se AGREGAN al final, decididas por capacidad
// (`utils/dashboard-capabilities.js`). Para un corredor no se montan, así que sus
// hooks (leaderboard, comparación por período) ni siquiera se llaman. El backend
// además responde 403 a `/leaderboard` y a `/comparisons*` para quien no es dueño
// del equipo, así que la regla no queda solo en la UI.
//
// El contenedor, el header y los paneles de filtros/calidad están FUERA de la
// región que depende de las métricas: cambiar de rango o de tipo no debe
// desmontarlos (era el parpadeo que se arregló con `keepPreviousData`).
export function DashboardScreen({ teamId }) {
  const isNarrow = useIsNarrowWeb();
  const activeRole = useAuthStore((state) => state.activeRole);
  const isTrainer = activeRole === 'trainer';
  // Región que se rasteriza para el PDF (ver DashboardBody).
  const captureViewRef = useRef(null);

  // Los campos del form son "borrador": escribir no dispara ninguna query. El
  // request sale del estado APLICADO, que solo cambia al presionar "Filtrar"
  // (o "Limpiar", que además resetea). Sin esta separación cada tecla de un
  // rango cambiaba la query key y disparaba las cinco consultas de métricas.
  const [groupId, setGroupId] = useState('');
  const [athleteUserId, setAthleteUserId] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const [kind, setKind] = useState('');
  const [distanceFrom, setDistanceFrom] = useState('');
  const [distanceTo, setDistanceTo] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  // `granularidad`, `sort` y `order` NO son filtros: reconfiguran gráficos que
  // ya están filtrados, así que se aplican al toque (el panel no los muestra).
  const [granularity, setGranularity] = useState(DASHBOARD_GRANULARITIES[0]);
  const [sort, setSort] = useState(DASHBOARD_LEADERBOARD_SORTS[0]);
  const [order, setOrder] = useState(DASHBOARD_ORDERS[0]);
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
    const seeded = { ...EMPTY_FILTERS, from: fromISODate(range.min), to: fromISODate(range.max) };
    setFrom(seeded.from);
    setTo(seeded.to);
    setApplied(seeded);
  }, [filtersData]);

  // Los rangos se escriben en km y minutos, que es lo que se muestra; lo que
  // viaja al request queda en metros y minutos enteros. Un valor escrito a mano
  // que no se puede interpretar, o un rango invertido, NO se aplica: el error
  // va en el campo y el backend nunca llega a responder 400 (spec, rangos).
  // `draftRange` es solo para los errores en vivo; `appliedRange` es lo que
  // efectivamente viaja en el scope de las queries.
  const draftRange = useMemo(
    () => resolveDashboardRange({ distanceFrom, distanceTo, timeFrom, timeTo }),
    [distanceFrom, distanceTo, timeFrom, timeTo],
  );
  const hasRangeErrors = Object.values(draftRange.errors).some(Boolean);
  // "Desde" es obligatorio (sin él el backend responde MISSING_FROM), así que un
  // borrador con la fecha incompleta no se aplica: se deshabilita el botón en vez
  // de entrar al estado de "request inválida".
  const applyDisabled = hasRangeErrors || !toISODate(from);
  const appliedRange = useMemo(() => resolveDashboardRange(applied), [applied]);

  const exerciseOptions = useMemo(() => exercisesForKind(exercises, kind), [exercises, kind]);
  // Un tipo sin ejercicios en el catálogo del equipo no se ofrece: el backend
  // responde 404 para un `kind` que no resuelve a ningún ejercicio del owner.
  const availableKinds = useMemo(() => availableMetricKinds(exercises), [exercises]);

  useEffect(() => {
    if (!filtersData || !kind) return;
    if (availableKinds.includes(kind)) return;
    setKind('');
    setExerciseId(reconcileExercise(exercises, '', exerciseId) ?? '');
  }, [filtersData, availableKinds, exercises, kind, exerciseId]);

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
      groupId: applied.groupId || null,
      athleteUserId: applied.athleteUserId || null,
      exerciseId: applied.exerciseId || null,
      // `kind` y `exercise_id` son excluyentes en el backend
      // (resolveExerciseFilter): con un ejercicio elegido, el tipo ya viene
      // implícito en él y mandarlo sería un 400.
      kind: applied.exerciseId ? null : applied.kind || null,
      distanceFromM: appliedRange.distanceFromM,
      distanceToM: appliedRange.distanceToM,
      timeFromMin: appliedRange.timeFromMin,
      timeToMin: appliedRange.timeToMin,
      from: applied.from,
      to: applied.to,
      tolerance: DEFAULT_TOLERANCE,
    }),
    [teamId, applied, appliedRange],
  );

  // `from` es obligatorio en los cinco GET de métricas (MISSING_FROM es uno de los
  // estados que hay que saber pintar), así que las queries no corren hasta que el
  // rango real existe. Con `enabled: false`, `isPending` sigue en true pero
  // `isFetching` en false, y por eso el `loading` de los hooks queda en false.
  const hasRange = Boolean(applied.from);
  const summaryQuery = useDashboardSummary({ ...scope, enabled: hasRange });
  const timeseriesQuery = useDashboardTimeseries({ ...scope, granularity, enabled: hasRange });

  const summary = summaryQuery.data;
  const timeseries = timeseriesQuery.data;
  const metricsLoading = hasRange && (summaryQuery.loading || timeseriesQuery.loading);
  const metricsError = summaryQuery.failed ? summaryQuery.error : timeseriesQuery.failed ? timeseriesQuery.error : null;

  // Feedback al aplicar: las cinco consultas heredan el resultado anterior
  // (`keepPreviousData`), así que sin esto "Filtrar" no se siente como que hizo
  // algo. La capa aparece solo cuando hay un fetch real en curso (no en el
  // sondeo de 90 s) y se queda un mínimo de 450 ms para que el cambio se
  // registre aunque el backend local responda al instante.
  const [applying, setApplying] = useState(false);
  const applyStartedRef = useRef(false);
  const applyMinUntilRef = useRef(0);
  const metricsFetching = summaryQuery.refreshing || timeseriesQuery.refreshing;

  useEffect(() => {
    if (!applying) return undefined;
    applyStartedRef.current = false;
    // Un click que no cambió el scope no dispara ninguna request: se apaga solo.
    const bail = setTimeout(() => {
      if (!applyStartedRef.current) setApplying(false);
    }, 600);
    return () => clearTimeout(bail);
  }, [applying]);

  useEffect(() => {
    if (!applying) return undefined;
    if (metricsFetching) {
      applyStartedRef.current = true;
      return undefined;
    }
    // Solo se apaga si el fetch llegó a arrancar: el primer render después del
    // click todavía no lo ve, y apagarlo ahí haría que la capa no aparezca nunca.
    if (!applyStartedRef.current) return undefined;
    const remaining = Math.max(0, applyMinUntilRef.current - Date.now());
    const hide = setTimeout(() => setApplying(false), remaining);
    return () => clearTimeout(hide);
  }, [applying, metricsFetching]);

  useEffect(() => {
    if (!applying) return undefined;
    // Red de seguridad: una request que nunca resuelve no puede dejar la capa
    // bloqueando la pantalla para siempre.
    const safety = setTimeout(() => setApplying(false), 15000);
    return () => clearTimeout(safety);
  }, [applying]);
  // Lo que muestra el header/PDF y lo que describe el scope sale de lo APLICADO,
  // no del borrador: si alguien está editando el form sin confirmar, la pantalla
  // sigue describiendo lo que se está viendo.
  const selectedExercise = exercises.find((exercise) => String(exercise.id) === String(applied.exerciseId));
  const effectiveKind = applied.kind || selectedExercise?.kind || null;

  // Detalle serie por serie: es la fuente del box/dot plot y del CSV. Se pide
  // en cuanto hay un ejercicio elegido, NO al presionar exportar: en web la
  // descarga tiene que dispararse en el mismo tick del click, sin un fetch en el
  // medio. Con `page_size` máximo son pocas requests, y las páginas restantes se
  // piden solas — el CSV tiene que incluir TODAS las series, no la primera.
  const seriesQuery = useDashboardSeries({
    ...scope,
    enabled: hasRange && Boolean(applied.exerciseId),
    pageSize: DASHBOARD_MAX_PAGE_SIZE,
  });
  const {
    hasMore: hasMoreSeries,
    loadMore: loadMoreSeries,
    loadingMore: loadingMoreSeries,
    failed: seriesFailed,
  } = seriesQuery;
  const series = seriesQuery.series;

  // Las páginas se encadenan solas hasta cerrar el total. Los dos guards son
  // contra un `loadMore` que no avanza, que en un `useEffect` es un loop de
  // requests: `seriesFailed` ya true cuando falla cualquier página, y una
  // página repetida (un backend que ignorara `page`) también corta.
  const seriesPages = seriesQuery.data?.pages ?? [];
  const lastSeriesPage = seriesPages[seriesPages.length - 1];
  const seriesPageRepeated = seriesPages.some((page) => page !== lastSeriesPage && page?.page === lastSeriesPage?.page);
  useEffect(() => {
    if (!hasMoreSeries || loadingMoreSeries || seriesFailed || seriesPageRepeated) return;
    loadMoreSeries();
  }, [hasMoreSeries, loadingMoreSeries, seriesFailed, seriesPageRepeated, loadMoreSeries]);

  // Las dos formas que consumen las paletas: el box plot quiere solo las
  // velocidades; el dot plot, el par tiempo/velocidad. Se derivan acá (y no en
  // cada paleta) para que un cambio de campo del contrato se corrija en un solo
  // lugar.
  const seriesSamples = useMemo(
    () => series.map((row) => row.speed_kph).filter((value) => Number.isFinite(value)),
    [series]
  );
  const seriesPoints = useMemo(
    () => series
      .filter((row) => Number.isFinite(row.duration_ms) && Number.isFinite(row.speed_kph))
      .map((row) => ({ time_ms: row.duration_ms, speed_kph: row.speed_kph })),
    [series]
  );

  // Modelo del PDF: solo texto ya formateado, para que el builder del documento
  // no conozca ni el contrato de la API ni los formateadores de la pantalla.
  const pdfModel = useMemo(() => {
    if (!summary) return null;
    const units = summary.units ?? {};
    const totals = summary.totals ?? {};
    const group = applied.groupId
      ? (filtersData?.groups ?? []).find((candidate) => String(candidate.id) === String(applied.groupId))
      : null;
    const groupLabel = group?.name ?? (isTrainer ? 'Todo el equipo' : 'Tus series');
    const athlete = applied.athleteUserId
      ? (filtersData?.athletes ?? []).find((candidate) => String(candidate.id) === String(applied.athleteUserId))
      : null;

    // Lista explícita de lo que recorta el documento. Solo lo que está puesto:
    // un "Grupo: Todo el equipo" en "Filtros aplicados" no filtra nada y hace
    // dudar de si hay un filtro activo o no. El período sí va siempre (es
    // obligatorio) porque el PDF circula solo y tiene que decir su alcance.
    const rangeFilter = (fromValue, toValue, unit) => {
      const suffix = unit ? ` ${unit}` : '';
      if (fromValue && toValue) return `${fromValue} – ${toValue}${suffix}`;
      if (fromValue) return `desde ${fromValue}${suffix}`;
      if (toValue) return `hasta ${toValue}${suffix}`;
      return '';
    };
    const filters = [
      athlete ? { label: 'Corredor', value: `${athlete.name} ${athlete.surname ?? ''}`.trim() } : null,
      applied.groupId ? { label: 'Grupo', value: groupLabel } : null,
      selectedExercise ? { label: 'Ejercicio', value: selectedExercise.name } : null,
      !selectedExercise && effectiveKind ? { label: 'Tipo', value: formatKind(effectiveKind) } : null,
      applied.distanceFrom || applied.distanceTo
        ? { label: 'Distancia', value: rangeFilter(applied.distanceFrom, applied.distanceTo, 'km') }
        : null,
      applied.timeFrom || applied.timeTo
        ? { label: 'Duración', value: rangeFilter(applied.timeFrom, applied.timeTo, 'min') }
        : null,
      applied.from || applied.to
        ? { label: 'Período', value: rangeFilter(applied.from, applied.to, '') }
        : null,
    ].filter(Boolean);

    return {
      title: selectedExercise?.name ? `Rendimiento — ${selectedExercise.name}` : 'Rendimiento del período',
      subtitle: describeScope(isTrainer, selectedExercise, effectiveKind),
      filters,
      meta: [
        // Sin ejercicio ni tipo no hay "Ejercicio —": `formatKind(null)` da
        // "—" y una fila con guion no es contexto, es ruido.
        selectedExercise?.name || effectiveKind
          ? { label: 'Ejercicio', value: selectedExercise?.name ?? formatKind(effectiveKind) }
          : null,
        { label: 'Grupo', value: groupLabel },
        { label: 'Rango', value: applied.from && applied.to ? `${applied.from} → ${applied.to}` : '' },
        { label: 'Tolerancia', value: `${Math.round((summary.tolerance_applied ?? DEFAULT_TOLERANCE) * 100)} %` },
      ].filter(Boolean),
      kpis: [
        { label: 'Sesiones', value: String(totals.sessions ?? '—') },
        { label: 'Series válidas', value: String(summary.series_count ?? '—') },
        { label: 'Ritmo promedio', value: formatMetric(totals.achieved_speed_kph, units.speed) },
        { label: 'Velocidad esperada', value: formatMetric(totals.target_speed_kph, units.speed) },
        { label: 'Delta contra objetivo', value: formatDelta(totals.delta_pct, units.delta) },
        { label: 'Cumplimiento', value: formatMetric(totals.compliance_rate, units.compliance) },
        { label: 'Consistencia', value: formatMetric(summary.consistency?.cv) },
        { label: 'Mejor tiempo', value: formatMetric(totals.best_time_ms, units.best_time) },
        { label: 'Distancia total', value: formatMetric(totals.distance_m, units.distance) },
      ],
      series,
      units: seriesQuery.units ?? units,
    };
  }, [summary, selectedExercise, effectiveKind, applied, filtersData, isTrainer, series, seriesQuery.units]);

  // Se pasa como callback (no el ref) para que ExportActions no sepa de
  // `react-native-view-shot` ni de la estructura del dashboard.
  const captureDashboardScreenshot = useCallback(() => captureDashboardView(captureViewRef), []);

  // "Ver todo el período" y "Limpiar" son acciones, no borradores: aplican en el
  // mismo click. Vuelven el rango al `date_range` real del scope y dejan el resto
  // de los filtros vacío.
  const widenRange = useCallback(() => {
    const range = filtersData?.date_range;
    if (!range?.min || !range?.max) return;
    const cleared = { ...EMPTY_FILTERS, from: fromISODate(range.min), to: fromISODate(range.max) };
    setFrom(cleared.from);
    setTo(cleared.to);
    applyMinUntilRef.current = Date.now() + 450;
    setApplying(true);
    setApplied(cleared);
  }, [filtersData]);

  const applyFilters = useCallback(() => {
    // Un rango con error no se aplica (el botón queda deshabilitado): se evita
    // mandar la request con un filtro a medias y que el error "desaparezca" del
    // form sin que el usuario entienda por qué.
    if (hasRangeErrors) return;
    const draft = { groupId, athleteUserId, exerciseId, kind, distanceFrom, distanceTo, timeFrom, timeTo, from, to };
    // Sin cambios no hay request nueva: no se muestra la capa de espera.
    const unchanged = Object.keys(EMPTY_FILTERS).every(
      (key) => String(draft[key] ?? '') === String(applied[key] ?? ''),
    );
    if (unchanged) return;
    applyMinUntilRef.current = Date.now() + 450;
    setApplying(true);
    setApplied(draft);
  }, [
    hasRangeErrors, groupId, athleteUserId, exerciseId, kind,
    distanceFrom, distanceTo, timeFrom, timeTo, from, to, applied,
  ]);

  // Cuántos filtros están APLICADOS: el badge del panel colapsado. `granularity`
  // y `sort` NO cuentan: no son filtros, reconfiguran gráficos que ya están
  // filtrados, y el panel de filtros no los muestra.
  const activeFilterCount = [
    applied.groupId, applied.athleteUserId, applied.kind, applied.exerciseId,
    applied.distanceFrom, applied.distanceTo, applied.timeFrom, applied.timeTo,
    applied.from, applied.to,
  ].filter((value) => value !== '' && value !== null && value !== undefined).length;

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
          {/* Exportar vive en el header y no en el panel de filtros: son
              acciones sobre TODO lo que se ve, no un filtro más. Aparecen
              recién con datos cargados (un botón que exporta un esqueleto no
              existe). */}
          {summary ? (
            <ExportActions
              exerciseName={selectedExercise?.name ?? ''}
              from={applied.from}
              id="dashboard-export"
              onCapture={captureDashboardScreenshot}
              pdfModel={pdfModel}
              preparing={seriesQuery.loading || loadingMoreSeries || hasMoreSeries}
              series={series}
              seriesFailed={seriesFailed}
              units={seriesQuery.units ?? summary.units}
              to={applied.to}
            />
          ) : null}
        </View>

        <ScreenBody
          error={filtersQuery.failed ? filtersQuery.error : null}
          filtersLoading={filtersQuery.loading}
          hasDateRange={Boolean(filtersData?.date_range)}
          isTrainer={isTrainer}
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
            {/* DOS paneles colapsables, no uno (2026-10-17). Hasta esa fecha
                había un solo contenedor "Filtros y calidad" con las dos cosas
                adentro, y encima anidaba una card dentro de otra (la barra de
                filtros traía su propia card y su propio título). Ahora cada cosa
                tiene su card y su chevron, y el badge dice lo suyo.

                El aviso de calidad va arriba porque su contenido explica por qué
                puede no haber nada que filtrar, y no se renderiza si no hay nada
                que avisar (un panel ámbar vacío es ruido). */}
            {hasQualityNotes(summary.data_quality) ? (
              <FilterPanel
                badge={qualityBadge(summary.data_quality)}
                badgeTone={qualityDefects(summary.data_quality) > 0 ? 'warning' : 'muted'}
                icon="alert-outline"
                idPrefix="dashboard-quality-panel"
                label="Calidad de los datos"
                tone="warning"
              >
                <QualityBanner id="dashboard-quality-banner" quality={summary.data_quality} />
              </FilterPanel>
            ) : null}

            {/* Sin `hasActiveFilters`/`onClear`: en el dashboard "Filtrar" y
                "Limpiar" no van en el header del panel sino adentro de la barra,
                al pie del form y junto a las fechas (`FiltersBar`). El panel
                sigue soportando las dos props —las usan las pantallas de
                calendario, que sí lo tienen arriba. */}
            <FilterPanel
              badge={filterBadge(activeFilterCount)}
              contentClassName="mt-3"
              icon="filter-variant"
              idPrefix="dashboard-filters-panel"
              label="Filtros"
              meta={describeScope(isTrainer, selectedExercise, effectiveKind)}
            >
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
                hasActiveFilters={activeFilterCount > 0}
                kind={kind}
                kinds={availableKinds}
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
                onApply={applyFilters}
                onClear={resetFilters}
                applyDisabled={applyDisabled}
                rangeErrors={draftRange.errors}
                showAthlete={isTrainer}
                timeFrom={timeFrom}
                timeTo={timeTo}
                to={to}
              />
            </FilterPanel>

            {/* Un solo cuerpo para los dos roles. Lo que cambia según el rol se
                AGREGA después, y lo decide una capacidad: para un corredor las
                dos secciones no existen (ni sus hooks). */}
            <DashboardBody
              captureRef={captureViewRef}
              granularity={granularity}
              id={isTrainer ? 'dashboard-trainer' : 'dashboard-runner'}
              kind={effectiveKind}
              onGranularityChange={setGranularity}
              seriesPoints={seriesPoints}
              seriesSamples={seriesSamples}
              // Mismo cuerpo, título en primera persona para el corredor: el
              // backend ya recortó el scope a sus series, así que "perfil del
              // equipo" sobre un solo corredor sería mentir.
              radarTitle={isTrainer ? 'Perfil del equipo en cinco ejes' : 'Tu perfil en cinco ejes'}
              summary={summary}
              timeseries={timeseries}
            >
              {canReadTeamRanking(activeRole) ? (
                <TeamRankingSection order={order} scope={scope} sort={sort} summaryUnits={summary?.units} toggleSort={toggleSort} />
              ) : null}
              {canReadPeriodComparison(activeRole) ? (
                <PeriodComparisonSection from={applied.from} scope={scope} to={applied.to} />
              ) : null}
            </DashboardBody>
          </View>
        ) : null}
      </View>
      <DashboardLoadingOverlay visible={applying} />
    </View>
  );
}

// Los siete estados, en el orden en que se evalúan. Vive aparte del componente
// para que la cadena de `return` de la pantalla no quede enterrada en el JSX.
function ScreenBody({
  filtersLoading,
  error,
  hasDateRange,
  isTrainer,
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
  if (!hasDateRange) return <StateOnboarding isTrainer={isTrainer} />;
  if (metricsLoading) return <StateSkeleton />;
  if (metricsError) return <DashboardErrorState error={metricsError} onResetFilters={onResetFilters} />;
  // Sin series en el período el filtro es válido pero no hay nada que mostrar.
  // `series_count` es el de las series VÁLIDAS: un período con filas que no se
  // pueden calcular tampoco tiene indicadores que enseñar.
  if (!seriesCount) return <StateEmpty isTrainer={isTrainer} onWidenRange={onWidenRange} />;
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

// Ranking del equipo. En su propio componente para que el hook —y con él el
// request— exista solo cuando la capacidad lo habilita: no es un `enabled: false`
// colgado de un hook que se llama igual.
function TeamRankingSection({ scope, sort, order, toggleSort, summaryUnits }) {
  const leaderboard = useDashboardLeaderboard({ ...scope, sort, order });
  const units = leaderboard.units ?? summaryUnits ?? {};
  const selfPosition = leaderboard.items.find((item) => item.is_self)?.position ?? null;

  return (
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
  );
}

// Comparación del período actual contra el anterior de la misma longitud. Es
// dato PROPIO del scope (no de otros corredores), pero el endpoint todavía está
// restringido a dueños del equipo: ver `MEMBER_PERIOD_COMPARISON_ENABLED` y
// `docs/BACKEND_API_GAPS.md`. Cuando abra, se prende el flag y esta sección
// aparece también para el corredor sin tocar nada más.
function PeriodComparisonSection({ scope, from, to }) {
  const periods = useDashboardPeriodComparison({ ...scope, current: { from, to } });

  return <ComparisonStrip data={periods.data} rangeLabel={rangeCaption(from, to)} />;
}

// Qué está mirando la pantalla, para el `meta` del panel de filtros. Sin filtros
// el texto depende del rol: el backend ya recorta el scope a las series propias
// de un corredor, así que "Todo el equipo" sobre ese scope es exactamente lo que
// no está mostrando.
function describeScope(isTrainer, selectedExercise, kind) {
  const parts = [];
  if (kind) parts.push(formatKind(kind));
  if (selectedExercise) parts.push(selectedExercise.name);
  if (!parts.length) parts.push(isTrainer ? 'Todo el equipo' : 'Tus series');
  return parts.join(' · ');
}

// `from`/`to` ya están en 'DD/MM/YYYY' (lo que emite DateField) y el backend los
// normaliza a ISO en el borde de la request (services/dashboard.js), así que acá
// se muestran tal cual.
function rangeCaption(from, to) {
  if (!from || !to) return '';
  return `${from} → ${to} contra el período anterior de la misma longitud`;
}

// Los cuatro contadores que son defecto. `legacy_sessions` NO entra: es
// informativo (histórico sin registro de sesión) y se muestra como nota al pie
// del banner, no como advertencia.
const DEFECT_KEYS = ['invalid_series', 'degraded_time', 'unknown_status', 'open_sessions'];

function qualityDefects(quality) {
  if (!quality) return 0;
  return DEFECT_KEYS.reduce((sum, key) => sum + (Number(quality[key]) || 0), 0);
}

// Resumen de cada panel cuando está cerrado: al colapsarlo desaparece el
// contenido, así que el dato que justificaba mirarlo tiene que quedar en el
// badge del header. Cada panel dice lo suyo: el de calidad, cuántos avisos hay;
// el de filtros, cuántos filtros están puestos.
function qualityBadge(quality) {
  const defects = qualityDefects(quality);
  if (defects > 0) return `${defects} ${defects === 1 ? 'aviso' : 'avisos'}`;
  const legacy = Number(quality?.legacy_sessions) || 0;
  if (legacy > 0) return `${legacy} ${legacy === 1 ? 'histórica' : 'históricas'}`;
  return null;
}

function filterBadge(activeFilterCount) {
  if (!activeFilterCount) return null;
  return `${activeFilterCount} ${activeFilterCount === 1 ? 'filtro' : 'filtros'}`;
}

// ¿Hay algo que avisar? Un panel "Calidad de los datos" vacío es ruido: los
// mismos tres casos que hacen que `QualityBanner` no renderice nada.
function hasQualityNotes(quality) {
  return Boolean(quality) && (qualityDefects(quality) > 0 || hasInsufficientData(quality) || isLegacyNote(quality));
}
