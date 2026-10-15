import { useMemo, useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStreaks } from '../../hooks/use-streaks.js';
import { streakDayVisual } from '../../utils/streak-day-status.js';
import { getWeekDates, canGoOlder } from '../../utils/streak-week.js';
import { useThemeColors } from '../../theme/colors.js';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { formatDisplayDate, formatShortDate, formatWeekdayLabel } from '../../utils/format-date-display.js';

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

// Celda vacía -- fuera del rango que trajo el backend (antes de la
// ventana fetched) o un día futuro dentro de la semana actual (todavía no
// llega). Ninguno de los dos tiene estado real que mostrar: contorno
// punteado, sin relleno, no clickeable (no hay nada que ver en el
// calendario de un día que todavía no pasó, y un día sin dato no amerita
// mandar a una pantalla que tampoco va a tener nada interesante).
function EmptyDayCell({ idPrefix, label }) {
  return (
    <View
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-600"
      nativeID={idPrefix}
      testID={idPrefix}
    />
  );
}

export function StreaksTab() {
  const router = useRouter();
  const colors = useThemeColors();
  const { streaks, loading, error } = useStreaks();
  const [weekOffset, setWeekOffset] = useState(0);

  const daysByDate = useMemo(() => new Map((streaks?.days ?? []).map((d) => [d.date, d])), [streaks]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  if (loading) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streaks-tab-loading" testID="streaks-tab-loading">Cargando…</Text>;
  }

  if (error || !streaks) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streaks-tab-error" testID="streaks-tab-error">No pudimos cargar tus rachas.</Text>;
  }

  const olderEnabled = canGoOlder(weekOffset, streaks.days.length);
  const newerEnabled = weekOffset > 0;

  return (
    <View nativeID="streaks-tab-root" testID="streaks-tab-root">
      <View className="flex-row gap-3" nativeID="streaks-tab-cards-row" testID="streaks-tab-cards-row">
        <StreakCard best={streaks.strict.best} current={streaks.strict.current} icon="fire" idPrefix="streaks-tab-strict-card" title="Entrenamientos consecutivos" />
        <StreakCard best={streaks.flexible.best} current={streaks.flexible.current} icon="calendar-check" idPrefix="streaks-tab-flexible-card" title="Días entrenando" />
      </View>

      {/* Vista semanal navegable (reemplaza la grilla plana de 30 días,
          2026-10-15) -- arranca en la semana actual (lunes a domingo),
          ‹ › recorren semana por semana, "Hoy" vuelve directo a la
          actual. Cada día clickeable navega a /calendar?date= (mismo
          destino que next-training-banner.jsx); el de hoy lleva borde
          propio. Semanas fuera del rango que trajo el backend, o días
          futuros dentro de la semana actual, se ven como celda vacía
          (EmptyDayCell) en vez de inventar un estado. */}
      <View className="mb-2 mt-5 flex-row items-center justify-between" nativeID="streaks-tab-week-nav" testID="streaks-tab-week-nav">
        <Pressable disabled={!olderEnabled} nativeID="streaks-tab-week-older" onPress={() => setWeekOffset((o) => o + 1)} testID="streaks-tab-week-older">
          <MaterialCommunityIcons color={olderEnabled ? colors.onSurfaceVariant : '#cbd5e1'} name="chevron-left" size={22} />
        </Pressable>
        <View className="items-center" nativeID="streaks-tab-week-range-wrap" testID="streaks-tab-week-range-wrap">
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="streaks-tab-week-range" testID="streaks-tab-week-range">
            {formatShortDate(weekDates[0])} – {formatShortDate(weekDates[6])}
          </Text>
          {weekOffset > 0 && (
            <Pressable nativeID="streaks-tab-week-today-button" onPress={() => setWeekOffset(0)} testID="streaks-tab-week-today-button">
              <Text className="text-xs font-semibold text-primary" nativeID="streaks-tab-week-today-label" testID="streaks-tab-week-today-label">Volver a hoy</Text>
            </Pressable>
          )}
        </View>
        <Pressable disabled={!newerEnabled} nativeID="streaks-tab-week-newer" onPress={() => setWeekOffset((o) => Math.max(0, o - 1))} testID="streaks-tab-week-newer">
          <MaterialCommunityIcons color={newerEnabled ? colors.onSurfaceVariant : '#cbd5e1'} name="chevron-right" size={22} />
        </Pressable>
      </View>

      <View className="flex-row justify-between gap-1" nativeID="streaks-tab-grid" testID="streaks-tab-grid">
        {weekDates.map((date) => {
          const day = daysByDate.get(date);
          const dayIdPrefix = `streaks-tab-grid-day-${date}`;
          const weekdayLabel = formatWeekdayLabel(date, { short: true });

          if (!day) {
            return (
              <View className="items-center gap-1" key={date} nativeID={`${dayIdPrefix}-column`} testID={`${dayIdPrefix}-column`}>
                <Text className="text-[10px] font-medium text-slate-400 dark:text-slate-500" nativeID={`${dayIdPrefix}-weekday`} testID={`${dayIdPrefix}-weekday`}>{weekdayLabel}</Text>
                <EmptyDayCell idPrefix={dayIdPrefix} label={`${formatDisplayDate(date)}: sin datos`} />
              </View>
            );
          }

          const visual = streakDayVisual(day.strictStatus);
          const isToday = date === todayIso;
          const dayNumber = Number(date.slice(-2));

          return (
            <View className="items-center gap-1" key={date} nativeID={`${dayIdPrefix}-column`} testID={`${dayIdPrefix}-column`}>
              <Text className="text-[10px] font-medium text-slate-400 dark:text-slate-500" nativeID={`${dayIdPrefix}-weekday`} testID={`${dayIdPrefix}-weekday`}>{weekdayLabel}</Text>
              <IconTooltip idPrefix={`${dayIdPrefix}-tooltip`} label={formatDisplayDate(date)} position="top">
                <Pressable
                  accessibilityLabel={`${formatDisplayDate(date)}${isToday ? ' (hoy)' : ''}: ${visual.label}`}
                  className={`h-9 w-9 items-center justify-center rounded-lg active:opacity-70 hover:opacity-80 ${isToday ? 'border-2 border-primary' : ''}`}
                  nativeID={dayIdPrefix}
                  onPress={() => router.push(`/calendar?date=${date}`)}
                  style={{ backgroundColor: visual.color }}
                  testID={dayIdPrefix}
                >
                  <Text className="text-xs font-semibold" nativeID={`${dayIdPrefix}-number`} style={{ color: visual.textColor }} testID={`${dayIdPrefix}-number`}>
                    {dayNumber}
                  </Text>
                </Pressable>
              </IconTooltip>
            </View>
          );
        })}
      </View>
    </View>
  );
}
