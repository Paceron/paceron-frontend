import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { BAND_LABELS, DASHBOARD_BANDS, stackedBar100 } from '../../../utils/dashboard-chart.js';
import { useThemeColors } from '../../../theme/colors.js';
import { BandLegend, ChartSurface } from './chart-surface.jsx';
import { StackedBarHotspots, StackedBarTooltip } from './stacked-bar-tooltip.jsx';

const LABEL_H = 18;

// Barras apiladas al 100 %: una columna por bucket con las cuatro bandas de
// cumplimiento.
//
// Las bandas llegan CALCULADAS del backend (`band_counts` por bucket, `band` por
// serie) y el front no recalcula nada: los umbrales de `near` y el signo
// invertido del eje temporal viven en domains/dashboard/band.go del backend, y
// duplicarlos acá es la vía directa a que el gráfico y el KPI de cumplimiento se
// contradigan sin que nada falle. Con `has_target: false` las cuatro llegan en
// cero y la columna queda vacía — que es lo honesto: sin objetivo no hay banda.
const BAND_TONES = {
  met: '#8cc63e',
  near: '#f59e0b',
  missed: '#ba1a1a',
  unknown: '#8b949e',
};

const BAND_DOT_CLASSES = {
  met: 'bg-[#8cc63e]',
  near: 'bg-[#f59e0b]',
  missed: 'bg-[#ba1a1a]',
  unknown: 'bg-slate-400',
};

export function StackedBarChart({ id, height = 170, buckets = [], label, emptyMessage = 'Sin series en el período' }) {
  const colors = useThemeColors();
  const [active, setActive] = useState(null);
  const totals = DASHBOARD_BANDS.reduce((acc, band) => {
    acc[band] = buckets.reduce((sum, bucket) => sum + (Number(bucket?.counts?.[band]) || 0), 0);
    return acc;
  }, {});
  const hasAny = buckets.some((bucket) => DASHBOARD_BANDS.some((band) => (Number(bucket?.counts?.[band]) || 0) > 0));

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      <ChartSurface height={height} id={id} label={label}>
        {(width) => {
          const plotHeight = height - LABEL_H;
          const columns = stackedBar100(
            buckets.map((bucket) => bucket?.counts ?? {}),
            { width, height: plotHeight, gap: 4 },
          );

          return (
            <View
              // `relative` ancla el overlay de hotspots y tooltip.
              style={{ position: 'relative' }}
              nativeID={`${id}-plot`}
              testID={`${id}-plot`}
            >
              <Svg height={plotHeight} nativeID={`${id}-svg`} testID={`${id}-svg`} width={width}>
                <Line width={width} x1={0} x2={width} y1={0} y2={0} stroke={colors.outlineVariant} nativeID={`${id}-baseline`} testID={`${id}-baseline`} />
                {columns.map((column, columnIndex) =>
                  column.parts.map((part, partIndex) => (
                    <Rect
                      fill={BAND_TONES[part.band] ?? colors.outlineVariant}
                      height={Math.max(part.height, 0)}
                      key={`${columnIndex}-${part.band}-${partIndex}`}
                      nativeID={`${id}-bucket-${columnIndex}-${part.band}`}
                      testID={`${id}-bucket-${columnIndex}-${part.band}`}
                      width={column.width}
                      x={column.x}
                      y={part.y}
                    />
                  )),
                )}
                {columns.map((column, columnIndex) =>
                  // Con muchas columnas las etiquetas se pisarían: solo se rotula
                  // la primera y la última, que son las dos que ancla el rango.
                  columnIndex === 0 || columnIndex === columns.length - 1 ? (
                    <SvgText
                      fill={colors.onSurfaceVariant}
                      fontSize={10}
                      key={`label-${columnIndex}`}
                      nativeID={`${id}-label-${columnIndex}`}
                      testID={`${id}-label-${columnIndex}`}
                      textAnchor="middle"
                      x={column.x + column.width / 2}
                      y={plotHeight + 12}
                    >
                      {buckets[columnIndex]?.label ?? ''}
                    </SvgText>
                  ) : null,
                )}
              </Svg>
              {hasAny ? (
                <>
                  <StackedBarHotspots
                    active={active}
                    columns={columns}
                    id={id}
                    onActive={(columnIndex, band) => setActive({ columnIndex, band })}
                    onDeactivate={() => setActive(null)}
                    plotHeight={plotHeight}
                    width={width}
                  />
                  {active ? (
                    <StackedBarTooltip
                      active={active}
                      buckets={buckets}
                      columns={columns}
                      id={id}
                      width={width}
                    />
                  ) : null}
                </>
              ) : null}
            </View>
          );
        }}
      </ChartSurface>
      {!hasAny ? (
        <Text className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-empty`} testID={`${id}-empty`}>
          {emptyMessage}
        </Text>
      ) : null}
      <BandLegend
        id={`${id}-legend`}
        items={DASHBOARD_BANDS.map((band) => ({
          id: band,
          label: BAND_LABELS[band] ?? band,
          count: totals[band],
          dotClass: BAND_DOT_CLASSES[band],
        }))}
      />
    </View>
  );
}