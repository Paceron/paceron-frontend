import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useMemberCalendar, usePrefetchAdjacentCalendars } from '../../hooks/use-aggregated-calendar.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { monthRange, pad2 } from '../../utils/calendar-month-range.js';
import { upcomingTrainingsRange, selectUpcomingTrainings } from '../../utils/upcoming-trainings.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { AggregatedMonthView } from './aggregated-month-view.jsx';
import { DayDetailModal } from './day-detail-modal.jsx';
import { UpcomingTrainingsGrid } from './upcoming-trainings-grid.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

function MyCalendarScreenContent() {
  const router = useRouter();
  const { date: deepLinkDate } = useLocalSearchParams();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const isNarrowWeb = useIsNarrowWeb();
  const stackFilter = !isWeb || isNarrowWeb;
  const userId = useAuthStore((s) => s.userId);

  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [filterTeamId, setFilterTeamId] = useState('');
  const [openDate, setOpenDate] = useState(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const appliedDeepLinkRef = useRef(false);

  const openDayModal = (date) => {
    setOpenDate(date);
    setDayModalVisible(true);
  };

  useEffect(() => {
    if (!deepLinkDate || appliedDeepLinkRef.current) return;
    appliedDeepLinkRef.current = true;
    const [year, month] = deepLinkDate.split('-').map(Number);
    setVisibleYear(year);
    setVisibleMonth(month);
    openDayModal(deepLinkDate);
  }, [deepLinkDate]);

  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading, isFetching } = useMemberCalendar(userId, from, to);
  usePrefetchAdjacentCalendars('member', userId, visibleYear, visibleMonth);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;

  const { from: upcomingFrom, to: upcomingTo } = useMemo(() => upcomingTrainingsRange(), []);
  const { days: upcomingDaysRaw, loading: upcomingLoading, isFetching: upcomingIsFetching } = useMemberCalendar(userId, upcomingFrom, upcomingTo);
  const upcomingTrainings = useMemo(() => selectUpcomingTrainings(upcomingDaysRaw), [upcomingDaysRaw]);

  // Un usuario está en un único grupo por equipo a la vez — el primer día
  // visto de cada equipo alcanza para resolver su grupo correspondiente.
  // Se deriva del mes visible (no de calendar-summary, que no trae
  // team_id/team_name) — un equipo sin ningún día asignado este mes no
  // aparece en el filtro hasta que tenga contenido en algún mes.
  const teamOptions = useMemo(() => {
    const map = new Map();
    for (const day of days) {
      if (!map.has(day.teamId)) map.set(day.teamId, { teamId: day.teamId, teamName: day.teamName, groupName: day.groupName });
    }
    return Array.from(map.values());
  }, [days]);
  const selectedTeam = teamOptions.find((t) => t.teamId === filterTeamId) ?? null;

  const filteredDays = useMemo(
    () => (filterTeamId ? days.filter((d) => d.teamId === filterTeamId) : days),
    [days, filterTeamId],
  );

  const filteredUpcomingTrainings = useMemo(
    () => (filterTeamId ? upcomingTrainings.filter((t) => t.teamId === filterTeamId) : upcomingTrainings),
    [upcomingTrainings, filterTeamId],
  );

  const daysByDate = useMemo(() => {
    const map = {};
    for (const day of filteredDays) {
      map[day.date] = [...(map[day.date] ?? []), day];
    }
    return map;
  }, [filteredDays]);

  const openAssignments = openDate ? daysByDate[openDate] ?? [] : [];

  const { refreshing, onRefresh } = usePullToRefresh(() => (
    queryClient.invalidateQueries({ queryKey: ['member-calendar', userId] })
  ));

  return (
    <View className="flex-1" nativeID="my-calendar-screen-root" testID="my-calendar-screen-root">
      <ScrollView
        className="flex-1 bg-paper dark:bg-ink"
        contentContainerClassName="px-4 py-8"
        nativeID="my-calendar-screen-scroll"
        refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
        showsVerticalScrollIndicator={false}
        testID="my-calendar-screen-scroll"
      >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="my-calendar-screen-container" testID="my-calendar-screen-container">
        <View className="mb-6 flex-row flex-wrap items-center gap-2" nativeID="my-calendar-screen-header" testID="my-calendar-screen-header">
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
        </View>

        {teamOptions.length > 0 && (
          <View className={`mb-4 gap-2 ${stackFilter ? '' : 'flex-row items-center'}`} nativeID="my-calendar-screen-filter" testID="my-calendar-screen-filter">
            <View className={stackFilter ? 'w-full' : 'w-full max-w-xs'} nativeID="my-calendar-screen-filter-team-wrapper" testID="my-calendar-screen-filter-team-wrapper">
              <ResponsiveSelectField
                dense
                hideErrorRow
                label="Equipo"
                onChange={setFilterTeamId}
                options={teamOptions.map((t) => ({ id: t.teamId, name: t.teamName }))}
                placeholder="Todos los equipos"
                value={filterTeamId}
              />
            </View>
            {selectedTeam && (
              <View className="flex-row items-center gap-1" nativeID="my-calendar-screen-filter-group-label-wrapper" testID="my-calendar-screen-filter-group-label-wrapper">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={16} />
                <Text
                  className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                  nativeID="my-calendar-screen-filter-group-label"
                  testID="my-calendar-screen-filter-group-label"
                >
                  Grupo: {selectedTeam.groupName}
                </Text>
              </View>
            )}
          </View>
        )}

        <AggregatedMonthView
          currentMonthISO={currentMonthISO}
          daysByDate={daysByDate}
          loading={loading || isFetching}
          month={visibleMonth}
          onDayPress={openDayModal}
          onMonthChange={(year, month) => { setVisibleYear(year); setVisibleMonth(month); }}
          showCollisions={false}
          year={visibleYear}
        />

        <UpcomingTrainingsGrid isFetching={upcomingIsFetching} loading={upcomingLoading} trainings={filteredUpcomingTrainings} variant="member" />
      </View>
      </ScrollView>

      <DayDetailModal assignments={openAssignments} date={openDate ?? ''} loading={loading} onClose={() => setDayModalVisible(false)} variant="member" visible={dayModalVisible} />
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
