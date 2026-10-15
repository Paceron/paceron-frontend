import { Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStreaks } from '../../hooks/use-streaks.js';
import { streakDayVisual } from '../../utils/streak-day-status.js';
import { useThemeColors } from '../../theme/colors.js';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { formatDisplayDate } from '../../utils/format-date-display.js';

// Orden pedido 2026-10-14: "N días" primero (misma fila en los dos cards sin
// importar el largo del label de abajo), después ícono+label, después mejor
// racha -- antes el ícono+label iba primero y el número quedaba más abajo en
// una posición distinta según el largo del título.
function StreakCard({ icon, title, current, best, idPrefix }) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <Text className="text-2xl font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-current`} testID={`${idPrefix}-current`}>
        {current} días
      </Text>
      <View className="mt-2 flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={20} />
        <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>{title}</Text>
      </View>
      <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-best`} testID={`${idPrefix}-best`}>
        Mejor racha: {best} días
      </Text>
    </View>
  );
}

export function StreaksTab() {
  const router = useRouter();
  const { streaks, loading, error } = useStreaks();

  if (loading) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streaks-tab-loading" testID="streaks-tab-loading">Cargando…</Text>;
  }

  if (error || !streaks) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streaks-tab-error" testID="streaks-tab-error">No pudimos cargar tus rachas.</Text>;
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <View nativeID="streaks-tab-root" testID="streaks-tab-root">
      <View className="flex-row gap-3" nativeID="streaks-tab-cards-row" testID="streaks-tab-cards-row">
        <StreakCard best={streaks.strict.best} current={streaks.strict.current} icon="fire" idPrefix="streaks-tab-strict-card" title="Entrenamientos consecutivos" />
        <StreakCard best={streaks.flexible.best} current={streaks.flexible.current} icon="calendar-check" idPrefix="streaks-tab-flexible-card" title="Días entrenando" />
      </View>
      <Text className="mb-2 mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="streaks-tab-grid-title" testID="streaks-tab-grid-title">
        Últimos 30 días
      </Text>
      {/* Cada día es clickeable -- navega a ese día en el calendario propio
          (mismo destino que ya usa next-training-banner.jsx para el
          corredor). Celda grande con el número de día adentro (mobile no
          tiene hover, así que la fecha tiene que leerse directo en la
          celda, no solo en un tooltip) -- el tooltip de IconTooltip sigue
          sumando la fecha completa en web al pasar el mouse. El día de hoy
          lleva un anillo propio (además de su color 'pending', que puede
          confundirse con 'skipped' a primera vista) para que se identifique
          sin ambigüedad. `active:opacity-70`/`hover:opacity-80` dan el
          feedback mínimo de toque/hover pedido. */}
      <View className="flex-row flex-wrap gap-1.5" nativeID="streaks-tab-grid" testID="streaks-tab-grid">
        {streaks.days.map((day) => {
          const visual = streakDayVisual(day.strictStatus);
          const dayIdPrefix = `streaks-tab-grid-day-${day.date}`;
          const isToday = day.date === todayIso;
          const dayNumber = Number(day.date.slice(-2));
          return (
            <IconTooltip idPrefix={`${dayIdPrefix}-tooltip`} key={day.date} label={formatDisplayDate(day.date)} position="top">
              <Pressable
                accessibilityLabel={`${formatDisplayDate(day.date)}${isToday ? ' (hoy)' : ''}: ${visual.label}`}
                className={`h-9 w-9 items-center justify-center rounded-lg active:opacity-70 hover:opacity-80 ${isToday ? 'border-2 border-primary' : ''}`}
                nativeID={dayIdPrefix}
                onPress={() => router.push(`/calendar?date=${day.date}`)}
                style={{ backgroundColor: visual.color }}
                testID={dayIdPrefix}
              >
                <Text className="text-xs font-semibold" nativeID={`${dayIdPrefix}-number`} style={{ color: visual.textColor }} testID={`${dayIdPrefix}-number`}>
                  {dayNumber}
                </Text>
              </Pressable>
            </IconTooltip>
          );
        })}
      </View>
    </View>
  );
}
