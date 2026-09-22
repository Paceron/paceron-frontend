import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import '../../config/calendarLocale.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useGroups } from '../../hooks/use-groups.js';
import { useGroupCalendar, useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { canAddToSelection } from '../../utils/calendar-selection.js';
import { StampPlanModal } from './stamp-plan-modal.jsx';
import { ShiftDayModal } from './shift-day-modal.jsx';
import { CalendarDayMenu } from './calendar-day-menu.jsx';
import { BulkEditDaysModal } from './bulk-edit-days-modal.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
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

function CalendarDayCell({ date, state, marking, containerRef, onOpenMenu, isMenuOpen, selectionActive, selectionClosedClass, selected, onToggleSelect }) {
  const colors = useThemeColors();
  const cellRef = useRef(null);
  const isOtherMonth = state === 'disabled';
  const closed = marking ? isCalendarDayClosed(date.dateString, marking) : false;
  // Estado de "cerrado" para la REGLA DE SELECCIÓN — a diferencia de
  // `closed` de arriba (que solo importa para el tinte y siempre da
  // false en un día vacío), acá sí necesitamos el valor real incluso sin
  // contenido: un día vacío del mes pasado igual cuenta como "cerrado" a
  // los fines de no mezclarlo con una selección de días futuros.
  const closedForSelection = isCalendarDayClosed(date.dateString, marking ?? {});
  const canSelect = !selectionActive || selected || canAddToSelection(selectionClosedClass, closedForSelection);
  // Tinte leve de fondo por kind — ayuda a ubicar de un vistazo qué tipo
  // de día es sin tener que fijarse en el puntito. Alpha en hex (últimos
  // 2 dígitos) en vez de un color plano — funciona igual en claro/oscuro
  // sin necesitar una paleta de tinte aparte por tema.
  const tintAlpha = closed ? '14' : '26';
  const tintColor = marking ? `${KIND_DOT_COLORS[marking.kind]}${tintAlpha}` : 'transparent';

  const handlePress = () => {
    if (selectionActive) {
      if (!canSelect) return;
      onToggleSelect(date.dateString);
      return;
    }
    if (!containerRef.current || !cellRef.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      cellRef.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu(date.dateString, { x: x - containerX, y: y - containerY, width, height });
      });
    });
  };

  const borderClass = selected ? 'border-2 border-primary' : isMenuOpen ? 'border border-primary' : 'border border-transparent';

  return (
    <Pressable
      ref={cellRef}
      className={`h-14 w-full items-center justify-start gap-1 rounded-md pt-1 ${borderClass}`}
      nativeID={`group-calendar-day-${date.dateString}`}
      onPress={handlePress}
      style={{ backgroundColor: tintColor, opacity: selectionActive && !canSelect ? 0.35 : 1 }}
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
      {closedForSelection && !isOtherMonth && (
        <View
          className="absolute right-1 top-1"
          nativeID={`group-calendar-day-${date.dateString}-closed-badge`}
          style={{ opacity: 0.55 }}
          testID={`group-calendar-day-${date.dateString}-closed-badge`}
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="lock-outline" size={9} />
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
  const [stampTargetDate, setStampTargetDate] = useState(null);
  const [shiftTargetDate, setShiftTargetDate] = useState(null);
  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading: loadingDays, isFetching } = useGroupCalendar(groupId, from, to);
  const { deleteDay, bulkClear, isBulkClearing } = useGroupCalendarMutations(groupId);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;
  const screenRootRef = useRef(null);
  const [openDayMenu, setOpenDayMenu] = useState(null);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [selectionClosedClass, setSelectionClosedClass] = useState(null);
  const [bulkEditModalVisible, setBulkEditModalVisible] = useState(false);
  const selectionActive = selectedDates.size > 0;

  const markingsByDate = useMemo(
    () => Object.fromEntries(days.map((d) => [d.date, { kind: d.kind, isPresencial: d.isPresencial, presencialTimeFrom: d.presencialTimeFrom }])),
    [days],
  );

  const handleOpenDayMenu = (dateString, anchor) => {
    setOpenDayMenu({ date: dateString, anchor });
  };

  const handleCloseDayMenu = () => setOpenDayMenu(null);

  const handleAssignOrEdit = () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date}`);
  };

  const handleClearDay = async () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    const result = await deleteDay({ date });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos vaciar el día', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Día vaciado' });
  };

  const handleCancelSession = () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date}?action=cancel`);
  };

  const handleSelectDay = () => {
    const date = openDayMenu.date;
    const marking = markingsByDate[date];
    handleCloseDayMenu();
    setSelectedDates(new Set([date]));
    setSelectionClosedClass(isCalendarDayClosed(date, marking ?? {}));
  };

  const handleStampFromDay = () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    setStampTargetDate(date);
  };

  const handleShiftFromDay = () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    setShiftTargetDate(date);
  };

  const handleToggleDaySelection = (date) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      if (next.size === 0) setSelectionClosedClass(null);
      return next;
    });
  };

  const handleExitSelection = () => {
    setSelectedDates(new Set());
    setSelectionClosedClass(null);
  };

  const handleBulkClear = async () => {
    const dates = Array.from(selectedDates);
    handleExitSelection();
    const result = await bulkClear({ dates });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos vaciar los días', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: `${dates.length} día${dates.length === 1 ? '' : 's'} vaciados` });
  };

  const openMarking = openDayMenu ? markingsByDate[openDayMenu.date] : null;
  const openClosed = openDayMenu && openMarking ? isCalendarDayClosed(openDayMenu.date, openMarking) : false;

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
    <View className="relative flex-1 bg-paper dark:bg-ink" nativeID="group-calendar-screen-root" ref={screenRootRef} testID="group-calendar-screen-root">
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
          {selectionActive ? (
            <View className="ml-auto flex-row items-center gap-2" nativeID="group-calendar-screen-selection-bar" testID="group-calendar-screen-selection-bar">
              <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID="group-calendar-screen-selection-count" testID="group-calendar-screen-selection-count">
                {selectedDates.size} seleccionado{selectedDates.size === 1 ? '' : 's'}
              </Text>
              <Pressable
                accessibilityLabel="Vaciar en lote"
                className={`h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${selectionClosedClass === true ? 'opacity-40' : ''}`}
                disabled={selectionClosedClass === true || isBulkClearing}
                nativeID="group-calendar-screen-bulk-clear-button"
                onPress={handleBulkClear}
                testID="group-calendar-screen-bulk-clear-button"
              >
                <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="Editar en lote"
                className={`h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${selectionClosedClass === true ? 'opacity-40' : ''}`}
                disabled={selectionClosedClass === true}
                nativeID="group-calendar-screen-bulk-edit-button"
                onPress={() => setBulkEditModalVisible(true)}
                testID="group-calendar-screen-bulk-edit-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="Salir de selección"
                className="h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                nativeID="group-calendar-screen-selection-exit-button"
                onPress={handleExitSelection}
                testID="group-calendar-screen-selection-exit-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View
          className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-surface"
          nativeID="group-calendar-month-view"
          testID="group-calendar-month-view"
        >
          <Calendar
            current={currentMonthISO}
            dayComponent={({ date, state }) => (
              <CalendarDayCell
                containerRef={screenRootRef}
                date={date}
                isMenuOpen={openDayMenu?.date === date.dateString}
                marking={markingsByDate[date.dateString]}
                onOpenMenu={handleOpenDayMenu}
                onToggleSelect={handleToggleDaySelection}
                selected={selectedDates.has(date.dateString)}
                selectionActive={selectionActive}
                selectionClosedClass={selectionClosedClass}
                state={state}
              />
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

      <AnimatedDropdown
        anchorStyle={openDayMenu ? { left: openDayMenu.anchor.x, top: openDayMenu.anchor.y + openDayMenu.anchor.height + 4 } : {}}
        onClose={handleCloseDayMenu}
        open={Boolean(openDayMenu)}
      >
        {openDayMenu && (
          <CalendarDayMenu
            closed={openClosed}
            hasContent={Boolean(openMarking)}
            isTraining={openMarking?.kind === 'training'}
            onAssignOrEdit={handleAssignOrEdit}
            onCancel={handleCancelSession}
            onClear={handleClearDay}
            onSelect={handleSelectDay}
            onShift={handleShiftFromDay}
            onStamp={handleStampFromDay}
          />
        )}
      </AnimatedDropdown>

      <StampPlanModal
        groupId={groupId}
        onClose={() => setStampTargetDate(null)}
        ownerId={userId}
        startDate={stampTargetDate}
        visible={Boolean(stampTargetDate)}
      />

      <ShiftDayModal
        fromDate={shiftTargetDate}
        groupId={groupId}
        onClose={() => setShiftTargetDate(null)}
        visible={Boolean(shiftTargetDate)}
      />

      <BulkEditDaysModal
        dates={Array.from(selectedDates)}
        groupId={groupId}
        onClose={() => setBulkEditModalVisible(false)}
        onSuccess={handleExitSelection}
        ownerId={userId}
        visible={bulkEditModalVisible}
      />
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
