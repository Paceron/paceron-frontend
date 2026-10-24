import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { BAND_LABELS, DASHBOARD_BANDS, donutSlices } from '../../../utils/dashboard-chart.js';
import { formatMetric } from '../../../utils/dashboard-format.js';
import { isWeb } from '../../../utils/platform.js';
import { useThemeColors } from '../../../theme/colors.js';
import { BAND_COLORS, BAND_DOT_CLASSES } from './band-tones.js';
import { BandLegend } from './chart-surface.jsx';

// Reparto del período: un anillo con las cuatro bandas calculadas por el backend
// y, en el centro, la lectura de la porción activa —el "tooltip" del donut—. El
// centro se usa en vez de un globo flotante a propósito: un globo que se sale del
// anillo termina tapado por la card de al lado, y acá el número se lee en el
// mismo lugar en el que se posa el mouse, sin coordenadas que se puedan desfasar.
//
// El anillo NO se arma con arcos sino con una `Circle` por porción y
// `strokeDasharray`: la circunferencia se reparte en trazos y el desfase mueve el
// comienzo de cada uno. Es la misma técnica con la que se dibuja el gauge, y
// evita la matemática de `large-arc-flag` que es donde un donut casero sale mal.
//
// El conteo de cada banda se muestra SIEMPRE en la leyenda, no solo al pasar el
// mouse: el color solo nunca alcanza (WCAG 1.4.1) y el número es lo que permite
// reconciliar el anillo con el KPI de cumplimiento.
export function ComplianceDonut({ id, counts, label, size = 150, thickness = 18, emptyMessage = 'Sin series con objetivo en el período' }) {
  const colors = useThemeColors();
  const [active, setActive] = useState(null);
  const radius = Math.max(0, (size - thickness) / 2);
  const center = size / 2;
  const ring = donutSlices(counts, { radius, gap: 2 });
  const total = ring.slices.reduce((sum, slice) => sum + slice.count, 0);
  const activeSlice = active ? ring.slices.find((slice) => slice.band === active) ?? null : null;
  const hitSize = thickness + 14;

  return (
    <View nativeID={`${id}-wrapper`} testID={`${id}-wrapper`}>
      {total > 0 ? (
        <View
          accessibilityLabel={label}
          accessibilityRole="image"
          nativeID={`${id}-ring`}
          style={{ alignSelf: 'center', height: size, position: 'relative', width: size }}
          testID={`${id}-ring`}
        >
          <Svg height={size} nativeID={`${id}-svg`} testID={`${id}-svg`} width={size}>
            <Circle
              cx={center}
              cy={center}
              fill="none"
              nativeID={`${id}-track`}
              r={radius}
              stroke={colors.outlineVariant}
              strokeWidth={thickness}
              testID={`${id}-track`}
            />
            {/* -90° para que la primera porción (met) arranque a las 12 y el
                orden del contrato se lea en sentido horario. */}
            <G
              nativeID={`${id}-slices`}
              testID={`${id}-slices`}
              transform={`rotate(-90 ${center} ${center})`}
            >
              {ring.slices.map((slice) => (
                <Circle
                  cx={center}
                  cy={center}
                  fill="none"
                  key={slice.band}
                  nativeID={`${id}-slice-${slice.band}`}
                  opacity={active && active !== slice.band ? 0.35 : 1}
                  r={radius}
                  stroke={BAND_COLORS[slice.band] ?? BAND_COLORS.unknown}
                  strokeDasharray={[slice.length, Math.max(0, ring.circumference - slice.length)]}
                  strokeDashoffset={-slice.start}
                  strokeWidth={thickness}
                  testID={`${id}-slice-${slice.band}`}
                />
              ))}
            </G>
          </Svg>
          {/* Hotspots: un `Pressable` invisible en el centro de cada porción.
              react-native-svg no expone `onMouseEnter`, así que el hover no se le
              puede pedir a la `Circle`; hover en web y tap en nativo, igual que
              en el resto de los gráficos. */}
          <View
            style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, pointerEvents: 'box-none' }}
            nativeID={`${id}-hotspots`}
            testID={`${id}-hotspots`}
          >
            {ring.slices.map((slice) => {
              const cx = center + Math.cos(slice.midAngle) * radius;
              const cy = center + Math.sin(slice.midAngle) * radius;
              const isActive = active === slice.band;
              return (
                <Pressable
                  accessibilityLabel={`${BAND_LABELS[slice.band] ?? slice.band}: ${slice.count} de ${total}, ${formatMetric(slice.share, '%')}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  key={slice.band}
                  nativeID={`${id}-hotspot-${slice.band}`}
                  onHoverIn={isWeb ? () => setActive(slice.band) : undefined}
                  onHoverOut={isWeb ? () => setActive(null) : undefined}
                  onPress={() => setActive(isActive ? null : slice.band)}
                  style={{
                    position: 'absolute',
                    left: cx - hitSize / 2,
                    top: cy - hitSize / 2,
                    width: hitSize,
                    height: hitSize,
                    borderRadius: hitSize / 2,
                  }}
                  testID={`${id}-hotspot-${slice.band}`}
                />
              );
            })}
          </View>
          {/* Centro: el total en reposo, la porción activa al pasar el mouse o
              tocar. `pointerEvents: none` para no robarle el hover al anillo. */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: size,
              height: size,
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
            nativeID={`${id}-center`}
            testID={`${id}-center`}
          >
            {activeSlice ? (
              <>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${id}-center-label`} testID={`${id}-center-label`}>
                  {BAND_LABELS[activeSlice.band] ?? activeSlice.band}
                </Text>
                <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID={`${id}-center-value`} testID={`${id}-center-value`}>
                  {activeSlice.count}
                </Text>
                <Text className="text-[11px]" nativeID={`${id}-center-share`} testID={`${id}-center-share`} style={{ color: BAND_COLORS[activeSlice.band] ?? colors.onSurfaceVariant }}>
                  {formatMetric(activeSlice.share, '%')}
                </Text>
              </>
            ) : (
              <>
                <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID={`${id}-center-total`} testID={`${id}-center-total`}>
                  {total}
                </Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400" nativeID={`${id}-center-caption`} testID={`${id}-center-caption`}>
                  {total === 1 ? 'serie con objetivo' : 'series con objetivo'}
                </Text>
              </>
            )}
          </View>
        </View>
      ) : (
        <Text className="py-6 text-center text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-empty`} testID={`${id}-empty`}>
          {emptyMessage}
        </Text>
      )}
      <BandLegend
        activeId={active}
        id={`${id}-legend`}
        items={DASHBOARD_BANDS.map((band) => ({
          count: counts?.[band] ?? 0,
          dotClass: BAND_DOT_CLASSES[band],
          id: band,
          label: BAND_LABELS[band] ?? band,
        }))}
        onActive={setActive}
      />
    </View>
  );
}
