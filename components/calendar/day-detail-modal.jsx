import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { KIND_DOT_COLORS } from '../../utils/calendar-kind-colors.js';
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { StartSessionButton } from './start-session-button.jsx';
import { ConfirmDestructiveModal } from '../shared/confirm-destructive-modal.jsx';

function kindLabel(assignment) {
  if (assignment.kind === 'rest') return 'Descanso';
  if (assignment.kind === 'other') return assignment.otherName || 'Otra actividad';
  if (assignment.kind === 'cancelled') return 'Sesión cancelada';
  return 'Entrenamiento';
}

// Este menú NAVEGA para "Editar/Asignar" y "Cancelar" (mismo destino que ya
// usa group-calendar-screen.jsx para esas dos acciones -- ninguna de las
// dos muta inline ahí tampoco) en vez de duplicar lógica de edición acá --
// la vista agregada es de solo lectura por diseño (ver
// hooks/use-aggregated-calendar.js). "Vaciar" es la única excepción: un
// delete simple e idempotente, mismo hook que ya usa la pantalla del
// grupo, con confirmación porque es irreversible.
function AssignmentRow({ assignment, variant, menuOpen, onToggleMenu, onRequestClear }) {
  const colors = useThemeColors();
  const router = useRouter();
  const idPrefix = `day-detail-assignment-${assignment.id}`;

  const handleGoToDay = () => {
    router.push(`/teams/${assignment.teamId}/groups/${assignment.groupId}/calendar/${assignment.date}`);
  };
  const handleCancel = () => {
    onToggleMenu(null);
    router.push(`/teams/${assignment.teamId}/groups/${assignment.groupId}/calendar/${assignment.date}?action=cancel`);
  };

  const kindColor = KIND_DOT_COLORS[assignment.kind];
  const closed = isCalendarDayClosed(assignment.date, { isPresencial: assignment.isPresencial, presencialTimeFrom: assignment.presencialTimeFrom });
  const isTraining = assignment.kind === 'training';

  return (
    <View
      className="rounded-xl border px-3 py-2"
      nativeID={idPrefix}
      style={{ backgroundColor: `${kindColor}26`, borderColor: kindColor }}
      testID={idPrefix}
    >
      <View className="mb-1 flex-row items-start justify-between" nativeID={`${idPrefix}-top`} testID={`${idPrefix}-top`}>
        <View className="flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-0.5" nativeID={`${idPrefix}-scope`} testID={`${idPrefix}-scope`}>
          <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-team`} testID={`${idPrefix}-team`}>
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={12} />
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-team-label`} testID={`${idPrefix}-team-label`}>
              {assignment.teamName}
            </Text>
          </View>
          <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-group`} testID={`${idPrefix}-group`}>
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={12} />
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-group-label`} testID={`${idPrefix}-group-label`}>
              {assignment.groupName}
            </Text>
          </View>
        </View>
        {variant === 'administered' && (
          <View className="relative" nativeID={`${idPrefix}-menu-wrapper`} testID={`${idPrefix}-menu-wrapper`}>
            <Pressable
              accessibilityLabel="Más opciones"
              className="h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 active:opacity-70 dark:hover:bg-white/10"
              nativeID={`${idPrefix}-menu-toggle`}
              onPress={() => onToggleMenu(menuOpen ? null : assignment.id)}
              testID={`${idPrefix}-menu-toggle`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
            </Pressable>
            {menuOpen && (
              <View className="absolute right-0 top-8 z-50 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID={`${idPrefix}-menu-panel`} testID={`${idPrefix}-menu-panel`}>
                <Pressable className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID={`${idPrefix}-menu-edit`} onPress={() => { onToggleMenu(null); handleGoToDay(); }} testID={`${idPrefix}-menu-edit`}>
                  <MaterialCommunityIcons color="#64748b" name="pencil-outline" size={16} />
                  <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-menu-edit-label`} testID={`${idPrefix}-menu-edit-label`}>Editar</Text>
                </Pressable>
                {!closed && (
                  <Pressable className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID={`${idPrefix}-menu-clear`} onPress={() => { onToggleMenu(null); onRequestClear(assignment); }} testID={`${idPrefix}-menu-clear`}>
                    <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
                    <Text className="text-sm text-red-600 dark:text-red-400" nativeID={`${idPrefix}-menu-clear-label`} testID={`${idPrefix}-menu-clear-label`}>Vaciar día</Text>
                  </Pressable>
                )}
                {isTraining && (
                  <Pressable className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID={`${idPrefix}-menu-cancel`} onPress={handleCancel} testID={`${idPrefix}-menu-cancel`}>
                    <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
                    <Text className="text-sm text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-menu-cancel-label`} testID={`${idPrefix}-menu-cancel-label`}>Cancelar sesión</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </View>
      <Text className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-kind`} testID={`${idPrefix}-kind`}>
        {kindLabel(assignment)}
      </Text>
      {assignment.isPresencial && (
        <View className="mt-1 flex-row items-center gap-1.5" nativeID={`${idPrefix}-presencial`} testID={`${idPrefix}-presencial`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={14} />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-presencial-label`} testID={`${idPrefix}-presencial-label`}>
            {assignment.presencialTimeFrom}–{assignment.presencialTimeTo}
            {assignment.presencialLocation?.label ? ` · ${assignment.presencialLocation.label}` : ''}
          </Text>
        </View>
      )}
      {assignment.sessionInstance && (
        <Text className="mt-1 text-xs text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-session-name`} testID={`${idPrefix}-session-name`}>
          {assignment.sessionInstance.name}
          {assignment.sessionInstance.exercises.length > 0
            ? ` · ${assignment.sessionInstance.exercises.length} ejercicio${assignment.sessionInstance.exercises.length === 1 ? '' : 's'}`
            : ''}
        </Text>
      )}
      {variant === 'member' && <StartSessionButton assignment={assignment} role="runner" />}
      {variant === 'administered' && assignment.presencialCollision && (
        <View
          className={`mt-2 rounded-lg px-2 py-1.5 ${assignment.presencialCollision.type === 'cross_team' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}
          nativeID={`${idPrefix}-collision`}
          testID={`${idPrefix}-collision`}
        >
          <Text
            className={`text-[11px] font-semibold ${assignment.presencialCollision.type === 'cross_team' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}
            nativeID={`${idPrefix}-collision-label`}
            testID={`${idPrefix}-collision-label`}
          >
            Colisiona con {assignment.presencialCollision.conflicts.map((c) => `${c.group_name} (${c.team_name})`).join(', ')}
          </Text>
        </View>
      )}
      {variant === 'administered' && (
        <View className="mt-2 flex-row gap-2" nativeID={`${idPrefix}-actions`} testID={`${idPrefix}-actions`}>
          <StartSessionButton assignment={assignment} fill role="trainer" />
          <Pressable
            className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            nativeID={`${idPrefix}-go-to-day-button`}
            onPress={handleGoToDay}
            testID={`${idPrefix}-go-to-day-button`}
          >
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-go-to-day-button-label`} testID={`${idPrefix}-go-to-day-button-label`}>
              Ir a este día
            </Text>
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-right" size={14} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// `clearTarget` queda a nivel del modal (no por fila) porque un solo
// ConfirmDestructiveModal alcanza para cualquiera de las filas -- mismo
// patrón que trainings-history-tab.jsx con su bulk-delete compartido.
function ClearDayConfirm({ clearTarget, onCancel, onCleared }) {
  const queryClient = useQueryClient();
  const { deleteDay, isDeleting } = useGroupCalendarMutations(clearTarget?.groupId ?? null);

  const handleConfirm = async () => {
    const result = await deleteDay({ date: clearTarget.date });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos vaciar el día', text2: result.error });
      return;
    }
    // La query agregada (administered-calendar/member-calendar) es un
    // cache aparte del de group-calendar -- deleteDay ya invalida este
    // último, acá se invalida el que de verdad alimenta este modal.
    queryClient.invalidateQueries({ queryKey: ['administered-calendar'] });
    queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Día vaciado' });
    onCleared();
  };

  return (
    <ConfirmDestructiveModal
      confirmLabel="Vaciar"
      description={clearTarget ? `Vas a vaciar el día ${formatDisplayDate(clearTarget.date)} para ${clearTarget.groupName}. Esta acción no se puede deshacer.` : ''}
      idPrefix="day-detail-modal-clear-confirm"
      loading={isDeleting}
      onCancel={onCancel}
      onConfirm={handleConfirm}
      title="Vaciar día"
      visible={Boolean(clearTarget)}
    />
  );
}

export function DayDetailModal({ visible, onClose, date, assignments, variant, loading }) {
  const colors = useThemeColors();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [clearTarget, setClearTarget] = useState(null);

  const handleClose = () => {
    setOpenMenuId(null);
    onClose();
  };

  return (
    <Modal animationType="fade" nativeID="day-detail-modal" onRequestClose={handleClose} testID="day-detail-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="day-detail-modal-backdrop" onPress={handleClose} testID="day-detail-modal-backdrop">
        <Pressable
          className="max-h-[80%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID="day-detail-modal-card"
          onPress={() => setOpenMenuId(null)}
          testID="day-detail-modal-card"
        >
          <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="day-detail-modal-title" testID="day-detail-modal-title">
            {formatWeekdayLabel(date)}, {formatDisplayDate(date)}
          </Text>
          {loading ? (
            <View className="items-center justify-center py-6" nativeID="day-detail-modal-loading" testID="day-detail-modal-loading">
              <ActivityIndicator color={colors.primary} nativeID="day-detail-modal-loading-indicator" testID="day-detail-modal-loading-indicator" />
            </View>
          ) : (
            <ScrollView nativeID="day-detail-modal-scroll" testID="day-detail-modal-scroll">
              <View className="gap-2" nativeID="day-detail-modal-list" testID="day-detail-modal-list">
                {assignments.map((assignment) => (
                  <AssignmentRow
                    assignment={assignment}
                    key={assignment.id}
                    menuOpen={openMenuId === assignment.id}
                    onRequestClear={setClearTarget}
                    onToggleMenu={setOpenMenuId}
                    variant={variant}
                  />
                ))}
                {assignments.length === 0 && (
                  <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="day-detail-modal-empty" testID="day-detail-modal-empty">
                    Sin asignaciones este día.
                  </Text>
                )}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>

      <ClearDayConfirm clearTarget={clearTarget} onCancel={() => setClearTarget(null)} onCleared={() => setClearTarget(null)} />
    </Modal>
  );
}
