import { Text, View } from 'react-native';
import { KIND_DOT_COLORS, KIND_LABELS, KIND_ORDER } from '../../utils/calendar-kind-colors.js';

// Qué significa cada color del calendario (KIND_DOT_COLORS) -- no existía
// en ningún lado hasta ahora, ni en el calendario de un grupo puntual ni en
// la vista agregada. `counts` es opcional: sin él es una leyenda pelada
// (dot + label); con él (group-calendar-screen.jsx) suma "N este mes" al
// lado de cada label, reusando el mismo eje de 4 kinds en vez de montar un
// resumen aparte.
export function CalendarKindLegend({ counts, idPrefix }) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2" nativeID={idPrefix} testID={idPrefix}>
      {KIND_ORDER.map((kind) => (
        <View className="flex-row items-center gap-1.5" key={kind} nativeID={`${idPrefix}-${kind}`} testID={`${idPrefix}-${kind}`}>
          <View className="h-2.5 w-2.5 rounded-full" nativeID={`${idPrefix}-${kind}-dot`} style={{ backgroundColor: KIND_DOT_COLORS[kind] }} testID={`${idPrefix}-${kind}-dot`} />
          <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-${kind}-label`} testID={`${idPrefix}-${kind}-label`}>
            {KIND_LABELS[kind]}{counts ? ` · ${counts[kind] ?? 0}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}
