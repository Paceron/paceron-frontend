import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import '../../config/calendarLocale.js';
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

function AggregatedDayCell({ date, state, assignments, onPress, showCollisions }) {
  const colors = useThemeColors();
  const isOtherMonth = state === 'disabled';
  const hasAssignments = assignments.length > 0;
  // Misma noción de "día cerrado" que group-calendar-screen.jsx, evaluada
  // contra la asignación más relevante del día (la primera presencial, si
  // hay alguna, si no la primera del array) — un día con varias
  // asignaciones puede tener una presencial y otra no.
  const relevant = assignments.find((a) => a.isPresencial) ?? assignments[0] ?? null;
  const closed = relevant ? isCalendarDayClosed(date.dateString, relevant) : false;
  const severity = showCollisions ? collisionSeverity(assignments) : null;
  const visibleDots = assignments.slice(0, MAX_DOTS);
  const overflowCount = assignments.length - MAX_DOTS;
  const borderClass = isOtherMonth
    ? 'border border-transparent'
    : state === 'today'
      ? 'border-2 border-dashed border-primary'
      : 'border border-slate-200 dark:border-slate-700/40';

  return (
    <Pressable
      className={`h-14 w-full items-center justify-start gap-1 rounded-md pt-1 ${borderClass}`}
      nativeID={`aggregated-calendar-day-${date.dateString}`}
      onPress={() => { if (!isOtherMonth) onPress(date.dateString); }}
      style={{ opacity: closed ? 0.7 : 1 }}
      testID={`aggregated-calendar-day-${date.dateString}`}
    >
      <Text
        className={`text-sm ${isOtherMonth ? 'text-slate-300 dark:text-slate-600' : state === 'today' ? 'font-bold text-primary' : 'text-slate-700 dark:text-slate-200'}`}
        nativeID={`aggregated-calendar-day-${date.dateString}-label`}
        testID={`aggregated-calendar-day-${date.dateString}-label`}
      >
        {date.day}
      </Text>
      {hasAssignments && (
        <View
          className="flex-row items-center gap-0.5"
          nativeID={`aggregated-calendar-day-${date.dateString}-dots`}
          testID={`aggregated-calendar-day-${date.dateString}-dots`}
        >
          {visibleDots.map((assignment, i) => (
            assignment.isPresencial ? (
              <MaterialCommunityIcons color={colors.primary} key={assignment.id} name="map-marker" size={10} />
            ) : (
              <View
                key={assignment.id}
                nativeID={`aggregated-calendar-day-${date.dateString}-dot-${i}`}
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: KIND_DOT_COLORS[assignment.kind] }}
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
}

export function AggregatedMonthView({ currentMonthISO, year, month, daysByDate, onMonthChange, onDayPress, showCollisions, loading }) {
  const colors = useThemeColors();
  const { colorScheme } = useThemeMode();

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
          dayComponent={({ date, state }) => (
            <AggregatedDayCell
              assignments={daysByDate[date.dateString] ?? []}
              date={date}
              onPress={onDayPress}
              showCollisions={showCollisions}
              state={state}
            />
          )}
          firstDay={1}
          onMonthChange={(m) => onMonthChange(m.year, m.month)}
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
}
