import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { DashboardLoadingOverlay } from '../dashboard/dashboard-loading-overlay.jsx';
import { useRunnerKpis } from '../../hooks/use-runner-kpis.js';
import { isWeb } from '../../utils/platform.js';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';
import { EMPTY_METRIC } from '../../utils/dashboard-format.js';
import {
  PERIOD_OPTIONS,
  RUNNER_KPI_ROWS,
  RUNNER_KPI_TABS,
  buildPeriodTitle,
  formatRunnerKpiValue,
} from '../../utils/runner-kpis.js';

const PERIOD_ICONS = {
  month: 'calendar-month',
  week: 'calendar-week',
  day: 'calendar-today',
};

const TAB_ICONS = {
  general: 'format-list-bulleted',
  ritmo_continuo: 'run-fast',
  velocidad_tiempo: 'timer-outline',
  velocidad_distancia: 'speedometer',
};

// Fecha local del dispositivo en ISO. Se calcula una sola vez al montar: si el
// Home cruza la medianoche, el período cambia recién en el próximo montaje o
// refresh (design.md D3), a propósito, sin un timer que nadie necesita.
function todayISODate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Tarjeta aditiva del Home del corredor. Consume una pestaña por vez: el estado
// local elige período y tab, y la query key los incluye a los dos. No hay
// prefetch ni sondeo, y no se usa `keepPreviousData` para no mostrar los
// números de otra pestaña mientras llega la nueva.
export function RunnerKpisCard() {
  const [referenceDate] = useState(todayISODate);
  const [period, setPeriod] = useState('month');
  const [tab, setTab] = useState('general');

  const { data, loading, refreshing, failed, error, refetch } = useRunnerKpis({ period, referenceDate, tab });

  const periodLabel = PERIOD_OPTIONS.find((option) => option.period === period)?.label ?? '';
  const title = data
    ? buildPeriodTitle({
      period,
      from: data.from,
      to: data.to,
      daysConsidered: data.days_considered,
    })
    : periodLabel;

  const periodTabs = PERIOD_OPTIONS.map((option) => ({
    id: option.period,
    label: option.label,
    icon: PERIOD_ICONS[option.period],
  }));
  const metricTabs = RUNNER_KPI_TABS.map((option) => ({
    id: option.tab,
    label: option.label,
    icon: TAB_ICONS[option.tab],
  }));

  // Cada selección ejecuta su consulta: si la pestaña ya era la activa, no hay
  // cambio de key y hace falta el refetch explícito (design.md D4).
  const handleTabChange = (nextTab) => {
    if (nextTab === tab) {
      refetch();
      return;
    }
    setTab(nextTab);
  };

  const handlePeriodChange = (nextPeriod) => {
    if (nextPeriod !== period) setPeriod(nextPeriod);
  };

  const rows = RUNNER_KPI_ROWS[tab] ?? RUNNER_KPI_ROWS.general;
  const metrics = data?.metrics ?? null;
  const emptyPeriod = Boolean(data) && data.has_data === false;
  const resolvedError = failed ? resolveDashboardError(error) : null;
  const showRefreshing = refreshing && !loading && Boolean(data) && !failed;

  return (
    <View
      className="relative mt-3 overflow-hidden rounded-2xl bg-white p-4 shadow-sm dark:bg-surface"
      nativeID="runner-kpis-card"
      testID="runner-kpis-card"
    >
      <View className="gap-3" nativeID="runner-kpis-header" testID="runner-kpis-header">
        <View className="min-w-0 flex-1" nativeID="runner-kpis-header-text" testID="runner-kpis-header-text">
          <Text
            className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
            nativeID="runner-kpis-kicker"
            testID="runner-kpis-kicker"
          >
            Tus números
          </Text>
          <Text
            className="mt-1 text-lg font-bold text-slate-900 dark:text-white"
            nativeID="runner-kpis-title"
            testID="runner-kpis-title"
          >
            {title}
          </Text>
          {showRefreshing ? (
            <Text
              accessibilityLiveRegion="polite"
              className="mt-1 text-xs text-slate-500 dark:text-slate-400"
              nativeID="runner-kpis-refreshing"
              testID="runner-kpis-refreshing"
            >
              Actualizando…
            </Text>
          ) : null}
        </View>

        <View nativeID="runner-kpis-period-selector" testID="runner-kpis-period-selector">
          <TabBar
            active={period}
            onChange={handlePeriodChange}
            scope="runner-kpis-period"
            tabs={periodTabs}
            wrapClassName="flex-row flex-wrap gap-1"
          />
        </View>
      </View>

      <TabBar
        active={tab}
        onChange={handleTabChange}
        scope="runner-kpis-tabs"
        tabs={metricTabs}
        wrapClassName="mt-1 flex-row flex-wrap gap-1.5"
      />

      <View
        nativeID="runner-kpis-content"
        role={isWeb ? 'tabpanel' : undefined}
        testID="runner-kpis-content"
      >
        {resolvedError ? (
          <View
            className="mt-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20"
            nativeID="runner-kpis-error"
            testID="runner-kpis-error"
          >
            <Text
              className="text-sm font-semibold text-red-800 dark:text-red-300"
              nativeID="runner-kpis-error-title"
              testID="runner-kpis-error-title"
            >
              No pudimos cargar tus números
            </Text>
            <Text
              className="mt-1 text-sm leading-5 text-red-700 dark:text-red-300"
              nativeID="runner-kpis-error-message"
              testID="runner-kpis-error-message"
            >
              {resolvedError.message}
            </Text>
            {resolvedError.retryable ? (
              <Pressable
                accessibilityRole="button"
                className="mt-3 h-11 flex-row items-center justify-center self-start rounded-full bg-primary px-5 active:opacity-80"
                nativeID="runner-kpis-retry"
                onPress={() => refetch()}
                testID="runner-kpis-retry"
              >
                <Text
                  className="text-sm font-semibold text-[#111518]"
                  nativeID="runner-kpis-retry-label"
                  testID="runner-kpis-retry-label"
                >
                  Reintentar
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View
            className="mt-2"
            nativeID="runner-kpis-table"
            role={isWeb ? 'table' : undefined}
            testID="runner-kpis-table"
          >
            {rows.map((row, index) => {
              const rowID = `runner-kpis-row-${row.field}`;
              const value = metrics && !emptyPeriod ? formatRunnerKpiValue(row.field, metrics[row.field]) : EMPTY_METRIC;
              const border = index < rows.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : '';

              // En web la tabla expone row/cell reales. En nativo esos roles no
              // existen en el delegate de Android: la fila se anuncia como un
              // solo nodo con label y valor juntos.
              if (isWeb) {
                return (
                  <View
                    className={`flex-row items-start justify-between gap-4 py-2 ${border}`}
                    key={row.field}
                    nativeID={rowID}
                    role="row"
                    testID={rowID}
                  >
                    <Text
                      className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300"
                      nativeID={`${rowID}-label`}
                      role="cell"
                      testID={`${rowID}-label`}
                    >
                      {row.label}
                    </Text>
                    <Text
                      className="text-right text-sm font-semibold text-slate-900 dark:text-white"
                      nativeID={`${rowID}-value`}
                      role="cell"
                      testID={`${rowID}-value`}
                    >
                      {value}
                    </Text>
                  </View>
                );
              }

              return (
                <View
                  accessible
                  accessibilityLabel={`${row.label}: ${value}`}
                  accessibilityRole="text"
                  className={`flex-row items-start justify-between gap-4 py-2 ${border}`}
                  key={row.field}
                  nativeID={rowID}
                  testID={rowID}
                >
                  <Text
                    className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300"
                    nativeID={`${rowID}-label`}
                    testID={`${rowID}-label`}
                  >
                    {row.label}
                  </Text>
                  <Text
                    className="text-right text-sm font-semibold text-slate-900 dark:text-white"
                    nativeID={`${rowID}-value`}
                    testID={`${rowID}-value`}
                  >
                    {value}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {!resolvedError && data && !data.has_data ? (
          <Text
            className="mt-3 text-xs text-slate-500 dark:text-slate-400"
            nativeID="runner-kpis-empty"
            testID="runner-kpis-empty"
          >
            Sin datos en este período.
          </Text>
        ) : null}
      </View>

      <DashboardLoadingOverlay visible={loading} />
    </View>
  );
}
