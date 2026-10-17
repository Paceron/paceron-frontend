import { Text, View } from 'react-native';
import { EMPTY_METRIC, formatMetric, hasMetric } from '../../../utils/dashboard-format.js';
import { normalizeRadarAxes } from '../../../utils/dashboard-chart.js';

// Los mismos cinco ejes del radar, en barritas.
//
// El radar responde "¿el perfil es-equilibrado?" — para eso la forma del
// polígono es la información. Las barras responden otra pregunta: "¿cuánto vale
// cada eje?" — y para eso la longitud es la información. Comparar un 87 contra un
// 64 es mucho más fácil en dos barras queBuscando un vértice en un polígono.
//
// Ambos salen de `normalizeRadarAxes`, o sea que el 0-100 de la barra es
// EXACTAMENTE el mismo número que alimenta el radio: no hay dos normalizaciones
// que puedan desincronizarse.
export function AxisBars({ id, summary, units }) {
  const axes = normalizeRadarAxes({
    totals: summary?.totals,
    trend: summary?.trend,
    consistency: summary?.consistency,
  });

  return (
    <View className="gap-3" nativeID={`${id}-root`} testID={`${id}-root`}>
      {axes.map((axis) => (
        <View key={axis.id} nativeID={`${id}-row-${axis.id}`} testID={`${id}-row-${axis.id}`}>
          <View className="mb-1 flex-row items-baseline justify-between" nativeID={`${id}-${axis.id}-header`} testID={`${id}-${axis.id}-header`}>
            <Text
              className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400"
              nativeID={`${id}-${axis.id}-label`}
              testID={`${id}-${axis.id}-label`}
            >
              {axis.label}
            </Text>
            <Text
              className="text-xs font-semibold text-slate-700 dark:text-slate-200"
              nativeID={`${id}-${axis.id}-raw`}
              testID={`${id}-${axis.id}-raw`}
            >
              {axis.available ? rawLabel(axis, units) : EMPTY_METRIC}
            </Text>
          </View>

          {/* El track va a `width: 100%` completo y el relleno toma el porcentaje
              del eje, así un 0% y un 100% se leen como extremos reales de la
              escala y no como "casi nada" vs "casi todo". */}
          <View
            className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            nativeID={`${id}-${axis.id}-track`}
            testID={`${id}-${axis.id}-track`}
          >
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: axis.available ? `${Math.round(axis.value)}%` : '0%' }}
              nativeID={`${id}-${axis.id}-fill`}
              testID={`${id}-${axis.id}-fill`}
            />
          </View>

          {/* El número 0-100 explícito: la barra sola no se puede leer con
              precisión, y el valor crudo (km/h, km) no es comparable entre ejes
              porque tienen unidades distintas. */}
          <Text
            className="mt-1 text-[10px] text-slate-400 dark:text-slate-500"
            nativeID={`${id}-${axis.id}-score`}
            testID={`${id}-${axis.id}-score`}
          >
            {axis.available ? `${Math.round(axis.value)} de 100` : 'sin dato para este eje'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function rawLabel(axis, units) {
  const value = axis.raw;
  if (!hasMetric(value)) return EMPTY_METRIC;
  // `consistency.cv` viene como fracción (0.08 = 8%) y su unidad no está en
  // `units`: mostrarla crudo como "0,08" al lado de "10,7 km/h" engaña.
  if (axis.id === 'consistency') return `${Math.round(value * 1000) / 10} % CV`;
  if (axis.id === 'trend') return `${value > 0 ? '+' : ''}${Math.round(value * 10) / 10} %`;
  if (axis.unitKey && units?.[axis.unitKey]) return formatMetric(value, units[axis.unitKey]);
  return formatMetric(value);
}