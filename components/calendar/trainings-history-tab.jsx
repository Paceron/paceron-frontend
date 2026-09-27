import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useTeams, useMyMemberTeams } from '../../hooks/use-teams.js';
import { useGroups } from '../../hooks/use-groups.js';
import { selectAdministeredTeams } from '../../store/team-store.js';
import { useTrainingsHistory, useDeleteWorkoutFeedbackMutation } from '../../hooks/use-trainings-history.js';
import { buildDateRangeFilters } from '../../utils/trainings-history-filters.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DateField, InputField } from '../forms/fields.jsx';
import { FilterPanel } from '../shared/filter-panel.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { TrainingsHistoryRow } from './trainings-history-row.jsx';
import { TrainingsHistoryRowMenu } from './trainings-history-row-menu.jsx';
import { BulkDeleteFeedbackModal } from './bulk-delete-feedback-modal.jsx';

const SORT_OPTIONS = [
  { id: 'feedback_date', name: 'Fecha' },
  { id: 'set_number', name: 'Serie' },
  { id: 'exercise_name', name: 'Ejercicio' },
];

export function TrainingsHistoryTab({ role }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const setReviewSlot = useSessionReviewStore((s) => s.setReviewSlot);
  const containerRef = useRef(null);

  const { teams: myTeams } = useMyMemberTeams(role === 'runner' ? userId : null);
  const { teams: allTeams } = useTeams();
  const administeredTeams = role === 'trainer' ? selectAdministeredTeams(allTeams, userId) : [];
  const teamOptions = role === 'trainer' ? administeredTeams : myTeams;

  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const { groups: groupOptions } = useGroups(role === 'trainer' ? filterTeamId : null, userId);

  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const { dateFrom, dateTo, error: dateRangeError } = buildDateRangeFilters(dateFromInput, dateToInput);

  const [sort, setSort] = useState('feedback_date');
  const [order, setOrder] = useState('desc');
  const [filterExerciseId, setFilterExerciseId] = useState('');
  const [filterSetNumber, setFilterSetNumber] = useState('');
  const [filterAthleteId, setFilterAthleteId] = useState('');

  const handleTeamChange = (teamId) => {
    setFilterTeamId(teamId);
    setFilterGroupId('');
  };

  const filters = {
    teamId: filterTeamId || null,
    groupId: filterGroupId || null,
    dateFrom,
    dateTo,
    exerciseId: filterExerciseId || null,
    setNumber: filterSetNumber || null,
    athleteUserId: role === 'trainer' ? (filterAthleteId || null) : null,
    sort,
    order,
  };

  const { items, hasMore, availableAthletes, availableExercises, loading, isFetching, loadMore } = useTrainingsHistory(role, userId, filters);
  const { deleteFeedback } = useDeleteWorkoutFeedbackMutation(role, userId, filters);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rowMenu, setRowMenu] = useState(null); // { anchor, item } | null
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);

  const handleOpenRowMenu = (anchor, item) => setRowMenu({ anchor, item });
  const handleCloseRowMenu = () => setRowMenu(null);

  const handleToggleSelected = (itemId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const handleSelectFromMenu = () => {
    const itemId = rowMenu.item.id;
    handleCloseRowMenu();
    setSelectionMode(true);
    setSelectedIds(new Set([itemId]));
  };

  const handleExitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleViewReview = () => {
    const item = rowMenu.item;
    handleCloseRowMenu();
    setReviewSlot({
      sessionInstanceId: item.sessionInstanceId,
      date: item.date,
      sessionName: item.sessionName,
      role: role === 'trainer' ? 'trainer' : 'runner',
      athleteUserId: item.athleteUserId,
      mode: 'review',
      teamId: item.teamId,
      teamName: item.teamName,
      groupName: item.groupName,
    });
    router.push('/training-session-review');
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => deleteFeedback(id)));
    const failed = results.filter((r) => !r.success).length;
    setBulkDeleteVisible(false);
    handleExitSelection();
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunos registros no se pudieron eliminar', text2: `${failed} de ${ids.length} fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: `${ids.length} registro${ids.length === 1 ? '' : 's'} eliminado${ids.length === 1 ? '' : 's'}` });
  };

  const hasActiveFilters = Boolean(filterTeamId || filterGroupId || dateFromInput || dateToInput || filterExerciseId || filterSetNumber || filterAthleteId);
  const handleClearFilters = () => {
    setFilterTeamId('');
    setFilterGroupId('');
    setDateFromInput('');
    setDateToInput('');
    setFilterExerciseId('');
    setFilterSetNumber('');
    setFilterAthleteId('');
  };

  return (
    <View className="relative flex-1" nativeID="trainings-history-tab-root" ref={containerRef} testID="trainings-history-tab-root">
      <FilterPanel hasActiveFilters={hasActiveFilters} idPrefix="trainings-history-tab-filter" loading={loading} onClear={handleClearFilters}>
        <View className="min-w-[140px] flex-1" nativeID="trainings-history-tab-filter-team-wrapper" testID="trainings-history-tab-filter-team-wrapper">
          <ResponsiveSelectField
            dense
            disabled={teamOptions.length === 0}
            hideErrorRow
            label="Equipo"
            onChange={handleTeamChange}
            options={teamOptions.map((t) => ({ id: t.id, name: t.name }))}
            placeholder={role === 'trainer' ? 'Elegí un equipo' : 'Todos los equipos'}
            value={filterTeamId}
          />
        </View>
        {role === 'trainer' && (
          <View className="min-w-[140px] flex-1" nativeID="trainings-history-tab-filter-group-wrapper" testID="trainings-history-tab-filter-group-wrapper">
            <ResponsiveSelectField
              dense
              disabled={!filterTeamId || groupOptions.length === 0}
              hideErrorRow
              label="Grupo"
              onChange={setFilterGroupId}
              options={groupOptions.map((g) => ({ id: g.id, name: g.name }))}
              placeholder="Todos los grupos"
              value={filterGroupId}
            />
          </View>
        )}
        <View className="min-w-[140px] flex-1" nativeID="trainings-history-tab-filter-date-from-wrapper" testID="trainings-history-tab-filter-date-from-wrapper">
          <DateField label="Desde" onChange={setDateFromInput} value={dateFromInput} />
        </View>
        <View className="min-w-[140px] flex-1" nativeID="trainings-history-tab-filter-date-to-wrapper" testID="trainings-history-tab-filter-date-to-wrapper">
          <DateField label="Hasta" onChange={setDateToInput} value={dateToInput} />
        </View>
        <View className="min-w-[140px] flex-1" nativeID="trainings-history-tab-filter-sort-wrapper" testID="trainings-history-tab-filter-sort-wrapper">
          <ResponsiveSelectField dense hideErrorRow label="Ordenar por" onChange={setSort} options={SORT_OPTIONS} value={sort} />
        </View>
        <Pressable
          className="mt-6 h-12 w-12 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          nativeID="trainings-history-tab-order-toggle"
          onPress={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
          testID="trainings-history-tab-order-toggle"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={order === 'desc' ? 'sort-descending' : 'sort-ascending'} size={20} />
        </Pressable>
        {items.length > 0 && (
          <>
            <View className="min-w-[140px] flex-1" nativeID="trainings-history-tab-filter-exercise-wrapper" testID="trainings-history-tab-filter-exercise-wrapper">
              <ResponsiveSelectField
                dense
                hideErrorRow
                label="Ejercicio"
                onChange={(value) => { setFilterExerciseId(value); setFilterSetNumber(''); }}
                options={availableExercises}
                placeholder="Todos"
                value={filterExerciseId}
              />
            </View>
            <View className="min-w-[90px] flex-1" nativeID="trainings-history-tab-filter-set-wrapper" testID="trainings-history-tab-filter-set-wrapper">
              <InputField
                dense
                disabled={!filterExerciseId}
                hideErrorRow
                keyboardType="numeric"
                label="Serie"
                onChange={(value) => setFilterSetNumber(value.replace(/\D/g, ''))}
                placeholder="Todas"
                value={filterSetNumber}
              />
            </View>
            {role === 'trainer' && (
              <View className="min-w-[140px] flex-1" nativeID="trainings-history-tab-filter-athlete-wrapper" testID="trainings-history-tab-filter-athlete-wrapper">
                <ResponsiveSelectField
                  dense
                  hideErrorRow
                  label="Corredor"
                  onChange={setFilterAthleteId}
                  options={availableAthletes}
                  placeholder="Todos"
                  value={filterAthleteId}
                />
              </View>
            )}
          </>
        )}
      </FilterPanel>

      {dateRangeError && (
        <Text className="mb-3 text-xs text-red-500 dark:text-red-400" nativeID="trainings-history-tab-date-range-error" testID="trainings-history-tab-date-range-error">
          {dateRangeError}
        </Text>
      )}

      {selectionMode && (
        <View className="mb-3 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="trainings-history-tab-selection-bar" testID="trainings-history-tab-selection-bar">
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trainings-history-tab-selection-count" testID="trainings-history-tab-selection-count">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
          </Text>
          <View className="flex-row items-center gap-2" nativeID="trainings-history-tab-selection-actions" testID="trainings-history-tab-selection-actions">
            <Pressable
              accessibilityLabel="Eliminar seleccionados"
              className="h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              disabled={selectedIds.size === 0}
              nativeID="trainings-history-tab-bulk-delete-button"
              onPress={() => setBulkDeleteVisible(true)}
              testID="trainings-history-tab-bulk-delete-button"
            >
              <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="Salir de selección"
              className="h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              nativeID="trainings-history-tab-selection-exit-button"
              onPress={handleExitSelection}
              testID="trainings-history-tab-selection-exit-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
            </Pressable>
          </View>
        </View>
      )}

      {loading ? (
        <View className="items-center py-6" nativeID="trainings-history-tab-loading" testID="trainings-history-tab-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-surface" nativeID="trainings-history-tab-empty" testID="trainings-history-tab-empty">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="history" size={32} />
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="trainings-history-tab-empty-label" testID="trainings-history-tab-empty-label">
            {role === 'trainer' && !filterTeamId ? 'Elegí un equipo para ver su historial.' : 'Todavía no hay registros para estos filtros.'}
          </Text>
        </View>
      ) : (
        <View className="gap-2" nativeID="trainings-history-tab-list" testID="trainings-history-tab-list">
          {items.map((item) => (
            <TrainingsHistoryRow
              containerRef={containerRef}
              item={item}
              key={item.id}
              onOpenMenu={handleOpenRowMenu}
              onToggleSelected={handleToggleSelected}
              role={role}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
            />
          ))}
          {hasMore && (
            <Pressable
              className="mt-2 h-11 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={isFetching}
              nativeID="trainings-history-tab-load-more-button"
              onPress={loadMore}
              testID="trainings-history-tab-load-more-button"
            >
              {isFetching ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trainings-history-tab-load-more-label" testID="trainings-history-tab-load-more-label">Cargar más</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      <AnimatedDropdown anchorStyle={rowMenu ? { left: Math.max(8, rowMenu.anchor.x + rowMenu.anchor.width - 208), top: rowMenu.anchor.y + rowMenu.anchor.height + 4, width: 208 } : {}} onClose={handleCloseRowMenu} open={Boolean(rowMenu)}>
        {rowMenu && <TrainingsHistoryRowMenu onSelect={handleSelectFromMenu} onViewReview={handleViewReview} />}
      </AnimatedDropdown>

      <BulkDeleteFeedbackModal count={selectedIds.size} onCancel={() => setBulkDeleteVisible(false)} onConfirm={handleBulkDelete} visible={bulkDeleteVisible} />
    </View>
  );
}
