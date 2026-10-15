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
// una posición distinta según el largo del título. Ahora también
// seleccionable (2026-10-15): la grilla de abajo muestra la racha
// seleccionada (estricta o flexible, son distintas día a día), con borde
// propio para la que está activa.
function StreakCard({ icon, title, current, best, idPrefix, selected, onPress }) {
  const colors = useThemeColors();
  return (
    <Pressable
      className={`flex-1 rounded-2xl bg-white p-4 shadow-sm hover:opacity-90 active:opacity-80 dark:bg-surface ${selected ? 'border-2 border-primary' : ''}`}
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
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
    </Pressable>
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
      className="h-11 items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-600"
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
  // Qué racha pinta la grilla -- son distintas día a día (la estricta corta
  // con una serie salteada, la flexible no), así que mostrar siempre
  // 'strict' sería mentirle a quien mira la flexible (pedido real,
  // 2026-10-15). Default estricta porque es la primera card.
  const [selectedStreak, setSelectedStreak] = useState('strict');

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
  const isCurrentWeek = weekOffset === 0;

  return (
    <View nativeID="streaks-tab-root" testID="streaks-tab-root">
      <View className="flex-row gap-3" nativeID="streaks-tab-cards-row" testID="streaks-tab-cards-row">
        <StreakCard
          best={streaks.strict.best}
          current={streaks.strict.current}
          icon="fire"
          idPrefix="streaks-tab-strict-card"
          onPress={() => setSelectedStreak('strict')}
          selected={selectedStreak === 'strict'}
          title="Entrenamientos consecutivos"
        />
        <StreakCard
          best={streaks.flexible.best}
          current={streaks.flexible.current}
          icon="calendar-check"
          idPrefix="streaks-tab-flexible-card"
          onPress={() => setSelectedStreak('flexible')}
          selected={selectedStreak === 'flexible'}
          title="Días entrenando"
        />
      </View>

      {/* Vista semanal navegable (reemplaza la grilla plana de 30 días,
          2026-10-15) -- arranca en la semana actual (lunes a domingo),
          ‹ › recorren semana por semana, "Hoy" vuelve directo a la
          actual. Cada día clickeable navega a /calendar?date= (mismo
          destino que next-training-banner.jsx); el de hoy lleva borde
          propio. Semanas fuera del rango que trajo el backend, o días
          futuros dentro de la semana actual, se ven como celda vacía
          (EmptyDayCell) en vez de inventar un estado. Pinta la racha
          seleccionada arriba (`selectedStreak`), no siempre la estricta.
          Todo dentro de una card (antes flotaba contra el fondo de la
          pantalla, se perdía -- pedido real 2026-10-15). */}
      <View className="mt-5 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="streaks-tab-week-card" testID="streaks-tab-week-card">
        <Text className="mb-3 text-xs text-slate-400 dark:text-slate-500" nativeID="streaks-tab-grid-subtitle" testID="streaks-tab-grid-subtitle">
          Mostrando: {selectedStreak === 'strict' ? 'Entrenamientos consecutivos' : 'Días entrenando'}
        </Text>

        {/* Centrado real: ‹ y › quedan fijos en los extremos, el grupo
            rango+Hoy ocupa el espacio del medio como una sola unidad
            centrada -- antes (justify-between con 4 hijos sueltos) el
            rango quedaba más cerca del ‹ que del ›, visiblemente
            descentrado (pedido real 2026-10-15). "Hoy" sigue siempre
            montado (solo cambia opacidad/interactividad) para no mover
            nada al aparecer/desaparecer. */}
        <View className="mb-3 flex-row items-center" nativeID="streaks-tab-week-nav" testID="streaks-tab-week-nav">
          <IconTooltip idPrefix="streaks-tab-week-older-tooltip" label="Semana anterior" position="bottom">
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-60 dark:hover:bg-slate-700"
              disabled={!olderEnabled}
              nativeID="streaks-tab-week-older"
              onPress={() => setWeekOffset((o) => o + 1)}
              testID="streaks-tab-week-older"
            >
              <MaterialCommunityIcons color={olderEnabled ? colors.onSurfaceVariant : '#cbd5e1'} name="chevron-left" size={22} />
            </Pressable>
          </IconTooltip>

          <View className="flex-1 flex-row items-center justify-center gap-2" nativeID="streaks-tab-week-range-group" testID="streaks-tab-week-range-group">
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="streaks-tab-week-range" testID="streaks-tab-week-range">
              {formatShortDate(weekDates[0])} – {formatShortDate(weekDates[6])}
            </Text>
            <IconTooltip idPrefix="streaks-tab-week-today-tooltip" label="Volver a la semana actual" position="bottom">
              <Pressable
                className={`h-7 items-center justify-center rounded-full bg-primary-tint px-3 hover:opacity-80 active:opacity-70 dark:bg-primary/15 ${isCurrentWeek ? 'opacity-0' : 'opacity-100'}`}
                disabled={isCurrentWeek}
                nativeID="streaks-tab-week-today-button"
                onPress={() => setWeekOffset(0)}
                testID="streaks-tab-week-today-button"
              >
                <Text className="text-xs font-semibold text-on-primary-tint dark:text-primary" nativeID="streaks-tab-week-today-label" testID="streaks-tab-week-today-label">Hoy</Text>
              </Pressable>
            </IconTooltip>
          </View>

          <IconTooltip idPrefix="streaks-tab-week-newer-tooltip" label="Semana siguiente" position="bottom">
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-60 dark:hover:bg-slate-700"
              disabled={!newerEnabled}
              nativeID="streaks-tab-week-newer"
              onPress={() => setWeekOffset((o) => Math.max(0, o - 1))}
              testID="streaks-tab-week-newer"
            >
              <MaterialCommunityIcons color={newerEnabled ? colors.onSurfaceVariant : '#cbd5e1'} name="chevron-right" size={22} />
            </Pressable>
          </IconTooltip>
        </View>

        {/* Columnas SIN `items-center` -- con eso puesto, el hijo directo
            (el wrapper `relative` que IconTooltip agrega en web) no
            estiraba a 100% del ancho de la columna y el `w-full` del
            Pressable de adentro terminaba resolviendo contra su propio
            contenido (celdas angostas, bug real 2026-10-15). Sin
            `items-center`, el stretch default de flexbox hace que cada
            hijo (el label de día, el wrapper de IconTooltip, el Pressable)
            ocupe el 100% de la columna en cada nivel -- el centrado del
            TEXTO lo da `text-center`/`items-center` puntual adentro de
            cada uno, no la columna entera. */}
        <View className="flex-row gap-1.5" nativeID="streaks-tab-grid" testID="streaks-tab-grid">
          {weekDates.map((date) => {
            const day = daysByDate.get(date);
            const dayIdPrefix = `streaks-tab-grid-day-${date}`;
            const weekdayLabel = formatWeekdayLabel(date, { short: true });

            if (!day) {
              return (
                <View className="flex-1 gap-1" key={date} nativeID={`${dayIdPrefix}-column`} testID={`${dayIdPrefix}-column`}>
                  <Text className="text-center text-[10px] font-medium text-slate-400 dark:text-slate-500" nativeID={`${dayIdPrefix}-weekday`} testID={`${dayIdPrefix}-weekday`}>{weekdayLabel}</Text>
                  <EmptyDayCell idPrefix={dayIdPrefix} label={`${formatDisplayDate(date)}: sin datos`} />
                </View>
              );
            }

            const status = selectedStreak === 'strict' ? day.strictStatus : day.flexibleStatus;
            const visual = streakDayVisual(status);
            const isToday = date === todayIso;
            const dayNumber = Number(date.slice(-2));

            return (
              <View className="flex-1 gap-1" key={date} nativeID={`${dayIdPrefix}-column`} testID={`${dayIdPrefix}-column`}>
                <Text className="text-center text-[10px] font-medium text-slate-400 dark:text-slate-500" nativeID={`${dayIdPrefix}-weekday`} testID={`${dayIdPrefix}-weekday`}>{weekdayLabel}</Text>
                <IconTooltip idPrefix={`${dayIdPrefix}-tooltip`} label={formatDisplayDate(date)} position="top">
                  <Pressable
                    accessibilityLabel={`${formatDisplayDate(date)}${isToday ? ' (hoy)' : ''}: ${visual.label}`}
                    className={`h-11 items-center justify-center rounded-lg active:opacity-60 hover:opacity-70 ${isToday ? 'border-2 border-primary' : ''}`}
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
    </View>
  );
}
