import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useAdministeredCalendar, usePrefetchAdjacentCalendars } from '../../hooks/use-aggregated-calendar.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { monthRange, pad2 } from '../../utils/calendar-month-range.js';
import { upcomingTrainingsRange, selectUpcomingTrainings } from '../../utils/upcoming-trainings.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { SectionTabBar } from '../shared/section-tab-bar.jsx';
import { FilterPanel } from '../shared/filter-panel.jsx';
import { AggregatedMonthView } from './aggregated-month-view.jsx';
import { DayDetailModal } from './day-detail-modal.jsx';
import { UpcomingTrainingsGrid } from './upcoming-trainings-grid.jsx';
import { TrainingsHistoryTab } from './trainings-history-tab.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

const TRAININGS_TABS = [
  { id: 'calendario', label: 'Calendario', icon: 'calendar-month-outline' },
  { id: 'historial', label: 'Historial', icon: 'history' },
];

function AdministeredCalendarScreenContent() {
  const router = useRouter();
  const { date: deepLinkDate } = useLocalSearchParams();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);

  const today = new Date();
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const [openDate, setOpenDate] = useState(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('calendario');
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
    setActiveTab('calendario');
    openDayModal(deepLinkDate);
  }, [deepLinkDate]);

  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading, isFetching } = useAdministeredCalendar(userId, from, to);
  usePrefetchAdjacentCalendars('administered', userId, visibleYear, visibleMonth);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;

  const { from: upcomingFrom, to: upcomingTo } = useMemo(() => upcomingTrainingsRange(), []);
  const { days: upcomingDaysRaw, loading: upcomingLoading, isFetching: upcomingIsFetching } = useAdministeredCalendar(userId, upcomingFrom, upcomingTo);
  const upcomingTrainings = useMemo(() => selectUpcomingTrainings(upcomingDaysRaw), [upcomingDaysRaw]);

  // A diferencia del corredor, un entrenador puede administrar más de un
  // grupo por equipo — el select de grupo queda anidado al de equipo,
  // derivados los dos del mes visible (misma limitación que el filtro del
  // corredor: un equipo/grupo sin días este mes no aparece hasta que
  // tenga contenido en algún mes).
  const teamOptions = useMemo(() => {
    const map = new Map();
    for (const day of days) {
      if (!map.has(day.teamId)) map.set(day.teamId, { teamId: day.teamId, teamName: day.teamName });
    }
    return Array.from(map.values());
  }, [days]);
  const groupOptions = useMemo(() => {
    if (!filterTeamId) return [];
    const map = new Map();
    for (const day of days) {
      if (day.teamId === filterTeamId && !map.has(day.groupId)) map.set(day.groupId, { groupId: day.groupId, groupName: day.groupName });
    }
    return Array.from(map.values());
  }, [days, filterTeamId]);

  const handleTeamChange = (teamId) => {
    setFilterTeamId(teamId);
    setFilterGroupId('');
  };

  const filteredDays = useMemo(() => {
    let result = days;
    if (filterTeamId) result = result.filter((d) => d.teamId === filterTeamId);
    if (filterGroupId) result = result.filter((d) => d.groupId === filterGroupId);
    return result;
  }, [days, filterTeamId, filterGroupId]);

  const filteredUpcomingTrainings = useMemo(() => {
    let result = upcomingTrainings;
    if (filterTeamId) result = result.filter((t) => t.teamId === filterTeamId);
    if (filterGroupId) result = result.filter((t) => t.groupId === filterGroupId);
    return result;
  }, [upcomingTrainings, filterTeamId, filterGroupId]);

  const daysByDate = useMemo(() => {
    const map = {};
    for (const day of filteredDays) {
      map[day.date] = [...(map[day.date] ?? []), day];
    }
    return map;
  }, [filteredDays]);

  const openAssignments = openDate ? daysByDate[openDate] ?? [] : [];

  const { refreshing, onRefresh } = usePullToRefresh(() => (
    queryClient.invalidateQueries({ queryKey: ['administered-calendar', userId] })
  ));

  return (
    <View className="flex-1" nativeID="administered-calendar-screen-root" testID="administered-calendar-screen-root">
      <ScrollView
        className="flex-1 bg-paper dark:bg-ink"
        contentContainerClassName="px-4 py-8"
        nativeID="administered-calendar-screen-scroll"
        refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
        showsVerticalScrollIndicator={false}
        testID="administered-calendar-screen-scroll"
      >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="administered-calendar-screen-container" testID="administered-calendar-screen-container">
        <View className="mb-6 flex-row flex-wrap items-center gap-2" nativeID="administered-calendar-screen-header" testID="administered-calendar-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="administered-calendar-screen-back-button"
            onPress={() => router.back()}
            testID="administered-calendar-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="administered-calendar-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="administered-calendar-screen-title">
            Entrenamientos
          </Text>
        </View>

        <SectionTabBar active={activeTab} idPrefix="administered-calendar-screen" onChange={setActiveTab} tabs={TRAININGS_TABS} />

        {activeTab === 'calendario' && (
          <>
            <FilterPanel hasActiveFilters={Boolean(filterTeamId || filterGroupId)} idPrefix="administered-calendar-screen-filter" loading={loading} onClear={() => { setFilterTeamId(''); setFilterGroupId(''); }}>
              <View className="flex-1" nativeID="administered-calendar-screen-filter-team-wrapper" testID="administered-calendar-screen-filter-team-wrapper">
                <ResponsiveSelectField
                  dense
                  disabled={teamOptions.length === 0}
                  hideErrorRow
                  label="Equipo"
                  onChange={handleTeamChange}
                  options={teamOptions.map((t) => ({ id: t.teamId, name: t.teamName }))}
                  placeholder="Todos los equipos"
                  value={filterTeamId}
                />
              </View>
              <View className="flex-1" nativeID="administered-calendar-screen-filter-group-wrapper" testID="administered-calendar-screen-filter-group-wrapper">
                <ResponsiveSelectField
                  dense
                  disabled={!filterTeamId || groupOptions.length === 0}
                  hideErrorRow
                  label="Grupo"
                  onChange={setFilterGroupId}
                  options={groupOptions.map((g) => ({ id: g.groupId, name: g.groupName }))}
                  placeholder="Todos los grupos"
                  value={filterGroupId}
                />
              </View>
            </FilterPanel>

            <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="administered-calendar-screen-calendar-section-title" testID="administered-calendar-screen-calendar-section-title">
              Calendario
            </Text>

            <AggregatedMonthView
              currentMonthISO={currentMonthISO}
              daysByDate={daysByDate}
              loading={loading || isFetching}
              month={visibleMonth}
              onDayPress={openDayModal}
              onMonthChange={(year, month) => { setVisibleYear(year); setVisibleMonth(month); }}
              showCollisions
              year={visibleYear}
            />

            <UpcomingTrainingsGrid isFetching={upcomingIsFetching} loading={upcomingLoading} trainings={filteredUpcomingTrainings} variant="administered" />
          </>
        )}

        {activeTab === 'historial' && <TrainingsHistoryTab />}
      </View>
      </ScrollView>

      <DayDetailModal assignments={openAssignments} date={openDate ?? ''} loading={loading} onClose={() => setDayModalVisible(false)} variant="administered" visible={dayModalVisible} />
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
