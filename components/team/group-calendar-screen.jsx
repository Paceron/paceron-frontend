import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import '../../config/calendarLocale.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useGroups } from '../../hooks/use-groups.js';
import { useGroupCalendar } from '../../hooks/use-group-calendar.js';
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { StampPlanModal } from './stamp-plan-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

const KIND_DOT_COLORS = { rest: '#94a3b8', other: '#f59e0b', training: '#22c55e', cancelled: '#ef4444' };

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthRange(year, month) {
  const from = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { from, to };
}

function CalendarDayCell({ date, state, marking, onPress }) {
  const colors = useThemeColors();
  const isOtherMonth = state === 'disabled';
  const closed = marking ? isCalendarDayClosed(date.dateString, marking) : false;
  // Tinte leve de fondo por kind — ayuda a ubicar de un vistazo qué tipo
  // de día es sin tener que fijarse en el puntito. Alpha en hex (últimos
  // 2 dígitos) en vez de un color plano — funciona igual en claro/oscuro
  // sin necesitar una paleta de tinte aparte por tema.
  const tintAlpha = closed ? '14' : '26';
  const tintColor = marking ? `${KIND_DOT_COLORS[marking.kind]}${tintAlpha}` : 'transparent';
  return (
    <Pressable
      className="h-14 w-full items-center justify-start gap-1 rounded-md pt-1"
      nativeID={`group-calendar-day-${date.dateString}`}
      onPress={() => onPress(date)}
      style={{ backgroundColor: tintColor }}
      testID={`group-calendar-day-${date.dateString}`}
    >
      <Text
        className={`text-sm ${isOtherMonth ? 'text-slate-300 dark:text-slate-600' : state === 'today' ? 'font-bold text-primary' : 'text-slate-700 dark:text-slate-200'}`}
        nativeID={`group-calendar-day-${date.dateString}-label`}
        testID={`group-calendar-day-${date.dateString}-label`}
      >
        {date.day}
      </Text>
      {marking && (
        <View
          className="flex-row items-center gap-0.5"
          nativeID={`group-calendar-day-${date.dateString}-marks`}
          style={{ opacity: closed ? 0.45 : 1 }}
          testID={`group-calendar-day-${date.dateString}-marks`}
        >
          <View
            nativeID={`group-calendar-day-${date.dateString}-dot`}
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: KIND_DOT_COLORS[marking.kind] }}
            testID={`group-calendar-day-${date.dateString}-dot`}
          />
          {marking.isPresencial && <MaterialCommunityIcons color={colors.primary} name="map-marker" size={10} />}
        </View>
      )}
    </Pressable>
  );
}

function GroupCalendarScreenContent({ teamId, groupId }) {
  const router = useRouter();
  const colors = useThemeColors();
  // userId sale directo del auth store (sincrónico) en vez de esperar
  // useUser(userId) — evita una vuelta de red extra antes de poder
  // arrancar el fetch de grupos, mismo valor (ver store/auth-store.js).
  const userId = useAuthStore((s) => s.userId);
  const { groups, loading: loadingGroups } = useGroups(teamId, userId);
  const group = groups.find((g) => g.id === groupId);

  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [stampModalVisible, setStampModalVisible] = useState(false);
  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading: loadingDays, isFetching } = useGroupCalendar(groupId, from, to);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;

  const markingsByDate = useMemo(
    () => Object.fromEntries(days.map((d) => [d.date, { kind: d.kind, isPresencial: d.isPresencial, presencialTimeFrom: d.presencialTimeFrom }])),
    [days],
  );

  const handleDayPress = (date) => {
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date.dateString}`);
  };

  // Nunca desmontar el <Calendar> por loading — react-native-calendars
  // no es controlado por default, así que desmontarlo y volver a montarlo
  // le hace perder la navegación y vuelve siempre al mes actual (bug real
  // reportado). `current` (controlado por nuestro propio estado) blinda
  // la posición incluso si algo lo remonta igual.
  if (!loadingGroups && !group) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="group-calendar-not-found" testID="group-calendar-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="group-calendar-not-found-label" testID="group-calendar-not-found-label">
          No encontramos este grupo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="group-calendar-not-found-back-button"
          onPress={() => router.back()}
          testID="group-calendar-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-not-found-back-button-label" testID="group-calendar-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="group-calendar-screen-root" testID="group-calendar-screen-root">
      <View className={`w-full flex-1 self-center px-4 py-8 ${isWeb ? 'max-w-3xl' : ''}`} nativeID="group-calendar-screen-container" testID="group-calendar-screen-container">
        <View className="mb-6 flex-row items-center gap-2" nativeID="group-calendar-screen-header" testID="group-calendar-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="group-calendar-screen-back-button"
            onPress={() => router.back()}
            testID="group-calendar-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="group-calendar-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="group-calendar-screen-title">
            Calendario de {group?.name ?? '...'}
          </Text>
          {(loadingDays || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="group-calendar-screen-fetching" size="small" testID="group-calendar-screen-fetching" />
          )}
          <Pressable
            className="ml-auto h-9 flex-row items-center gap-1.5 rounded-full bg-primary px-3 hover:opacity-90 active:opacity-80"
            nativeID="group-calendar-screen-stamp-button"
            onPress={() => setStampModalVisible(true)}
            testID="group-calendar-screen-stamp-button"
          >
            <MaterialCommunityIcons color="#111518" name="stamper" size={16} />
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-screen-stamp-button-label" testID="group-calendar-screen-stamp-button-label">
              Estampar plan
            </Text>
          </Pressable>
        </View>

        <View
          className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-surface"
          nativeID="group-calendar-month-view"
          testID="group-calendar-month-view"
        >
          <Calendar
            current={currentMonthISO}
            dayComponent={({ date, state }) => (
              <CalendarDayCell date={date} marking={markingsByDate[date.dateString]} onPress={handleDayPress} state={state} />
            )}
            firstDay={1}
            onMonthChange={(month) => { setVisibleYear(month.year); setVisibleMonth(month.month); }}
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
        </View>
      </View>

      <StampPlanModal groupId={groupId} onClose={() => setStampModalVisible(false)} ownerId={userId} visible={stampModalVisible} />
    </View>
  );
}

export function GroupCalendarScreen({ teamId, groupId }) {
  return (
    <RequireAuth>
      <GroupCalendarScreenContent teamId={teamId} groupId={groupId} />
    </RequireAuth>
  );
}
