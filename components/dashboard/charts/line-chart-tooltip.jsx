import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { isWeb } from '../../../utils/platform.js';
import { formatMetric } from '../../../utils/dashboard-format.js';
import { useThemeColors } from '../../../theme/colors.js';

// Tooltip de un punto de la línea.
//
// Va en un overlay `absolute` del chart y NO dentro del `<Svg>`: react-native-svg
// no expone `onMouseEnter`, así que el hover web no se puede pedir a un `<Circle>`.
// Lo que sí funciona en las dos plataformas es un `Pressable` invisible encima,
// con un hit area más grande que el punto: en web se dispara con hover (gracias
// al `onHoverIn` que react-native-web reenvía) y con click, en nativo con tap.
//
// La misma asimetría del repo en `kpi-tooltip.jsx`: `onHoverIn` solo en web, tap
// en nativo. Escribirlo sin el gate haría que en nativo el tooltip se quedara
// pegado después del primer tap.
export function LineChartTooltip({ id, point, unit, formatX, secondary }) {
  const colors = useThemeColors();
  if (!point) return null;

  // Se ancla arriba del punto y se desplaza contra los bordes: cerca del eje X
  // izquierdo se corre a la derecha, y al revés. Un tooltip que se sale del
  // chart no se lee, y en un gráfico angosto pasa bastante.
  const flipX = point.x > point.width * 0.6;
  const left = flipX ? undefined : point.x + 12;
  const right = flipX ? point.width - point.x + 12 : undefined;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: Math.max(0, point.y - 12),
        left,
        right,
        alignItems: flipX ? 'flex-end' : 'flex-start',
      }}
      nativeID={`${id}-tooltip`}
      testID={`${id}-tooltip`}
    >
      <View
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm dark:border-slate-600 dark:bg-surface-2"
        nativeID={`${id}-tooltip-box`}
        testID={`${id}-tooltip-box`}
      >
        <Text className="text-[11px] font-medium text-slate-500 dark:text-slate-400" nativeID={`${id}-tooltip-x`} testID={`${id}-tooltip-x`}>
          {formatX(point.label)}
        </Text>
        <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-tooltip-value`} testID={`${id}-tooltip-value`}>
          {formatMetric(point.value, unit)}
        </Text>
        {secondary && typeof secondary.value === 'number' ? (
          <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-tooltip-secondary`} testID={`${id}-tooltip-secondary`}>
            {`${secondary.name ?? 'Objetivo'}: ${formatMetric(secondary.value, unit)}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Capa de interacción del gráfico: los hotspots de cada punto.
//
// El hit area (`HOTSPOT_R`) es bastante mayor que el punto dibujado (`r=3`) a
// propósito. Con el radio exacto, en un gráfico de 190 px de alto y 12 puntos,
// el área sensible del punto es de unos 28 px² — imposible de acertar con el
// dedo y casi imposible con el mouse.
export const HOTSPOT_R = 14;

export function LineChartHotspots({ id, points, width, plotHeight, onActive, onDeactivate, activeIndex }) {
  const colors = useThemeColors();
  const [hovered, setHovered] = useState(null);

  const activate = (index) => {
    setHovered(index);
    onActive?.(index);
  };
  const deactivate = () => {
    setHovered(null);
    onDeactivate?.();
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, top: 0, width, height: plotHeight }}
      nativeID={`${id}-hotspots`}
      testID={`${id}-hotspots`}
    >
      {points.map((point) =>
        point.y === null ? null : (
          <Pressable
            accessibilityHint={`${formatMetricSafe(point.value)}`}
            accessibilityLabel={`${point.label}: ${formatMetricSafe(point.value)}`}
            accessibilityRole="button"
            hitSlop={6}
            key={point.index}
            nativeID={`${id}-hotspot-${point.index}`}
            onHoverIn={isWeb ? () => activate(point.index) : undefined}
            onHoverOut={isWeb ? deactivate : undefined}
            onPress={() => activate(point.index)}
            style={{
              position: 'absolute',
              left: point.x - HOTSPOT_R,
              top: point.y - HOTSPOT_R,
              width: HOTSPOT_R * 2,
              height: HOTSPOT_R * 2,
            }}
            testID={`${id}-hotspot-${point.index}`}
          />
        ),
      )}
      {/* El punto activo se agranda para que se vea cuál se está leyendo. */}
      {activeIndex !== null && activeIndex !== undefined && points[activeIndex]?.y !== null ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: points[activeIndex].x - 6,
            top: points[activeIndex].y - 6,
            width: 12,
            height: 12,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: colors.primary,
          }}
          nativeID={`${id}-active-point`}
          testID={`${id}-active-point`}
        />
      ) : null}
    </View>
  );
}

function formatMetricSafe(value) {
  if (typeof value !== 'number') return 'sin dato';
  return String(value);
}
