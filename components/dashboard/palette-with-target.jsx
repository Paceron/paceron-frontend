import { useState } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BAND_LABELS, DASHBOARD_BANDS } from '../../utils/dashboard-chart.js';
import { EMPTY_METRIC, formatDelta, formatMetric, hasMetric } from '../../utils/dashboard-format.js';
import { describePalette, resolveRankingMetric, toRankingItems } from '../../utils/dashboard-palette.js';
import { useThemeColors } from '../../theme/colors.js';
import { Z_INDEX } from '../../theme/tokens.js';
import { ChartCard } from './charts/chart-surface.jsx';
import { BarChart } from './charts/bar-chart.jsx';
import { BoxPlot } from './charts/box-plot.jsx';
import { BulletChart } from './charts/bullet-chart.jsx';
import { LineChart } from './charts/line-chart.jsx';
import { GranularitySelect } from './granularity-select.jsx';
import { StackedBarChart } from './charts/stacked-bar.jsx';
import { KpiTile } from './kpi-tile.jsx';
import { KpiTooltip } from './kpi-tooltip.jsx';

// Paleta A COMPLETO: hay objetivo de ritmo. Ritmo como número principal, delta
// semántico, cumplimiento, consistencia, evolución y reparto de bandas.
//
// `pacePieces` es lo que separa A completo de A reducido: en false desaparecen el
// gauge y la velocidad esperada, que son las dos piezas que dependen de
// `target_speed_kph`. El resto —cumplimiento, delta, evolución, bandas— es el
// MISMO código en los dos casos: por eso el caso reducido envuelve a este
// componente en vez de duplicar el árbol, que es la vía directa a que las dos
// piezas se desincronicen (design.md D3).
export function PaletteWithTarget({
  id,
  summary,
  timeseries,
  kind,
  pacePieces = true,
  comparisons = null,
  seriesSamples = null,
  granularity,
  onGranularityChange,
}) {
  const colors = useThemeColors();
  // Sube la fila entera mientras haya un tooltip abierto: el de cada KPI vive
  // dentro de la fila y sin esto compite contra la card hermana de abajo.
  const [anyTooltipOpen, setAnyTooltipOpen] = useState(false);
  const palette = describePalette(summary, kind);
  const rankingMetric = resolveRankingMetric(palette.case);
  const rankingItems = comparisons ? toRankingItems(comparisons, rankingMetric) : null;
  const units = summary?.units ?? {};
  const totals = summary?.totals ?? {};
  const primary = palette.primary;
  const buckets = timeseries?.buckets ?? [];
  const speedBuckets = buckets.map((bucket) => ({ label: bucket.period_start, value: bucket.achieved_speed_kph }));
  const targetBuckets = buckets.map((bucket) => ({ label: bucket.period_start, value: bucket.target_speed_kph }));

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      {/* Las SEIS cifras de la pantalla, del mismo tamaño y en dos filas de tres.
          Ritmo promedio y Velocidad esperada son dos tarjetas y no un velocímetro:
          el gauge mostraba exactamente esos dos números en un dial, o sea que la
          unificación de la cifra con el gauge terminó siendo redundante — el
          velocímetro queda afuera y con él un widget entero.

          2×3 y no 6 en fila: el contenedor es `max-w-3xl` (768 px), así que seis
          en fila darían 128 px cada una. Tres por fila dan ~250 px.

          `w-1/3` + `p-1` con márgenes negativos en el padre: los gutters son el
          padding de cada celda y los márgenes negativos lo cancelan, así el
          container mide exacto su ancho sin sumar los gaps.

          `relative` + `zIndex` es lo que saca el tooltip de debajo de la card
          siguiente, que es su HERMANA y se pinta después en el orden del árbol.
          En web el `z-index` solo cuenta si hay `position`, por eso van juntos. */}
      <View
        className="-mx-1 -my-1 flex-row flex-wrap"
        style={{ position: 'relative' }}
        nativeID={`${id}-kpis`}
        testID={`${id}-kpis`}
      >
        {[
          {
            key: 'pace',
            label: 'Ritmo promedio',
            value: totals.achieved_speed_kph,
            unit: units.speed,
            icon: 'speedometer',
          },
          {
            key: 'target_speed',
            label: 'Velocidad esperada',
            value: totals.target_speed_kph,
            unit: units.speed,
            icon: 'target',
            // Sin objetivo no hay contra qué comparar: se muestra "—" con su
            // etiqueta en vez de esconder la tarjeta, para que se entienda que
            // el número existe pero no está cargado.
            hint: hasMetric(totals.target_speed_kph)
              ? 'Velocidad esperada del objetivo congelado de este ejercicio.'
              : 'Este ejercicio no tiene velocidad esperada cargada.',
          },
          {
            key: 'delta',
            label: 'Delta contra objetivo',
            value: totals.delta_pct,
            unit: units.delta,
            icon: 'swap-vertical',
          },
          {
            key: 'compliance',
            label: 'Cumplimiento',
            value: totals.compliance_rate,
            unit: units.compliance,
            icon: 'check-decagram-outline',
          },
          {
            key: 'consistency',
            // La fórmula del cv se indexa por `cv`, que es como se llama el campo
            // en el contrato (`consistency.cv`).
            label: 'Consistencia',
            value: summary?.consistency?.cv,
            icon: 'chart-bell-curve',
          },
          {
            key: 'best_time',
            label: 'Mejor tiempo',
            value: totals.best_time_ms,
            unit: units.best_time,
            icon: 'timer-outline',
          },
        ].map((kpi) => (
          <View className="w-1/3 p-1" key={kpi.key} nativeID={`${id}-kpi-cell-${kpi.key}`} testID={`${id}-kpi-cell-${kpi.key}`}>
          <KpiTooltip
            onOpenChange={setAnyTooltipOpen}
            formula={FORMULAS[kpi.key === 'consistency' ? 'cv' : kpi.key]}
            hint={kpi.hint}
            id={`${id}-kpi-${kpi.key}-tooltip`}
            seriesCount={summary?.series_count ?? null}
            tolerance={summary?.tolerance_applied}
            unit={kpi.unit}
            value={kpi.value}
          >
            {(hovered) => (
              <KpiTile
                delta={kpi.key === 'delta' ? totals.delta_pct : undefined}
                deltaUnit={units.delta}
                hovered={hovered}
                icon={kpi.icon}
                id={`${id}-kpi-${kpi.key}`}
                label={kpi.label}
                unit={kpi.unit}
                value={kpi.value}
              />
            )}
          </KpiTooltip>
          </View>
        ))}
      </View>

      <ChartCard
        id={`${id}-compliance-card`}
        icon="gauge"
        subtitle={hasMetric(summary?.tolerance_applied) ? `Tolerancia aplicada ${Math.round(summary.tolerance_applied * 1000) / 10} %` : undefined}
        title="Cumplimiento del objetivo"
      >
        <BulletChart
          id={`${id}-bullet`}
          label={`Cumplimiento del objetivo: ${formatMetric(totals.compliance_rate, units.compliance)}`}
          target={100}
          unit={units.compliance}
          value={totals.compliance_rate}
        />
      </ChartCard>

      <ChartCard
        action={onGranularityChange ? (
          <GranularitySelect enabled={Boolean(timeseries)} id={`${id}-granularity`} onChange={onGranularityChange} value={granularity} />
        ) : null}
        id={`${id}-evolution-card`}
        icon="chart-line"
        subtitle={pacePieces ? 'Línea continua: ritmo logrado. Línea punteada: velocidad esperada.' : undefined}
        title="Evolución del ritmo"
      >
        <LineChart
          formatX={shortLabel}
          id={`${id}-line`}
          label={`Evolución del ritmo en ${speedBuckets.length} ${speedBuckets.length === 1 ? 'período' : 'períodos'}`}
          primary={speedBuckets}
          secondary={pacePieces ? targetBuckets : []}
          secondaryLabel={pacePieces ? 'La línea punteada es la velocidad esperada del objetivo vigente.' : undefined}
          unit={units.speed}
        />
      </ChartCard>

      {seriesSamples && seriesSamples.length ? (
        <ChartCard id={`${id}-box-card`} icon="chart-bell-curve" title="Distribución del ritmo por serie">
          <BoxPlot
            caption={`La consistencia del KPI sale del coeficiente de variación de la API; esta caja es la geometría de la distribución.`}
            id={`${id}-box`}
            label={`Distribución de ${seriesSamples.length} velocidades medidas`}
            unit={units.speed}
            values={seriesSamples}
          />
        </ChartCard>
      ) : null}

      <ChartCard
        id={`${id}-bands-card`}
        icon="chart-bar"
        subtitle="Las cuatro bandas llegan calculadas por la API; el front no recalcula los umbrales."
        title="Reparto de cumplimiento por período"
      >
        <StackedBarChart
          buckets={buckets.map((bucket) => ({ label: shortLabel(bucket.period_start), counts: bucket.band_counts }))}
          id={`${id}-stacked`}
          label={`Reparto de cumplimiento por período: ${DASHBOARD_BANDS.map((band) => BAND_LABELS[band]).join(', ')}`}
        />
      </ChartCard>

      {rankingItems ? (
        <ChartCard
          icon="podium"
          id={`${id}-ranking-card`}
          subtitle={`Ordenado por ${rankingLabel(rankingMetric.key)}.`}
          title="Ranking del equipo"
        >
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
          ? `Delta ${formatDelta(totals.delta_pct, units.delta)} contra el objetivo (positivo es mejora).`
          : 'Sin objetivo cargado en el período: el delta no se calcula.'}
      </Text>
      {!hasTarget(summary) ? (
        <View className="mt-1 flex-row items-center gap-1" nativeID={`${id}-no-target-note`} testID={`${id}-no-target-note`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="information-outline" size={13} />
          <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-no-target-note-text`} testID={`${id}-no-target-note-text`}>
            El objetivo de este ejercicio no está cargado en el período.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// La fórmula de cada KPI, tal como la calcula el backend. Va en el tooltip y NO
// se recalcula acá: el front no reimplementa ni una fórmula, solo muestra de dónde
// sale el número (spec, "indicar la fuente de cada número"). Los nombres de los
// campos son los del dominio del backend (domains/dashboard/*.go).
const FORMULAS = {
  achieved_speed_kph: 'Velocidad ponderada por distancia: suma(distancia × velocidad) ÷ suma(distancia), sobre las series válidas del período.',
  distance_m: 'Suma de la distancia de las series válidas del período.',
  time_ms: 'Suma del tiempo alcanzado de las series válidas del período.',
  best_time_ms: 'El menor tiempo alcanzado entre las series válidas del período.',
  delta: 'Diferencia contra el objetivo en porcentaje. Positivo es mejora: en el eje temporal el signo viene invertido.',
  compliance_rate: 'Series válidas que cumplen el objetivo según la tolerancia aplicada, sobre las series válidas que tienen objetivo cargado.',
  cv: 'Coeficiente de variación de la velocidad (σ ÷ μ) de las series válidas del período. Sin dato con menos de 2 series.',
};

function rankingLabel(key) {
  return { best_time_ms: 'mejor tiempo', mean_speed_kph: 'ritmo medio', total_distance_m: 'distancia' }[key] ?? key;
}

function hasTarget(summary) {
  return Boolean(summary?.has_target);
}

// 'YYYY-MM-DD' → 'DD/MM': los buckets llegan en ISO y mostrarlos crudos en el eje
//X suma un año de cuatro dígitos a un gráfico que tiene 180 px de ancho.
function shortLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match ? `${match[3]}/${match[2]}` : String(value ?? '');
}
