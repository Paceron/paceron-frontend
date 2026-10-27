import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { barPath, dotPoints } from '../../utils/dashboard-chart.js';
import { formatDelta, formatMetric } from '../../utils/dashboard-format.js';
import { buildDashboardComparisonChartPoints } from '../../utils/dashboard-session-options.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { ChartCard, ChartSurface } from './charts/chart-surface.jsx';

export const SESSION_SIDE_COLORS = { a: '#8cc63e', b: '#38bdf8' };

export function SessionComparisonChart({ id = 'dashboard-session-comparison-chart', a, b, distanceDeltaM, units }) {
  const colors = useThemeColors();
  const [selectedKey, setSelectedKey] = useState(null);
  const [hoveredKey, setHoveredKey] = useState(null);
  const points = useMemo(() => buildDashboardComparisonChartPoints(a, b), [a, b]);
  const series = points;
  const hasSpeed = points.some((point) => typeof point.y === 'number' && Number.isFinite(point.y));

  useEffect(() => {
    setSelectedKey(null);
    setHoveredKey(null);
  }, [a?.session_instance_id, a?.exercise_id, b?.session_instance_id, b?.exercise_id]);

  return (
    <View nativeID={id} testID={id}>
      <ChartCard
        description="Cada punto representa la velocidad calculada de una serie. El eje horizontal es el número de serie; A y B usan la misma escala."
        id={`${id}-speed-card`}
        title="Velocidad por serie"
        icon="chart-scatter-plot"
        subtitle="Misma escala para A y B"
      >
        {hasSpeed ? (
          <ChartSurface height={204} id={`${id}-speed`} label="Velocidad por número de serie para A y B">
            {(width) => {
              const left = 34;
              const bottom = 24;
              const plotWidth = Math.max(1, width - left - 8);
              const plotHeight = 156;
              const chart = dotPoints(points, { width: plotWidth, height: plotHeight, minimumRange: 1 });
              const xTicks = chart.xDomain ? [chart.xDomain[0], chart.xDomain[1]] : [];
              const yTicks = chart.yDomain ? [chart.yDomain[0], chart.yDomain[1]] : [];
              const activeKey = hoveredKey ?? selectedKey;
              const activeDot = chart.points.find((dot) => `${dot.item.side}-${dot.item.index}` === activeKey);

              return (
                <View nativeID={`${id}-speed-plot`} style={{ position: 'relative' }} testID={`${id}-speed-plot`}>
                  <Svg height={plotHeight + bottom} nativeID={`${id}-speed-svg`} testID={`${id}-speed-svg`} width={width}>
                    <Line
                      nativeID={`${id}-speed-axis-y`}
                      stroke={colors.outlineVariant}
                      strokeWidth={1}
                      testID={`${id}-speed-axis-y`}
                      x1={left}
                      x2={left}
                      y1={0}
                      y2={plotHeight}
                    />
                    <Line
                      nativeID={`${id}-speed-axis-x`}
                      stroke={colors.outlineVariant}
                      strokeWidth={1}
                      testID={`${id}-speed-axis-x`}
                      x1={left}
                      x2={width - 4}
                      y1={plotHeight}
                      y2={plotHeight}
                    />
                    {yTicks.map((value, index) => {
                      const position = chart.y(value);
                      return (
                        <SvgText
                          fill={colors.onSurfaceVariant}
                          fontSize={9}
                          key={`speed-y-${index}`}
                          nativeID={`${id}-speed-y-${index}`}
                          testID={`${id}-speed-y-${index}`}
                          textAnchor="end"
                          x={left - 5}
                          y={(position ?? 0) + 3}
                        >
                          {formatMetric(value, units?.speed ?? 'km/h')}
                        </SvgText>
                      );
                    })}
                    {xTicks.map((value, index) => {
                      const position = chart.x(value);
                      return (
                        <SvgText
                          fill={colors.onSurfaceVariant}
                          fontSize={9}
                          key={`speed-x-${index}`}
                          nativeID={`${id}-speed-x-${index}`}
                          testID={`${id}-speed-x-${index}`}
                          textAnchor={index === 0 ? 'start' : 'end'}
                          x={left + (position ?? 0)}
                          y={plotHeight + 15}
                        >
                          {formatMetric(value, '')}
                        </SvgText>
                      );
                    })}
                    {chart.points.map((dot) => {
                      const entry = dot.item;
                      const key = `${entry.side}-${entry.index}`;
                      const pointColor = SESSION_SIDE_COLORS[entry.side];
                      const selectedPoint = selectedKey === key || hoveredKey === key;
                      return entry.side === 'a' ? (
                        <Circle
                          cx={left + dot.cx}
                          cy={dot.cy}
                          fill={pointColor}
                          key={key}
                          nativeID={`${id}-point-${key}`}
                          r={selectedPoint ? 6 : 4.5}
                          stroke={colors.surface}
                          strokeWidth={selectedPoint ? 2 : 1}
                          testID={`${id}-point-${key}`}
                        />
                      ) : (
                        <Rect
                          fill={pointColor}
                          height={selectedPoint ? 11 : 9}
                          key={key}
                          nativeID={`${id}-point-${key}`}
                          stroke={colors.surface}
                          strokeWidth={selectedPoint ? 2 : 1}
                          testID={`${id}-point-${key}`}
                          width={selectedPoint ? 11 : 9}
                          x={left + dot.cx - (selectedPoint ? 5.5 : 4.5)}
                          y={dot.cy - (selectedPoint ? 5.5 : 4.5)}
                        />
                      );
                    })}
                  </Svg>
                  <View
                    pointerEvents="box-none"
                    style={{ position: 'absolute', left: 0, top: 0, width, height: plotHeight + bottom }}
                    nativeID={`${id}-speed-hotspots`}
                    testID={`${id}-speed-hotspots`}
                  >
                    {chart.points.map((dot) => {
                      const entry = dot.item;
                      const key = `${entry.side}-${entry.index}`;
                      return (
                        <Pressable
                          accessibilityHint="Muestra los datos de esta serie"
                          accessibilityLabel={`${entry.side.toUpperCase()}, serie ${entry.point.set_number}, ${formatMetric(entry.point.speed_kph, units?.speed ?? 'km/h')}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: selectedKey === key }}
                          key={key}
                          nativeID={`${id}-speed-hotspot-${key}`}
                          onHoverIn={isWeb ? () => setHoveredKey(key) : undefined}
                          onHoverOut={isWeb ? () => setHoveredKey((current) => (current === key ? null : current)) : undefined}
                          onPress={() => setSelectedKey((current) => (current === key ? null : key))}
                          style={{
                            position: 'absolute',
                            left: Math.max(0, Math.min(width - 28, left + dot.cx - 14)),
                            top: Math.max(0, dot.cy - 14),
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                          }}
                          testID={`${id}-speed-hotspot-${key}`}
                        />
                      );
                    })}
                  </View>
                  {activeDot ? (
                    <SpeedPointTooltip
                      entry={activeDot.item}
                      id={`${id}-tooltip`}
                      point={{ x: left + activeDot.cx, y: activeDot.cy, width }}
                      side={activeDot.item.side === 'a' ? a : b}
                      units={units}
                    />
                  ) : null}
                </View>
              );
            }}
          </ChartSurface>
        ) : (
          <Text className="py-8 text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${id}-speed-empty`} testID={`${id}-speed-empty`}>
            No hay velocidad comparable en estas series.
          </Text>
        )}
        <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-2" nativeID={`${id}-speed-legend`} testID={`${id}-speed-legend`}>
          <LegendItem id={`${id}-legend-a`} color={SESSION_SIDE_COLORS.a} label="A" marker="circle" />
          <LegendItem id={`${id}-legend-b`} color={SESSION_SIDE_COLORS.b} label="B" marker="square" />
        </View>
        <View className="mt-2 flex-row flex-wrap gap-2" nativeID={`${id}-point-controls`} testID={`${id}-point-controls`}>
          {series.map((entry) => {
            const key = `${entry.side}-${entry.index}`;
            return (
              <Pressable
                accessibilityLabel={`Ver detalle ${entry.side.toUpperCase()}, serie ${entry.point.set_number}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedKey === key }}
                aria-pressed={selectedKey === key}
                className={`rounded-lg border px-2.5 py-1.5 ${selectedKey === key ? 'border-slate-400 dark:border-slate-500' : 'border-slate-200 dark:border-slate-700'}`}
                key={key}
                nativeID={`${id}-select-${key}`}
                onPress={() => setSelectedKey((current) => (current === key ? null : key))}
                testID={`${id}-select-${key}`}
              >
                <Text className="text-xs text-slate-700 dark:text-slate-200" nativeID={`${id}-select-${key}-label`} testID={`${id}-select-${key}-label`}>
                  {entry.side.toUpperCase()} · {entry.point.set_number}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ChartCard>

      <DistanceComparisonCard delta={distanceDeltaM} id={`${id}-distance`} a={a} b={b} units={units} />
    </View>
  );
}

function LegendItem({ id, color, label, marker }) {
  return (
    <View className="flex-row items-center gap-1.5" nativeID={id} testID={id}>
      {marker === 'circle' ? (
        <View className="h-2.5 w-2.5 rounded-full" nativeID={`${id}-marker`} style={{ backgroundColor: color }} testID={`${id}-marker`} />
      ) : (
        <View className="h-2.5 w-2.5 rounded-[3px]" nativeID={`${id}-marker`} style={{ backgroundColor: color }} testID={`${id}-marker`} />
      )}
      <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${id}-label`} testID={`${id}-label`}>
        {label}
      </Text>
    </View>
  );
}

function SpeedPointTooltip({ id, entry, point, side, units }) {
  const seriesPoint = entry.point;
  const time = seriesPoint.active_duration_ms ?? seriesPoint.duration_ms;
  const flip = point.x > point.width * 0.62;
  return (
    <View
      pointerEvents="none"
      style={{
        alignItems: flip ? 'flex-end' : 'flex-start',
        left: flip ? undefined : point.x + 10,
        position: 'absolute',
        right: flip ? point.width - point.x + 10 : undefined,
        top: Math.max(0, point.y - 72),
        zIndex: 2,
      }}
      nativeID={id}
      testID={id}
    >
      <View className="max-w-[190px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm dark:border-slate-600 dark:bg-surface-2" nativeID={`${id}-box`} testID={`${id}-box`}>
        <Text className="text-[11px] font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
          {entry.side.toUpperCase()} · Serie {seriesPoint.set_number} · {side?.exercise_name ?? ''} · {side?.session_date ?? ''}
        </Text>
        <Text className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300" nativeID={`${id}-details`} testID={`${id}-details`}>
          {formatMetric(seriesPoint.speed_kph, units?.speed ?? 'km/h')} · {formatMetric(seriesPoint.distance_meters, units?.distance ?? 'm')}
        </Text>
        <Text className="text-[11px] text-slate-600 dark:text-slate-300" nativeID={`${id}-duration`} testID={`${id}-duration`}>
          Tiempo: {formatMetric(time, units?.duration ?? 'ms')}
        </Text>
      </View>
    </View>
  );
}

function DistanceComparisonCard({ id, a, b, delta, units }) {
  const colors = useThemeColors();
  const [selectedSide, setSelectedSide] = useState(null);
  const [hoveredSide, setHoveredSide] = useState(null);
  const values = [a?.total_distance_m ?? null, b?.total_distance_m ?? null];
  const activeSide = hoveredSide ?? selectedSide;
  const activeValue = activeSide === 'a' ? values[0] : activeSide === 'b' ? values[1] : null;

  return (
    <ChartCard
      description="Distancia sumada por el backend sobre las series válidas de cada sesión."
      icon="map-marker-distance"
      id={`${id}-card`}
      title="Distancia total"
    >
      <ChartSurface height={82} id={`${id}-bars`} label="Distancia total recorrida en las sesiones A y B">
        {(width) => {
          const rects = barPath(values, { width: Math.max(1, width - 112), height: 64, gap: 8, horizontal: true });
          return (
            <View className="gap-1" nativeID={`${id}-rows`} testID={`${id}-rows`}>
              {rects.map((rect, index) => {
                const letter = index === 0 ? 'A' : 'B';
                const color = index === 0 ? SESSION_SIDE_COLORS.a : SESSION_SIDE_COLORS.b;
                const shown = values[index];
                return (
                  <Pressable
                    accessibilityHint="Muestra la distancia total y la diferencia entre A y B"
                    accessibilityLabel={`Sesión ${letter}: ${formatMetric(shown, units?.distance ?? 'm')}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activeSide === letter.toLowerCase() }}
                    className="h-7 flex-row items-center gap-2"
                    key={letter}
                    nativeID={`${id}-row-${letter.toLowerCase()}`}
                    onHoverIn={isWeb ? () => setHoveredSide(letter.toLowerCase()) : undefined}
                    onHoverOut={isWeb ? () => setHoveredSide((current) => (current === letter.toLowerCase() ? null : current)) : undefined}
                    onPress={() => setSelectedSide((current) => (current === letter.toLowerCase() ? null : letter.toLowerCase()))}
                    testID={`${id}-row-${letter.toLowerCase()}`}
                  >
                    <Text className="w-4 text-xs font-bold text-slate-700 dark:text-slate-200" nativeID={`${id}-label-${letter.toLowerCase()}`} testID={`${id}-label-${letter.toLowerCase()}`}>
                      {letter}
                    </Text>
                    <View className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" nativeID={`${id}-track-${letter.toLowerCase()}`} testID={`${id}-track-${letter.toLowerCase()}`}>
                      {rect.missing ? null : (
                        <View className="h-full rounded-full" nativeID={`${id}-bar-${letter.toLowerCase()}`} style={{ backgroundColor: color, width: rect.width }} testID={`${id}-bar-${letter.toLowerCase()}`} />
                      )}
                    </View>
                    <Text className="w-20 text-right text-xs text-slate-700 dark:text-slate-200" nativeID={`${id}-value-${letter.toLowerCase()}`} testID={`${id}-value-${letter.toLowerCase()}`}>
                      {formatMetric(shown, units?.distance ?? 'm')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        }}
      </ChartSurface>
      {activeSide && activeValue !== null ? (
        <View className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={`${id}-tooltip`} testID={`${id}-tooltip`}>
          <Text className="text-xs font-semibold text-slate-900 dark:text-white" nativeID={`${id}-tooltip-title`} testID={`${id}-tooltip-title`}>
            Sesión {activeSide.toUpperCase()} · {formatMetric(activeValue, units?.distance ?? 'm')}
          </Text>
          <Text className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300" nativeID={`${id}-tooltip-delta`} testID={`${id}-tooltip-delta`}>
            Diferencia B − A: {formatDelta(delta, units?.distance ?? 'm')}
          </Text>
        </View>
      ) : null}
      <View className="mt-2 flex-row items-center gap-2" nativeID={`${id}-delta`} testID={`${id}-delta`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="swap-horizontal" size={14} />
        <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${id}-delta-label`} testID={`${id}-delta-label`}>
          Diferencia B − A: {formatDelta(delta, units?.distance ?? 'm')}
        </Text>
      </View>
    </ChartCard>
  );
}
