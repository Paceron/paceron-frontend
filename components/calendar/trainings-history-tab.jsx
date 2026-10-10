import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useTrainingsHistoryFiltersStore } from '../../store/trainings-history-filters-store.js';
import { useTeams, useMyMemberTeams } from '../../hooks/use-teams.js';
import { useGroups } from '../../hooks/use-groups.js';
import { selectAdministeredTeams } from '../../store/team-store.js';
import { useTrainingsHistory, useDeleteWorkoutFeedbackMutation } from '../../hooks/use-trainings-history.js';
import { buildDateRangeFilters } from '../../utils/trainings-history-filters.js';
import { groupHistoryItemsBySession } from '../../utils/trainings-history-grouping.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DateField } from '../forms/fields.jsx';
import { FilterPanel } from '../shared/filter-panel.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { TrainingsHistoryRow } from './trainings-history-row.jsx';
import { TrainingsHistoryRowMenu } from './trainings-history-row-menu.jsx';
import { BulkDeleteFeedbackModal } from './bulk-delete-feedback-modal.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

// El historial se navega por SESIÓN (ver trainings-history-grouping.js), así
// que "ordenar por serie/ejercicio" dejó de tener sentido -- el único eje
// real es la fecha de la sesión, con el toggle de orden de siempre.
const HISTORY_SORT = 'feedback_date';

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

  const filterTeamId = useTrainingsHistoryFiltersStore((s) => s.teamId);
  const setFilterTeamId = useTrainingsHistoryFiltersStore((s) => s.setTeamId);
  const filterGroupId = useTrainingsHistoryFiltersStore((s) => s.groupId);
  const setFilterGroupId = useTrainingsHistoryFiltersStore((s) => s.setGroupId);
  const dateFromInput = useTrainingsHistoryFiltersStore((s) => s.dateFromInput);
  const setDateFromInput = useTrainingsHistoryFiltersStore((s) => s.setDateFromInput);
  const dateToInput = useTrainingsHistoryFiltersStore((s) => s.dateToInput);
  const setDateToInput = useTrainingsHistoryFiltersStore((s) => s.setDateToInput);
  const order = useTrainingsHistoryFiltersStore((s) => s.order);
  const setOrder = useTrainingsHistoryFiltersStore((s) => s.setOrder);
  const filterExerciseId = useTrainingsHistoryFiltersStore((s) => s.exerciseId);
  const setFilterExerciseId = useTrainingsHistoryFiltersStore((s) => s.setExerciseId);
  const filterAthleteId = useTrainingsHistoryFiltersStore((s) => s.athleteId);
  const setFilterAthleteId = useTrainingsHistoryFiltersStore((s) => s.setAthleteId);
  const clearFilters = useTrainingsHistoryFiltersStore((s) => s.clearFilters);

  const { groups: groupOptions } = useGroups(role === 'trainer' ? filterTeamId : null, userId);
  const { dateFrom, dateTo, error: dateRangeError } = buildDateRangeFilters(dateFromInput, dateToInput);

  const handleTeamChange = (teamId) => {
    setFilterTeamId(teamId);
  };

  const filters = {
    teamId: filterTeamId || null,
    groupId: filterGroupId || null,
    dateFrom,
    dateTo,
    exerciseId: filterExerciseId || null,
    athleteUserId: role === 'trainer' ? (filterAthleteId || null) : null,
    sort: HISTORY_SORT,
    order,
  };

  const { items, hasMore, availableAthletes, availableExercises, loading, isFetching, loadMore } = useTrainingsHistory(role, userId, filters);
  const { deleteFeedback } = useDeleteWorkoutFeedbackMutation(role, userId, filters);
  const sessionGroups = groupHistoryItemsBySession(items);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rowMenu, setRowMenu] = useState(null); // { anchor, group } | null
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);

  const handleOpenRowMenu = (anchor, group) => setRowMenu({ anchor, group });
  const handleCloseRowMenu = () => setRowMenu(null);

  const handleToggleSelected = (groupId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const handleSelectFromMenu = () => {
    const groupId = rowMenu.group.id;
    handleCloseRowMenu();
    setSelectionMode(true);
    setSelectedIds(new Set([groupId]));
  };

  const handleDeleteFromMenu = () => {
    const groupId = rowMenu.group.id;
    handleCloseRowMenu();
    setSelectedIds(new Set([groupId]));
    setBulkDeleteVisible(true);
  };

  const handleExitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleOpenReview = (group) => {
    setReviewSlot({
      sessionInstanceId: group.sessionInstanceId,
      date: group.date,
      sessionName: group.sessionName,
      role: role === 'trainer' ? 'trainer' : 'runner',
      athleteUserId: group.athleteUserId,
      mode: 'review',
      teamId: group.teamId,
      teamName: group.teamName,
      groupName: group.groupName,
    });
    router.push('/training-session-review');
  };

  const handleBulkDelete = async () => {
    const selectedGroups = sessionGroups.filter((g) => selectedIds.has(g.id));
    const ids = selectedGroups.flatMap((g) => g.itemIds);
    const results = await Promise.all(ids.map((id) => deleteFeedback(id)));
    const failed = results.filter((r) => !r.success).length;
    setBulkDeleteVisible(false);
    handleExitSelection();
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunas sesiones no se pudieron eliminar', text2: `${failed} de ${ids.length} registros fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: `${selectedGroups.length} sesión${selectedGroups.length === 1 ? '' : 'es'} eliminada${selectedGroups.length === 1 ? '' : 's'}` });
  };

  const hasActiveFilters = Boolean(filterTeamId || filterGroupId || dateFromInput || dateToInput || filterExerciseId || filterAthleteId);
  return (
    <View className="relative flex-1" nativeID="trainings-history-tab-root" ref={containerRef} testID="trainings-history-tab-root">
      <FilterPanel hasActiveFilters={hasActiveFilters} idPrefix="trainings-history-tab-filter" loading={loading} onClear={clearFilters}>
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
        <View className="min-w-[280px] flex-1 flex-row gap-2" nativeID="trainings-history-tab-filter-date-range-wrapper" testID="trainings-history-tab-filter-date-range-wrapper">
          <View className="flex-1" nativeID="trainings-history-tab-filter-date-from-wrapper" testID="trainings-history-tab-filter-date-from-wrapper">
            <DateField label="Desde" onChange={setDateFromInput} value={dateFromInput} />
          </View>
          <View className="flex-1" nativeID="trainings-history-tab-filter-date-to-wrapper" testID="trainings-history-tab-filter-date-to-wrapper">
            <DateField label="Hasta" onChange={setDateToInput} value={dateToInput} />
          </View>
        </View>
        {sessionGroups.length > 0 && (
          <>
            <View className="min-w-[140px] flex-1" nativeID="trainings-history-tab-filter-exercise-wrapper" testID="trainings-history-tab-filter-exercise-wrapper">
              <ResponsiveSelectField
                dense
                hideErrorRow
                label="Ejercicio"
                onChange={setFilterExerciseId}
                options={availableExercises}
                placeholder="Todos"
                value={filterExerciseId}
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
        <View className="w-full" nativeID="trainings-history-tab-sort-section" testID="trainings-history-tab-sort-section">
          <Pressable
            className="h-11 w-full flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            nativeID="trainings-history-tab-order-toggle"
            onPress={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            testID="trainings-history-tab-order-toggle"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name={order === 'desc' ? 'sort-descending' : 'sort-ascending'} size={20} />
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trainings-history-tab-order-toggle-label" testID="trainings-history-tab-order-toggle-label">
              {order === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
            </Text>
          </Pressable>
        </View>
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
            <IconTooltip idPrefix="trainings-history-tab-bulk-delete-button-tooltip" label="Eliminar seleccionados">
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
            </IconTooltip>
            <IconTooltip idPrefix="trainings-history-tab-selection-exit-button-tooltip" label="Salir de selección">
              <Pressable
                accessibilityLabel="Salir de selección"
                className="h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                nativeID="trainings-history-tab-selection-exit-button"
                onPress={handleExitSelection}
                testID="trainings-history-tab-selection-exit-button"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
              </Pressable>
            </IconTooltip>
          </View>
        </View>
      )}

      {loading ? (
        <View className="items-center py-6" nativeID="trainings-history-tab-loading" testID="trainings-history-tab-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sessionGroups.length === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-surface" nativeID="trainings-history-tab-empty" testID="trainings-history-tab-empty">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="history" size={32} />
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="trainings-history-tab-empty-label" testID="trainings-history-tab-empty-label">
            {role === 'trainer' && !filterTeamId ? 'Elegí un equipo para ver su historial.' : 'Todavía no hay registros para estos filtros.'}
          </Text>
        </View>
      ) : (
        <View className="gap-2" nativeID="trainings-history-tab-list" testID="trainings-history-tab-list">
          {sessionGroups.map((group) => (
            <TrainingsHistoryRow
              containerRef={containerRef}
              group={group}
              key={group.id}
              onOpenMenu={handleOpenRowMenu}
              onOpenReview={handleOpenReview}
              onToggleSelected={handleToggleSelected}
              role={role}
              selected={selectedIds.has(group.id)}
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
        {rowMenu && <TrainingsHistoryRowMenu onDelete={handleDeleteFromMenu} onSelect={handleSelectFromMenu} />}
      </AnimatedDropdown>

      <BulkDeleteFeedbackModal count={selectedIds.size} onCancel={() => setBulkDeleteVisible(false)} onConfirm={handleBulkDelete} visible={bulkDeleteVisible} />
    </View>
  );
}
