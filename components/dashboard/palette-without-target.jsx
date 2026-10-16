import { Text, View } from 'react-native';
import { EMPTY_METRIC, formatDelta, formatMetric, hasMetric } from '../../utils/dashboard-format.js';
import { describePalette, resolveRankingMetric, toRankingItems } from '../../utils/dashboard-palette.js';
import { ChartCard } from './charts/chart-surface.jsx';
import { BarChart } from './charts/bar-chart.jsx';
import { DotPlot } from './charts/dot-plot.jsx';
import { LineChart } from './charts/line-chart.jsx';
import { GranularitySelect } from './granularity-select.jsx';
import { KpiTile } from './kpi-tile.jsx';

// Paleta B: NO hay objetivo cargado. El mejor tiempo es el número grande, y
// alrededor van la dispersión de las marcas y la evolución de la mejor marca.
//
// Acá NO se pintan delta, cumplimiento ni ritmo esperado — la spec lo pide
// explícitamente: mostrarlos sería mostrar un cero como si fuera un resultado.
// El `has_target: false` puede venir de un tipo sin objetivo, de una fila previa
// a la migración de tipos o de un ejercicio que el entrenador dejó incompleto, y
// la decisión se toma por el dato, no por el tipo.
export function PaletteWithoutTarget({ id, summary, timeseries, seriesSamples = null, comparisons = null, granularity, onGranularityChange }) {
  const palette = describePalette(summary);
  const rankingMetric = resolveRankingMetric(palette.case);
  const rankingItems = comparisons ? toRankingItems(comparisons, rankingMetric) : null;
  const units = summary?.units ?? {};
  const totals = summary?.totals ?? {};
  const primary = palette.primary;
  const buckets = timeseries?.buckets ?? [];
  const bestBuckets = buckets.map((bucket) => ({ label: bucket.period_start, value: bucket.best_time_ms }));

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      <View className="mb-4" nativeID={`${id}-headline`} testID={`${id}-headline`}>
        <Text className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${id}-primary-label`} testID={`${id}-primary-label`}>
          {primary.label}
        </Text>
        <Text className="text-3xl font-bold text-slate-900 dark:text-white" nativeID={`${id}-primary-value`} testID={`${id}-primary-value`}>
          {hasMetric(primary.value) ? formatMetric(primary.value, primary.unit) : EMPTY_METRIC}
        </Text>
      </View>

      <View className="mb-4 flex-row gap-2" nativeID={`${id}-kpis`} testID={`${id}-kpis`}>
        {[
          { key: 'sessions', label: 'Entrenamientos', value: totals.sessions, icon: 'calendar-check-outline' },
          { key: 'series', label: 'Series', value: totals.series, icon: 'format-list-numbered' },
          { key: 'volume', label: 'Volumen', value: totals.distance_m, unit: units.distance, icon: 'map-marker-distance' },
          { key: 'time', label: 'Tiempo total', value: totals.time_ms, unit: units.time, icon: 'timer-outline' },
        ].map((kpi) => (
          <KpiTile
            icon={kpi.icon}
            id={`${id}-kpi-${kpi.key}`}
            key={kpi.key}
            label={kpi.label}
            unit={kpi.unit}
            value={kpi.value}
          />
        ))}
      </View>

      <ChartCard
        id={`${id}-evolution-card`}
        action={onGranularityChange ? (
          <GranularitySelect enabled={Boolean(timeseries)} id={`${id}-granularity`} onChange={onGranularityChange} value={granularity} />
        ) : null}
        icon="chart-line"
        subtitle="Sin objetivo no hay línea de referencia: se muestra la mejor marca de cada período."
        title="Evolución de la mejor marca"
      >
        <LineChart
          formatX={shortLabel}
          id={`${id}-line`}
          label={`Evolución de la mejor marca en ${bestBuckets.length} ${bestBuckets.length === 1 ? 'período' : 'períodos'}`}
          primary={bestBuckets}
          unit={units.best_time}
        />
      </ChartCard>

      {seriesSamples && seriesSamples.length > 1 ? (
        <ChartCard id={`${id}-dot-card`} icon="chart-scatter-plot" title="Dispersión de marcas">
          <DotPlot
            id={`${id}-dot`}
            label={`Dispersión de ${seriesSamples.length} marcas medidas`}
            pointLabel="Cada punto es una serie registrada."
            xUnit={units.time}
            xCaption="Tiempo (menor es mejor)"
            yUnit={units.speed}
            yCaption="Velocidad"
            points={seriesSamples.map((sample) => ({ x: sample.time_ms, y: sample.speed_kph }))}
          />
        </ChartCard>
      ) : null}

      {rankingItems ? (
        <ChartCard icon="podium" id={`${id}-ranking-card`} subtitle="Orden ascendente: en esta paleta el mejor valor es el menor." title="Ranking del equipo">
          <BarChart
            id={`${id}-ranking`}
            items={rankingItems}
            sort={rankingMetric.sort}
            unit={units[rankingMetric.unitKey]}
          />
        </ChartCard>
      ) : null}

      <Text className="text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${id}-footnote`} testID={`${id}-footnote`}>
        {hasMetric(totals.delta_pct)
          ? `Delta ${formatDelta(totals.delta_pct, units.delta)}.`
          : 'Sin objetivo cargado: no se calculan delta, cumplimiento ni ritmo esperado.'}
      </Text>
    </View>
  );
}

function shortLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match ? `${match[3]}/${match[2]}` : String(value ?? '');
}
