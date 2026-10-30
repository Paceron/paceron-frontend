import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { DashboardLoadingOverlay } from '../dashboard/dashboard-loading-overlay.jsx';
import { KpiTile } from '../dashboard/kpi-tile.jsx';
import { KpiTooltip } from '../dashboard/kpi-tooltip.jsx';
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
//
// Cada métrica es una card reutilizada del dashboard (KpiTile + KpiTooltip):
// mismo tamaño de fuentes, misma interacción de tooltip por hover/foco/tap y la
// misma semántica de "el número se explica con su fórmula". La grilla es de 2
// columnas en mobile y 3 en desktop; `openTooltip` sube la celda (y la grilla)
// para que el bubble no quede debajo de la card vecina, igual que la paleta del
// dashboard.
export function RunnerKpisCard() {
  const [referenceDate] = useState(todayISODate);
  const [period, setPeriod] = useState('month');
  const [tab, setTab] = useState('general');
  const [openTooltip, setOpenTooltip] = useState(null);

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
  // La cantidad de cards manda en desktop: 4 van 2×2 (sin dejar una huérfana en
  // una segunda fila), 3 van en una línea y 5/6 quedan 3+2/3. En mobile siempre
  // son 2 columnas: con 3, los valores como "10,8 km/h" no entran.
  const desktopColumns = rows.length === 4 ? 2 : 3;
  const cellClass = desktopColumns === 2 ? 'w-1/2 p-1' : 'w-1/2 p-1 lg:w-1/3';
  const metrics = data?.metrics ?? null;
  const emptyPeriod = Boolean(data) && data.has_data === false;
  const resolvedError = failed ? resolveDashboardError(error) : null;
  const showRefreshing = refreshing && !loading && Boolean(data) && !failed;
  // Contexto de la pestaña para el tooltip: cuántas series entraron al cálculo y
  // cuántas sesiones distintas las aportaron. Con el período vacío no se
  // muestran: "Series usadas: 0" se leería como un resultado, no como ausencia.
  const tooltipMeta = data && !emptyPeriod
    ? [`Series usadas: ${data.valid_series}`, `Sesiones: ${data.sessions}`]
    : [];

  // Algunas cards tienen un detalle que no merece card propia: la fecha del
  // mejor día vive en el tooltip de "Mayor distancia en un día". Se formatea con
  // el mismo helper y se omite si el backend no la devolvió.
  const rowTooltipMeta = (row) => {
    const detailValue = row.detail && !emptyPeriod ? metrics?.[row.detail.field] : null;
    if (!row.detail || detailValue === null || detailValue === undefined || detailValue === '') {
      return tooltipMeta;
    }
    return [
      `${row.detail.label}: ${formatRunnerKpiValue(row.detail.field, detailValue)}`,
      ...tooltipMeta,
    ];
  };

  // Sin `overflow-hidden`: los tooltips de las cards se dibujan fuera de la
  // tarjeta y quedarían recortados. El overlay de carga compensa con su propio
  // `rounded-2xl` (ver `DashboardLoadingOverlay`).
  return (
    <View
      className="relative mt-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface"
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
            className="-mx-1 -my-1 mt-2 flex-row flex-wrap"
            nativeID="runner-kpis-cards"
            style={{ position: 'relative', zIndex: openTooltip ? 1 : 0 }}
            testID="runner-kpis-cards"
          >
            {rows.map((row) => {
              const cardID = `runner-kpis-${row.field}`;
              const value = metrics && !emptyPeriod ? formatRunnerKpiValue(row.field, metrics[row.field]) : EMPTY_METRIC;

              return (
                // La celda sube para que el bubble del tooltip no quede debajo
                // de la card hermana que se pinta después (misma razón que en
                // la paleta del dashboard: cada View de react-native-web es un
                // stacking context propio).
                <View
                  className={cellClass}
                  key={row.field}
                  nativeID={`${cardID}-cell`}
                  style={{ zIndex: openTooltip === row.field ? 1 : 0 }}
                  testID={`${cardID}-cell`}
                >
                  <KpiTooltip
                    formula={row.formula}
                    id={cardID}
                    meta={rowTooltipMeta(row)}
                    onOpenChange={(open) =>
                      setOpenTooltip((current) => (open ? row.field : current === row.field ? null : current))
                    }
                    showSeries={false}
                    showTolerance={false}
                    valueLabel={value}
                  >
                    {(hovered) => (
                      <KpiTile
                        formattedValue={value}
                        hovered={hovered}
                        icon={row.icon}
                        id={`${cardID}-tile`}
                        label={row.label}
                        labelNumberOfLines={2}
                      />
                    )}
                  </KpiTooltip>
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
