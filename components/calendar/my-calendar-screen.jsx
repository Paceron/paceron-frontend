import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useMemberCalendar, useCalendarSummary } from '../../hooks/use-aggregated-calendar.js';
import { monthRange, pad2 } from '../../utils/calendar-month-range.js';
import { AggregatedMonthView } from './aggregated-month-view.jsx';
import { DayDetailModal } from './day-detail-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function MyCalendarScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);

  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [filterGroupId, setFilterGroupId] = useState(null);
  const [openDate, setOpenDate] = useState(null);

  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading, isFetching } = useMemberCalendar(userId, from, to);
  const { groups } = useCalendarSummary(userId);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;

  const filteredDays = useMemo(
    () => (filterGroupId ? days.filter((d) => d.groupId === filterGroupId) : days),
    [days, filterGroupId],
  );

  const daysByDate = useMemo(() => {
    const map = {};
    for (const day of filteredDays) {
      map[day.date] = [...(map[day.date] ?? []), day];
    }
    return map;
  }, [filteredDays]);

  const openAssignments = openDate ? daysByDate[openDate] ?? [] : [];

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="my-calendar-screen-root" testID="my-calendar-screen-root">
      <View className={`w-full flex-1 self-center px-4 py-8 ${isWeb ? 'max-w-3xl' : ''}`} nativeID="my-calendar-screen-container" testID="my-calendar-screen-container">
        <View className="mb-6 flex-row items-center gap-2" nativeID="my-calendar-screen-header" testID="my-calendar-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="my-calendar-screen-back-button"
            onPress={() => router.back()}
            testID="my-calendar-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="my-calendar-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="my-calendar-screen-title">
            Mi calendario
          </Text>
          {(loading || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="my-calendar-screen-fetching" size="small" testID="my-calendar-screen-fetching" />
          )}
        </View>

        {groups.length > 0 && (
          <ScrollView horizontal className="mb-4" nativeID="my-calendar-screen-filter-scroll" showsHorizontalScrollIndicator={false} testID="my-calendar-screen-filter-scroll">
            <View className="flex-row gap-2" nativeID="my-calendar-screen-filter-chips" testID="my-calendar-screen-filter-chips">
              <Pressable
                className={`h-8 items-center justify-center rounded-full px-3 ${filterGroupId === null ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'}`}
                nativeID="my-calendar-screen-filter-all"
                onPress={() => setFilterGroupId(null)}
                testID="my-calendar-screen-filter-all"
              >
                <Text className={`text-xs font-semibold ${filterGroupId === null ? 'text-[#111518]' : 'text-slate-600 dark:text-slate-300'}`} nativeID="my-calendar-screen-filter-all-label" testID="my-calendar-screen-filter-all-label">
                  Todos
                </Text>
              </Pressable>
              {groups.map((group) => (
                <Pressable
                  className={`h-8 items-center justify-center rounded-full px-3 ${filterGroupId === group.id ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'}`}
                  key={group.id}
                  nativeID={`my-calendar-screen-filter-${group.id}`}
                  onPress={() => setFilterGroupId(group.id)}
                  testID={`my-calendar-screen-filter-${group.id}`}
                >
                  <Text
                    className={`text-xs font-semibold ${filterGroupId === group.id ? 'text-[#111518]' : 'text-slate-600 dark:text-slate-300'}`}
                    nativeID={`my-calendar-screen-filter-${group.id}-label`}
                    testID={`my-calendar-screen-filter-${group.id}-label`}
                  >
                    {group.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <AggregatedMonthView
          currentMonthISO={currentMonthISO}
          daysByDate={daysByDate}
          onDayPress={setOpenDate}
          onMonthChange={(year, month) => { setVisibleYear(year); setVisibleMonth(month); }}
          showCollisions={false}
        />
      </View>

      <DayDetailModal assignments={openAssignments} date={openDate ?? ''} onClose={() => setOpenDate(null)} variant="member" visible={Boolean(openDate)} />
    </View>
  );
}

export function MyCalendarScreen() {
  return (
    <RequireAuth>
      <MyCalendarScreenContent />
    </RequireAuth>
  );
}
