import { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import '../../config/calendarLocale.js';
import { computeTodayIso } from '../../utils/calendar-today.js';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { KIND_DOT_COLORS } from '../../utils/calendar-kind-colors.js';
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { CalendarMonthYearHeader } from './calendar-month-year-header.jsx';
import { CalendarFadeIn } from './calendar-fade-in.jsx';

const MAX_DOTS = 4;

function collisionSeverity(assignments) {
  if (assignments.some((a) => a.presencialCollision?.type === 'cross_team')) return 'cross_team';
  if (assignments.some((a) => a.presencialCollision)) return 'same_team';
  return null;
}

const EMPTY_ASSIGNMENTS = [];

// Memoizado -- ver AggregatedMonthView más abajo para el motivo real (el
// grid entero se re-renderizaba en cada toque de un día, no solo esta
// celda).
const AggregatedDayCell = memo(function AggregatedDayCell({ date, state, isToday, assignments, onPress, showCollisions }) {
  const colors = useThemeColors();
  const isOtherMonth = state === 'disabled';
  const hasAssignments = assignments.length > 0;
  // Misma noción de "día cerrado" que group-calendar-screen.jsx, evaluada
  // contra la asignación más relevante del día (la primera presencial, si
  // hay alguna, si no la primera del array) — un día con varias
  // asignaciones puede tener una presencial y otra no.
  const relevant = assignments.find((a) => a.isPresencial) ?? assignments[0] ?? null;
  // `relevant ?? {}` -- NO "relevant ? ... : false": isCalendarDayClosed ya
  // resuelve bien un día sin asignación (sus defaults de parámetro cubren
  // {}, y compara la FECHA antes que nada) -- el ternario viejo hardcodeaba
  // `false` para cualquier día vacío sin mirar la fecha, así que un día
  // vacío de hace una semana se mostraba "abierto" igual que uno futuro
  // (bug real, encontrado con un console.log de depuración, 2026-11-12).
  const closed = isCalendarDayClosed(date.dateString, relevant ?? {});
  const severity = showCollisions ? collisionSeverity(assignments) : null;
  const visibleDots = assignments.slice(0, MAX_DOTS);
  const overflowCount = assignments.length - MAX_DOTS;
  // Mismo tratamiento que group-calendar-screen.jsx: hover/transition
  // fijos en las tres ramas, bg-* siempre declarado (nunca omitido).
  // `hover:animate-pulse` sacado (2026-11-10, mismo motivo que ahí): queda
  // pegado en touch sin `mouseleave`.
  const hoverFx = 'transition-all hover:border-4 hover:bg-opacity-60';
  const borderClass = isOtherMonth
    ? `${hoverFx} border-2 border-transparent bg-transparent`
    : isToday
      ? `${hoverFx} border-2 border-dashed border-primary bg-green-100 dark:bg-green-800 dark:hover:bg-opacity-60`
      : `${hoverFx} border-2 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-opacity-60`;

  return (
    <Pressable
      className={`h-14 w-full items-center justify-start py-1.5 px-1 gap-1 rounded-xl ${borderClass}`}
      nativeID={`aggregated-calendar-day-${date.dateString}`}
      onPress={() => { if (!isOtherMonth) onPress(date.dateString); }}
      style={{ opacity: closed ? 0.4 : 1 }}
      testID={`aggregated-calendar-day-${date.dateString}`}
    >
      <Text
        className={`text-base font-bold ${isOtherMonth ? 'text-slate-300 dark:text-slate-600' : isToday ? 'font-bold text-primary' : 'text-slate-700 dark:text-slate-200'}`}
        nativeID={`aggregated-calendar-day-${date.dateString}-label`}
        testID={`aggregated-calendar-day-${date.dateString}-label`}
      >
        {date.day}
      </Text>
      {hasAssignments && (
        <View
          className="flex-row items-center"
          nativeID={`aggregated-calendar-day-${date.dateString}-dots`}
          testID={`aggregated-calendar-day-${date.dateString}-dots`}
        >
          {visibleDots.map((assignment, i) => (
            assignment.isPresencial ? (
              <MaterialCommunityIcons color={colors.primary} key={assignment.id} name="map-marker" size={12} />
            ) : (
              <View
                key={assignment.id}
                nativeID={`aggregated-calendar-day-${date.dateString}-dot-${i}`}
                style={{ marginHorizontal: 3, width: 9, height: 9, borderRadius: 6, backgroundColor: KIND_DOT_COLORS[assignment.kind] }}
                testID={`aggregated-calendar-day-${date.dateString}-dot-${i}`}
              />
            )
          ))}
          {overflowCount > 0 && (
            <Text
              className="text-[9px] font-semibold text-slate-500 dark:text-slate-400"
              nativeID={`aggregated-calendar-day-${date.dateString}-overflow`}
              testID={`aggregated-calendar-day-${date.dateString}-overflow`}
            >
              +{overflowCount}
            </Text>
          )}
        </View>
      )}
      {severity && (
        <View
          className="absolute right-1 top-1"
          nativeID={`aggregated-calendar-day-${date.dateString}-collision-badge`}
          testID={`aggregated-calendar-day-${date.dateString}-collision-badge`}
        >
          <MaterialCommunityIcons
            color={severity === 'cross_team' ? '#ef4444' : '#d97706'}
            name="alert"
            size={11}
          />
        </View>
      )}
    </Pressable>
  );
});

// `memo` -- sin esto, abrir/cerrar el modal de detalle de día (estado del
// padre, `my-calendar-screen.jsx`/`administered-calendar-screen.jsx`) re-
// renderiza este componente aunque ninguna de SUS props haya cambiado, y
// con eso el `dayComponent` de abajo se recrea -- `react-native-calendars`
// trata un `dayComponent` nuevo como motivo para re-renderizar el grid
// ENTERO (~35-40 celdas) para mostrar un modal que ni siquiera es hijo de
// este árbol. Esto por sí solo no alcanza si `onDayPress`/`onMonthChange`
// siguen siendo funciones inline en el caller -- ver el fix en
// my-calendar-screen.jsx/administered-calendar-screen.jsx (useCallback).
export const AggregatedMonthView = memo(function AggregatedMonthView({ currentMonthISO, year, month, daysByDate, onMonthChange, onDayPress, showCollisions, loading }) {
  const colors = useThemeColors();
  const { colorScheme } = useThemeMode();
  // Antes se recalculaba en cada render (no memoizado) -- barato en sí,
  // pero rompía la estabilidad de referencia del `dayComponent` de abajo
  // junto con todo lo demás.
  const todayIso = useMemo(() => computeTodayIso(), []);

  const renderDay = useCallback(({ date, state }) => (
    <AggregatedDayCell
      assignments={daysByDate[date.dateString] ?? EMPTY_ASSIGNMENTS}
      date={date}
      isToday={date.dateString === todayIso}
      onPress={onDayPress}
      showCollisions={showCollisions}
      state={state}
    />
  ), [daysByDate, todayIso, onDayPress, showCollisions]);

  const handleMonthChange = useCallback((m) => onMonthChange(m.year, m.month), [onMonthChange]);

  return (
    <View
      className="relative rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-surface"
      nativeID="aggregated-month-view"
      testID="aggregated-month-view"
    >
      <CalendarFadeIn key={`${year}-${month}-${colorScheme}`} nativeID="aggregated-month-view-fade" testID="aggregated-month-view-fade">
        <Calendar
          current={currentMonthISO}
          customHeaderTitle={<CalendarMonthYearHeader idPrefix="aggregated-calendar" month={month} onChange={onMonthChange} year={year} />}
          dayComponent={renderDay}
          firstDay={1}
          onMonthChange={handleMonthChange}
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'transparent',
            textSectionTitleColor: colors.onSurfaceVariant,
            monthTextColor: colors.onSurface,
            arrowColor: colors.primary,
            todayTextColor: colors.primary,
            textDisabledColor: colors.onSurfaceVariant,
            textMonthFontFamily: 'Orbitron_700Bold',
          }}
        />
      </CalendarFadeIn>
      {loading && (
        <View
          className="absolute inset-0 items-center justify-center rounded-2xl bg-white/70 dark:bg-surface/70"
          nativeID="aggregated-month-view-loading-overlay"
          testID="aggregated-month-view-loading-overlay"
        >
          <ActivityIndicator color={colors.primary} nativeID="aggregated-month-view-loading-indicator" testID="aggregated-month-view-loading-indicator" />
        </View>
      )}
    </View>
  );
});
