import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useThemeColors } from '../../../theme/colors.js';
import { isWeb } from '../../../utils/platform.js';
import { InfoHint } from '../info-hint.jsx';

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
// `action` es el slot para un control que reconfigura ESTE gráfico — por ejemplo
// la granularidad de la línea de evolución. Va en el header y no en la barra de
// filtros porque no selecciona datos: cambia cómo se agrupan los que ya están.
//
// `description` es la bajada de la card, y va en la "i" del título, no como texto
// fijo: es el lugar para el "cómo se lee" (qué es la caja, por qué el eje va fijo,
// de dónde sale el veredicto). `subtitle` queda para lo que SÍ tiene que estar a
// la vista sin ningún gesto: la leyenda que hace falta para entender el gráfico
// (línea continua contra punteada) y el dato que lo condiciona (la tolerancia
// aplicada). Los dos juntos son válidos — la descripción no repite lo que la
// leyenda ya dice con las palabras del gráfico.
export function ChartCard({ id, title, icon = 'chart-line', description, subtitle, legend, action, children }) {
  const colors = useThemeColors();

  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={id} testID={id}>
      <View className="mb-1 flex-row items-center gap-2" nativeID={`${id}-header`} testID={`${id}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={16} />
        {/* La "i" va pegada al título, no al borde derecho del header: por eso el
            que se estira es este grupo (y el texto se encoge antes que el ícono). */}
        <View className="min-w-0 flex-1 flex-row items-center gap-1.5" nativeID={`${id}-heading`} testID={`${id}-heading`}>
          <Text className="min-w-0 shrink text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
            {title}
          </Text>
          {description ? <InfoHint description={description} id={`${id}-info`} title={title} /> : null}
        </View>
        {action ? <View nativeID={`${id}-action`} testID={`${id}-action`}>{action}</View> : null}
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
//
// Con `onActive` cada ítem pasa a ser un botón que activa su banda —lo usa el
// donut, donde la porción es un blanco chico y la fila de la leyenda es un target
// mucho mejor, sobre todo con el dedo—. Sin `onActive` la leyenda sigue siendo
// estática y no agrega roles de accesibilidad que no corresponden.
export function BandLegend({ id, items = [], activeId = null, onActive }) {
  return (
    <View className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-1" nativeID={id} testID={id}>
      {items.map((item) => {
        const isActive = activeId !== null && activeId === item.id;
        const content = (
          <>
            <View className={`h-2 w-2 rounded-full ${item.dotClass}`} nativeID={`${id}-${item.id}-dot`} testID={`${id}-${item.id}-dot`} />
            <Text
              className={`text-[11px] ${isActive ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
              nativeID={`${id}-${item.id}-label`}
              testID={`${id}-${item.id}-label`}
            >
              {item.label}
              {item.count === null ? '' : ` · ${item.count}`}
            </Text>
          </>
        );
        if (!onActive) {
          return (
            <View className="flex-row items-center gap-1" key={item.id} nativeID={`${id}-${item.id}`} testID={`${id}-${item.id}`}>
              {content}
            </View>
          );
        }
        return (
          <Pressable
            accessibilityLabel={`${item.label}${item.count === null ? '' : `: ${item.count}`}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className="flex-row items-center gap-1"
            key={item.id}
            nativeID={`${id}-${item.id}`}
            onHoverIn={isWeb ? () => onActive(item.id) : undefined}
            onHoverOut={isWeb ? () => onActive(null) : undefined}
            onPress={() => onActive(isActive ? null : item.id)}
            testID={`${id}-${item.id}`}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}
