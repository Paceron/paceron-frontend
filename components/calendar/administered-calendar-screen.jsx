import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useAdministeredCalendar } from '../../hooks/use-aggregated-calendar.js';
import { monthRange, pad2 } from '../../utils/calendar-month-range.js';
import { AggregatedMonthView } from './aggregated-month-view.jsx';
import { DayDetailModal } from './day-detail-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function AdministeredCalendarScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);

  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [openDate, setOpenDate] = useState(null);

  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading, isFetching } = useAdministeredCalendar(userId, from, to);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;

  const daysByDate = useMemo(() => {
    const map = {};
    for (const day of days) {
      map[day.date] = [...(map[day.date] ?? []), day];
    }
    return map;
  }, [days]);

  const openAssignments = openDate ? daysByDate[openDate] ?? [] : [];

  return (
    <View className="flex-1 bg-paper dark:bg-ink" nativeID="administered-calendar-screen-root" testID="administered-calendar-screen-root">
      <View className={`w-full flex-1 self-center px-4 py-8 ${isWeb ? 'max-w-3xl' : ''}`} nativeID="administered-calendar-screen-container" testID="administered-calendar-screen-container">
        <View className="mb-6 flex-row items-center gap-2" nativeID="administered-calendar-screen-header" testID="administered-calendar-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="administered-calendar-screen-back-button"
            onPress={() => router.back()}
            testID="administered-calendar-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="administered-calendar-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="administered-calendar-screen-title">
            Calendario
          </Text>
          {(loading || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="administered-calendar-screen-fetching" size="small" testID="administered-calendar-screen-fetching" />
          )}
        </View>

        <AggregatedMonthView
          currentMonthISO={currentMonthISO}
          daysByDate={daysByDate}
          onDayPress={setOpenDate}
          onMonthChange={(year, month) => { setVisibleYear(year); setVisibleMonth(month); }}
          showCollisions
        />
      </View>

      <DayDetailModal assignments={openAssignments} date={openDate ?? ''} onClose={() => setOpenDate(null)} variant="administered" visible={Boolean(openDate)} />
    </View>
  );
}

export function AdministeredCalendarScreen() {
  return (
    <RequireAuth>
      <AdministeredCalendarScreenContent />
    </RequireAuth>
  );
}
