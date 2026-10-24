import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatDelta, formatMetric, hasMetric } from '../../utils/dashboard-format.js';
import { describePalette } from '../../utils/dashboard-palette.js';
import { ChartGrid, ChartGridItem } from './chart-grid.jsx';
import { DotPlot } from './charts/dot-plot.jsx';
import { LineChart } from './charts/line-chart.jsx';
import { GranularitySelect } from './granularity-select.jsx';
import { KpiTile } from './kpi-tile.jsx';
import { KpiTooltip } from './kpi-tooltip.jsx';

// Paleta B: NO hay objetivo cargado. El mejor tiempo es el número grande, y
// alrededor van la dispersión de las marcas y la evolución de la mejor marca.
//
// Acá NO se pintan delta, cumplimiento ni ritmo esperado — la spec lo pide
// explícitamente: mostrarlos sería mostrar un cero como si fuera un resultado.
// El `has_target: false` puede venir de un tipo sin objetivo, de una fila previa
// a la migración de tipos o de un ejercicio que el entrenador dejó incompleto, y
// la decisión se toma por el dato, no por el tipo.
export function PaletteWithoutTarget({ id, summary, timeseries, seriesPoints = null, granularity, onGranularityChange }) {
  const palette = describePalette(summary);
  const units = summary?.units ?? {};
  const totals = summary?.totals ?? {};
  const primary = palette.primary;
  const buckets = timeseries?.buckets ?? [];
  const bestBuckets = buckets.map((bucket) => ({ label: bucket.period_start, value: bucket.best_time_ms }));
  // Mismo criterio que la paleta con objetivo: sube la CELDA abierta (y la fila)
  // porque react-native-web hace stacking context de cada `View` y un z-index
  // alto en el bubble no sale de su celda.
  const [openTooltip, setOpenTooltip] = useState(null);

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      {/* Las SEIS cifras, mismo tamaño, dos filas de tres — igual que la paleta
          con objetivo. En esta paleta no hay velocidad esperada que mostrar, y
          en su lugar aparece la diferencia contra el objetivo: sin objetivo no
          hay contra qué comparar, así que el número que contesta "cuánto me
          falta" es la brecha.

          `relative` + `zIndex`: el tooltip vive acá adentro y la card siguiente
          es su HERMANA, que se pinta después. Sin los dos queda tapado — y en
          web el `z-index` no cuenta si no hay `position`, por eso van juntos. */}
      <View
        className="-mx-1 -my-1 mb-6 flex-row flex-wrap"
        style={{ position: 'relative', zIndex: openTooltip ? 1 : 0 }}
        nativeID={`${id}-kpis`}
        testID={`${id}-kpis`}
      >
        {[
          {
            key: 'best_time',
            label: primary.label,
            value: totals.best_time_ms,
            unit: units.best_time,
            icon: 'timer-outline',
          },
          {
            key: 'volume',
            label: 'Volumen',
            value: totals.distance_m,
            unit: units.distance,
            icon: 'map-marker-distance',
          },
          {
            key: 'sessions',
            label: 'Entrenamientos',
            value: totals.sessions,
            icon: 'calendar-check-outline',
          },
          {
            key: 'series',
            label: 'Series',
            value: totals.series,
            icon: 'format-list-numbered',
          },
          {
            key: 'total_time',
            label: 'Tiempo total',
            value: totals.time_ms,
            unit: units.time,
            icon: 'clock-outline',
          },
          {
            key: 'no_target',
            label: 'Distancia al objetivo',
            // En esta paleta el objetivo no está cargado, así que no hay una
            // "diferencia" calculable: se muestra el guion y el tooltip explica
            // por qué. Un número inventado sería peor que un hueco honesto.
            value: null,
            icon: 'target',
            hint: 'Este ejercicio no tiene objetivo cargado, así que no hay contra qué comparar.',
          },
        ].map((kpi) => (
          <View
            className="w-1/3 p-1"
            key={kpi.key}
            nativeID={`${id}-kpi-cell-${kpi.key}`}
            style={{ zIndex: openTooltip === kpi.key ? 1 : 0 }}
            testID={`${id}-kpi-cell-${kpi.key}`}
          >
          <KpiTooltip
            hint={kpi.hint}
            id={`${id}-kpi-${kpi.key}-tooltip`}
            onOpenChange={(open) =>
              setOpenTooltip((current) => (open ? kpi.key : current === kpi.key ? null : current))
            }
          >
            {(hovered) => (
              <KpiTile
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

      <ChartGrid id={`${id}-chart-grid`} ids={chartGridIds(id, seriesPoints)}>
        <ChartGridItem
          action={onGranularityChange ? (
            <GranularitySelect enabled={Boolean(timeseries)} id={`${id}-granularity`} onChange={onGranularityChange} value={granularity} />
          ) : null}
          description="Mejor marca de cada período (el menor tiempo alcanzado entre las series válidas), agrupada según la granularidad elegida. En esta paleta el ejercicio no tiene objetivo cargado, así que la línea va sola: se lee contra los otros períodos, no contra una referencia."
          icon="chart-line"
          id={`${id}-evolution-card`}
          preview={(
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-evolution-preview`} testID={`${id}-evolution-preview`}>
              {`${formatMetric(totals.best_time_ms, units.best_time)} · ${bestBuckets.length} ${bestBuckets.length === 1 ? 'período' : 'períodos'}`}
            </Text>
          )}
          title="Evolución de la mejor marca"
        >
          <LineChart
            formatX={shortLabel}
            id={`${id}-line`}
            label={`Evolución de la mejor marca en ${bestBuckets.length} ${bestBuckets.length === 1 ? 'período' : 'períodos'}`}
            primary={bestBuckets}
            unit={units.best_time}
          />
        </ChartGridItem>

        {seriesPoints && seriesPoints.length > 1 ? (
          <ChartGridItem
            description="Cada punto es una serie del período: horizontal, el tiempo alcanzado (más a la izquierda, mejor); vertical, la velocidad. Muestra la dispersión y las marcas atípicas que un promedio esconde."
            icon="chart-scatter-plot"
            id={`${id}-dot-card`}
            preview={(
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-dot-preview`} testID={`${id}-dot-preview`}>
                {`${seriesPoints.length} marcas medidas`}
              </Text>
            )}
            title="Dispersión de marcas"
          >
            <DotPlot
              id={`${id}-dot`}
              label={`Dispersión de ${seriesPoints.length} marcas medidas`}
              pointLabel="Cada punto es una serie registrada."
              xUnit={units.time}
              xCaption="Tiempo (menor es mejor)"
              yUnit={units.speed}
              yCaption="Velocidad"
              points={seriesPoints.map((sample) => ({ x: sample.time_ms, y: sample.speed_kph }))}
            />
          </ChartGridItem>
        ) : null}
      </ChartGrid>


      <Text className="text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${id}-footnote`} testID={`${id}-footnote`}>
        {hasMetric(totals.delta_pct)
          ? `Delta ${formatDelta(totals.delta_pct, units.delta)}.`
          : 'Sin objetivo cargado: no se calculan delta, cumplimiento ni ritmo esperado.'}
      </Text>
    </View>
  );
}

// Misma lista que usa la paleta A: el dot plot entra solo cuando hay más de
// una marca, porque con una sola no hay dispersión que dibujar.
function chartGridIds(id, seriesPoints) {
  return [
    `${id}-evolution-card`,
    ...(seriesPoints && seriesPoints.length > 1 ? [`${id}-dot-card`] : []),
  ];
}

function shortLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match ? `${match[3]}/${match[2]}` : String(value ?? '');
}
