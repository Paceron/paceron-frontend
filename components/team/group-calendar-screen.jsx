import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar } from 'react-native-calendars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import '../../config/calendarLocale.js';
import { computeTodayIso } from '../../utils/calendar-today.js';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useGroups } from '../../hooks/use-groups.js';
import { usePermissions } from '../../hooks/use-user.js';
import { useGroupCalendar, useGroupCalendarMutations, usePrefetchAdjacentGroupCalendar } from '../../hooks/use-group-calendar.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { canAddToSelection } from '../../utils/calendar-selection.js';
import { KIND_DOT_COLORS } from '../../utils/calendar-kind-colors.js';
import { summarizeMonthDays } from '../../utils/calendar-month-summary.js';
import { monthRange, pad2 } from '../../utils/calendar-month-range.js';
import { CalendarKindLegend } from '../calendar/calendar-kind-legend.jsx';
import { StampPlanModal } from './stamp-plan-modal.jsx';
import { ShiftDayModal } from './shift-day-modal.jsx';
import { CalendarDayMenu } from './calendar-day-menu.jsx';
import { BulkEditDaysModal } from './bulk-edit-days-modal.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { CalendarMonthYearHeader } from '../calendar/calendar-month-year-header.jsx';
import { CalendarFadeIn } from '../calendar/calendar-fade-in.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { ScreenCard } from '../shared/screen-card.jsx';

// Mismos ids/iconos que TABS en training-plans-screen.jsx -- ahí es donde
// `?tab=` termina resolviendo.
const CATALOG_QUICK_LINKS = [
  { id: 'planes', label: 'Planes', icon: 'clipboard-text-outline' },
  { id: 'sesiones', label: 'Sesiones', icon: 'clipboard-plus-outline' },
  { id: 'ejercicios', label: 'Ejercicios', icon: 'dumbbell' },
];

// Celda rellena (hay `marking`, día ni hoy ni seleccionado ni con el menú
// abierto -- esos tres ya tienen su propio tratamiento, sin tocar) --
// color sólido alusivo al kind, borde más claro que el relleno para
// marcar que está ocupada (pedido real 2026-11-09). Vacía sigue igual que
// siempre (border-slate-200/bg-slate-100, en el branch default de abajo).
const KIND_FILLED_CLASS = {
  training: 'border-green-200 bg-green-400 dark:border-green-400 dark:bg-green-600',
  rest: 'border-slate-300 bg-slate-400 dark:border-slate-400 dark:bg-slate-500',
  other: 'border-amber-200 bg-amber-400 dark:border-amber-400 dark:bg-amber-600',
  cancelled: 'border-red-200 bg-red-400 dark:border-red-400 dark:bg-red-600',
};

function CalendarDayCell({ date, state, isToday, marking, containerRef, onOpenMenu, isMenuOpen, selectionActive, selectionClosedClass, selected, onToggleSelect, canManage }) {
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
  // Mismo tratamiento que el resto de los estados especiales (today/
  // selected/menú abierto): ninguno de esos se toca, solo el día "plano"
  // (sin ningún estado especial) se parte en vacío/relleno.
  const isPlainFilledDay = Boolean(marking) && !isOtherMonth && !selected && !isMenuOpen && !isToday;

  const handlePress = () => {
    if (!canManage || isOtherMonth) return;
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

  // `hoverFx` fijo en los 5 casos (presente/ausente siempre igual, mismo
  // orden) y cada rama declara SIEMPRE bg-* (nunca lo omite) -- antes
  // `selected`/`isOtherMonth` no declaraban ningún `bg-*` mientras las
  // otras tres sí, y `hover:`/`transition-all` aparecían solo en algunas
  // ramas. Con ~30-40 celdas montadas a la vez y `selected`/`isMenuOpen`
  // cambiando en vivo por toque, eso es el mismo bug de remount nativo que
  // `role-switch-toggle.jsx` (ver CLAUDE.md) pero multiplicado por celda.
  // `hover:animate-pulse` sacado (2026-11-10): mismo bug que
  // role-switch-toggle.jsx#Segment -- en touch el `:hover` queda pegado sin
  // `mouseleave`, y con ~30-40 celdas montadas la celda recién tocada
  // quedaba pulsando para siempre. `hover:bg-opacity-60`/`border-4` se
  // mantienen (un estado pegado sin loop no se nota tanto).
  const hoverFx = 'transition-all hover:border-4 hover:bg-opacity-60';
  const borderClass = isOtherMonth
    ? `${hoverFx} border-2 border-transparent bg-transparent`
    : selected
      ? `${hoverFx} border-4 border-primary bg-transparent`
      : isMenuOpen
        ? `${hoverFx} border-4 border-blue-200 bg-blue-100 dark:border-blue-600 dark:bg-blue-500`
        : isToday
          ? `${hoverFx} border-2 border-dashed border-primary bg-green-100 dark:bg-green-700 dark:hover:bg-opacity-60`
          : isPlainFilledDay
            ? `${hoverFx} border-2 ${KIND_FILLED_CLASS[marking.kind] ?? KIND_FILLED_CLASS.other} dark:hover:bg-opacity-60`
            : `${hoverFx} border-2 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-opacity-60`;

  return (
    <Pressable
      ref={cellRef}
      className={`h-14 w-full items-center justify-start p-1 gap-1 rounded-xl ${borderClass}`}
      nativeID={`group-calendar-day-${date.dateString}`}
      onPress={handlePress}
      style={{ opacity: selectionActive && !canSelect ? 0.35 : 1 }}
      testID={`group-calendar-day-${date.dateString}`}
    >
      <Text
        className={`text-sm ${isOtherMonth ? 'text-slate-300 dark:text-slate-600' : isToday ? 'font-bold text-primary' : 'text-slate-700 dark:text-slate-200'}`}
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
          {marking.isPresencial ? (
            // Blanco en el día relleno: el fondo ya quedó sólido del
            // color del kind (KIND_FILLED_CLASS más arriba) -- colors.primary
            // encima de eso (ej. un cancelled en rojo) perdía contraste o
            // desentonaba. En los demás estados (hoy/seleccionado/menú) el
            // fondo sigue siendo claro, así que el verde de marca sigue andando.
            <MaterialCommunityIcons color={isPlainFilledDay ? '#ffffff' : colors.primary} name="map-marker" size={10} />
          ) : (
            <View
              nativeID={`group-calendar-day-${date.dateString}-dot`}
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isPlainFilledDay ? '#ffffff' : KIND_DOT_COLORS[marking.kind] }}
              testID={`group-calendar-day-${date.dateString}-dot`}
            />
          )}
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
  const queryClient = useQueryClient();
  const { colorScheme } = useThemeMode();
  // userId sale directo del auth store (sincrónico) en vez de esperar
  // useUser(userId) — evita una vuelta de red extra antes de poder
  // arrancar el fetch de grupos, mismo valor (ver store/auth-store.js).
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles } = usePermissions(userId);
  // Mismo criterio que canManageTeam en team-detail-screen.jsx — no hay
  // modelo de dueño de equipo a nivel de UI todavía, cualquier usuario
  // viendo la app como entrenador activo puede administrar. No se
  // restringe más (a "administra ESTE grupo puntual") porque eso
  // requeriría resolver team.ownerId contra este grupo, dato no
  // disponible hoy sin una consulta extra — replica el criterio ya
  // vigente en el resto de la app en vez de inventar uno más estricto.
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  const canManage = hasTrainerRole && activeRole === 'trainer';
  const { groups, loading: loadingGroups } = useGroups(teamId, userId);
  const group = groups.find((g) => g.id === groupId);

  const today = new Date();
  const todayIso = computeTodayIso(today);
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [stampTargetDate, setStampTargetDate] = useState(null);
  const [shiftTargetDate, setShiftTargetDate] = useState(null);
  const { from, to } = useMemo(() => monthRange(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const { days, loading: loadingDays, isFetching } = useGroupCalendar(groupId, from, to);
  usePrefetchAdjacentGroupCalendar(groupId, visibleYear, visibleMonth);
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
  const monthCounts = useMemo(() => summarizeMonthDays(days), [days]);

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
    // handleExitSelection ya cerró el modo selección -- sin este toast
    // persistente, una operación de varios minutos (vaciar muchos días)
    // queda sin NINGÚN indicio visible de que sigue en curso (bug real
    // reportado, 2026-10-10). autoHide:false + Toast.hide() manual en vez
    // de un timeout fijo, porque no sabemos cuánto va a tardar.
    Toast.show({ type: 'info', text1: `Vaciando ${dates.length} día${dates.length === 1 ? '' : 's'}…`, text2: 'Puede demorar unos minutos.', autoHide: false });
    const result = await bulkClear({ dates });
    Toast.hide();
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

  const { refreshing, onRefresh } = usePullToRefresh(() => (
    queryClient.invalidateQueries({ queryKey: ['group-calendar', groupId] })
  ));

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
    <View className="relative flex-1" nativeID="group-calendar-screen-root" ref={screenRootRef} testID="group-calendar-screen-root">
      <ScrollView
        className="flex-1 bg-paper dark:bg-ink"
        contentContainerClassName="px-4 py-8"
        nativeID="group-calendar-screen-scroll"
        refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
        showsVerticalScrollIndicator={false}
        testID="group-calendar-screen-scroll"
      >
      <ScreenCard nativeID="group-calendar-screen-container" testID="group-calendar-screen-container">
        <View className="mb-6 flex-row flex-wrap items-center gap-2" nativeID="group-calendar-screen-header" testID="group-calendar-screen-header">
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
              <IconTooltip idPrefix="group-calendar-screen-bulk-clear-button-tooltip" label="Vaciar en lote">
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
              </IconTooltip>
              <IconTooltip idPrefix="group-calendar-screen-bulk-edit-button-tooltip" label="Editar en lote">
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
              </IconTooltip>
              <IconTooltip idPrefix="group-calendar-screen-selection-exit-button-tooltip" label="Salir de selección">
                <Pressable
                  accessibilityLabel="Salir de selección"
                  className="h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                  nativeID="group-calendar-screen-selection-exit-button"
                  onPress={handleExitSelection}
                  testID="group-calendar-screen-selection-exit-button"
                >
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
                </Pressable>
              </IconTooltip>
            </View>
          ) : null}
        </View>

        {/* Accesos directos al catálogo -- la pantalla solo tenía el
            calendario y sus operaciones, sin salida hacia dónde se define
            lo que un día termina mostrando (planes/sesiones/ejercicios).
            Solo para quien administra: un corredor no tiene la ruta
            /training-plans en su navegación (routes/catalog.js, role:
            'trainer'). `?tab=` deep-linkea directo a la pestaña, en vez de
            abrir siempre en "Planes" y obligar a un segundo click. */}
        {canManage && (
          <View className="mb-4 flex-row flex-wrap gap-2" nativeID="group-calendar-catalog-links" testID="group-calendar-catalog-links">
            {CATALOG_QUICK_LINKS.map((link) => (
              <Pressable
                className="flex-row items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 active:opacity-70 dark:border-slate-700 dark:bg-surface dark:hover:bg-slate-800"
                key={link.id}
                nativeID={`group-calendar-catalog-link-${link.id}`}
                onPress={() => router.push(`/training-plans?tab=${link.id}`)}
                testID={`group-calendar-catalog-link-${link.id}`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name={link.icon} size={14} />
                <Text className="text-xs font-medium text-slate-600 dark:text-slate-300" nativeID={`group-calendar-catalog-link-${link.id}-label`} testID={`group-calendar-catalog-link-${link.id}-label`}>
                  {link.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <CalendarKindLegend counts={monthCounts} idPrefix="group-calendar-kind-legend" />

        <View
          className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-transparent dark:bg-surface"
          nativeID="group-calendar-month-view"
          testID="group-calendar-month-view"
        >
          <CalendarFadeIn key={`${visibleYear}-${visibleMonth}-${colorScheme}`} nativeID="group-calendar-month-view-fade" testID="group-calendar-month-view-fade">
            <Calendar
              current={currentMonthISO}
              customHeaderTitle={
                <CalendarMonthYearHeader
                  idPrefix="group-calendar"
                  month={visibleMonth}
                  onChange={(year, month) => { setVisibleYear(year); setVisibleMonth(month); }}
                  year={visibleYear}
                />
              }
              dayComponent={({ date, state }) => (
                <CalendarDayCell
                  canManage={canManage}
                  containerRef={screenRootRef}
                  date={date}
                  isMenuOpen={openDayMenu?.date === date.dateString}
                  isToday={date.dateString === todayIso}
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
          </CalendarFadeIn>
        </View>
      </ScreenCard>
      </ScrollView>

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
