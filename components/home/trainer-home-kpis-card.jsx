import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TabBar } from '../shared/tab-bar.jsx';
import { DashboardLoadingOverlay } from '../dashboard/dashboard-loading-overlay.jsx';
import { KpiTile } from '../dashboard/kpi-tile.jsx';
import { KpiTooltip } from '../dashboard/kpi-tooltip.jsx';
import { useTrainerHomeKpis } from '../../hooks/use-trainer-home-kpis.js';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';
import { EMPTY_METRIC } from '../../utils/dashboard-format.js';
import {
  TRAINER_HOME_PERIOD_METRICS,
  TRAINER_HOME_PERIOD_OPTIONS,
  TRAINER_HOME_STRUCTURE_METRICS,
  formatTrainerHomeMetric,
  trainerHomePeriodTitle,
} from '../../utils/trainer-home-kpis.js';

const PERIOD_ICONS = { month: 'calendar-month', week: 'calendar-week', day: 'calendar-today' };

function todayISODate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function TrainerHomeKpisCard() {
  const [referenceDate] = useState(todayISODate);
  const [period, setPeriod] = useState('month');
  const [openTooltip, setOpenTooltip] = useState(null);
  const { data, loading, refreshing, failed, error, refetch } = useTrainerHomeKpis({ period, referenceDate });
  const resolvedError = failed ? resolveDashboardError(error) : null;
  const title = data ? trainerHomePeriodTitle(data) : 'Resumen del período';
  const tabs = TRAINER_HOME_PERIOD_OPTIONS.map((option) => ({
    id: option.period,
    label: option.label,
    icon: PERIOD_ICONS[option.period],
  }));

  const renderMetric = (metric, section) => {
    const field = `${section}-${metric.field}`;
    const cardId = `trainer-home-kpis-${field}`;
    const formattedValue = data ? formatTrainerHomeMetric(metric.field, data) : EMPTY_METRIC;
    const meta = metric.field === 'pendingAmount' && data
      ? [`Cuotas pendientes: ${data.collections.pendingCount}`]
      : [];

    return (
      <View
        className="w-1/2 p-1"
        key={field}
        nativeID={`${cardId}-cell`}
        style={{ zIndex: openTooltip === field ? 1 : 0 }}
        testID={`${cardId}-cell`}
      >
        <KpiTooltip
          formula={metric.formula ?? (metric.field === 'activeTeams'
            ? 'Equipos del entrenador que están activos y no fueron eliminados.'
            : 'Corredores activos, contados una sola vez aunque pertenezcan a varios equipos.')}
          id={cardId}
          meta={meta}
          onOpenChange={(open) => setOpenTooltip((current) => (open ? field : current === field ? null : current))}
          showSeries={false}
          showTolerance={false}
          valueLabel={formattedValue}
        >
          {(hovered) => (
            <KpiTile
              formattedValue={formattedValue}
              hovered={hovered}
              icon={metric.icon}
              id={`${cardId}-tile`}
              label={metric.label}
              labelNumberOfLines={metric.field === 'sessions' || metric.field === 'presencialSessions' ? 3 : 2}
            />
          )}
        </KpiTooltip>
      </View>
    );
  };

  return (
    <View
      className="relative mb-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface"
      nativeID="trainer-home-kpis-card"
      style={{ zIndex: openTooltip ? 1 : 0 }}
      testID="trainer-home-kpis-card"
    >
      <View className="mb-2 flex-row items-center gap-2" nativeID="trainer-home-kpis-header" testID="trainer-home-kpis-header">
        <MaterialCommunityIcons color="#8cc63e" name="chart-box-outline" size={18} />
        <Text className="flex-1 text-base font-bold text-slate-900 dark:text-white" nativeID="trainer-home-kpis-heading" testID="trainer-home-kpis-heading">
          Resumen de tus equipos
        </Text>
        {refreshing && data ? (
          <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID="trainer-home-kpis-refreshing" testID="trainer-home-kpis-refreshing">
            Actualizando…
          </Text>
        ) : null}
      </View>

      <Text className="mb-2 text-sm font-semibold text-slate-900 dark:text-white" nativeID="trainer-home-kpis-period-title" testID="trainer-home-kpis-period-title">
        {title}
      </Text>
      <View nativeID="trainer-home-kpis-period-selector" testID="trainer-home-kpis-period-selector">
        <TabBar
          active={period}
          onChange={(nextPeriod) => {
            if (nextPeriod === period) refetch();
            else setPeriod(nextPeriod);
          }}
          scope="trainer-home-kpis-period"
          tabs={tabs}
          wrapClassName="flex-row flex-wrap gap-1"
        />
      </View>

      {resolvedError ? (
        <View className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20" nativeID="trainer-home-kpis-error" testID="trainer-home-kpis-error">
          <Text className="text-sm font-semibold text-red-800 dark:text-red-300" nativeID="trainer-home-kpis-error-title" testID="trainer-home-kpis-error-title">
            No pudimos cargar el resumen
          </Text>
          <Text className="mt-1 text-sm leading-5 text-red-700 dark:text-red-300" nativeID="trainer-home-kpis-error-message" testID="trainer-home-kpis-error-message">
            {resolvedError.message}
          </Text>
          {resolvedError.retryable ? (
            <Pressable accessibilityRole="button" className="mt-3 h-11 items-center justify-center self-start rounded-full bg-primary px-5 active:opacity-80" nativeID="trainer-home-kpis-retry" onPress={() => refetch()} testID="trainer-home-kpis-retry">
              <Text className="text-sm font-semibold text-[#111518]" nativeID="trainer-home-kpis-retry-label" testID="trainer-home-kpis-retry-label">Reintentar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <View
            className="-mx-1 -my-1 mt-2 flex-row flex-wrap"
            nativeID="trainer-home-kpis-period-metrics"
            style={{ position: 'relative', zIndex: openTooltip ? 1 : 0 }}
            testID="trainer-home-kpis-period-metrics"
          >
            {TRAINER_HOME_PERIOD_METRICS.map((metric) => renderMetric(metric, 'period'))}
          </View>

          <View className="mb-1 mt-4 flex-row items-center gap-2" nativeID="trainer-home-kpis-structure-heading-row" testID="trainer-home-kpis-structure-heading-row">
            <MaterialCommunityIcons color="#8cc63e" name="account-multiple-outline" size={15} />
            <Text className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="trainer-home-kpis-structure-heading" testID="trainer-home-kpis-structure-heading">
              Tu estructura actual
            </Text>
          </View>
          <View
            className="-mx-1 -my-1 flex-row flex-wrap"
            nativeID="trainer-home-kpis-structure-metrics"
            style={{ position: 'relative', zIndex: openTooltip ? 1 : 0 }}
            testID="trainer-home-kpis-structure-metrics"
          >
            {TRAINER_HOME_STRUCTURE_METRICS.map((metric) => renderMetric(metric, 'structure'))}
          </View>
        </>
      )}

      <DashboardLoadingOverlay id="trainer-home-kpis-loading" label="Cargando resumen…" visible={loading} />
    </View>
  );
}
