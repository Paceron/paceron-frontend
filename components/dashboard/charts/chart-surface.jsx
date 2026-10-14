import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useThemeColors } from '../../../theme/colors.js';

// Base común de los ocho gráficos del dashboard: mide el ancho con `onLayout`
// (SVG necesita números, no porcentajes), expone la descripción textual que el
// lector de pantalla necesita — un polígono o una línea no se narran solos— y
// hace la única animación que la spec permite: `opacity`, sin desplazamiento ni
// escalado.
//
// No calcula ninguna coordenada: eso vive en utils/dashboard-chart.js y entra
// por el render prop `children(width)`.
export function ChartSurface({ id, height, label, children }) {
  const [width, setWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: 220 });
  }, [opacity, reducedMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityLabel={label}
      accessibilityRole="image"
      nativeID={id}
      onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      style={[{ height }, style]}
      testID={id}
    >
      {width > 0 ? children(width) : null}
    </Animated.View>
  );
}

// Card con título que envuelve cada gráfico. El ícono acompaña al título, no lo
// reemplaza: mismo criterio que en el resto de la app.
export function ChartCard({ id, title, icon = 'chart-line', subtitle, legend, children }) {
  const colors = useThemeColors();

  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={id} testID={id}>
      <View className="mb-1 flex-row items-center gap-2" nativeID={`${id}-header`} testID={`${id}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={16} />
        <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-subtitle`} testID={`${id}-subtitle`}>
          {subtitle}
        </Text>
      ) : null}
      {children}
      {legend ? <View nativeID={`${id}-legend`} testID={`${id}-legend`}>{legend}</View> : null}
    </View>
  );
}

// Leyenda de las cuatro bandas de cumplimiento. Cada ítem lleva punto + texto +
// conteo: el color solo nunca alcanza (WCAG 1.4.1), y el conteo es lo que
// permite reconciliar el gráfico con el KPI de cumplimiento.
export function BandLegend({ id, items }) {
  return (
    <View className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-1" nativeID={id} testID={id}>
      {items.map((item) => (
        <View className="flex-row items-center gap-1" key={item.id} nativeID={`${id}-${item.id}`} testID={`${id}-${item.id}`}>
          <View className={`h-2 w-2 rounded-full ${item.dotClass}`} nativeID={`${id}-${item.id}-dot`} testID={`${id}-${item.id}-dot`} />
          <Text className="text-[11px] text-slate-600 dark:text-slate-300" nativeID={`${id}-${item.id}-label`} testID={`${id}-${item.id}-label`}>
            {item.label}
            {item.count === null ? '' : ` · ${item.count}`}
          </Text>
        </View>
      ))}
    </View>
  );
}
