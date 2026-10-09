import { useRef, useState } from 'react';
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
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';

function kindLabel(assignment) {
  if (assignment.kind === 'rest') return 'Descanso';
  if (assignment.kind === 'other') return assignment.otherName || 'Otra actividad';
  if (assignment.kind === 'cancelled') return 'Sesión cancelada';
  return 'Entrenamiento';
}

function MenuToggle({ assignment, cardRef, onOpenMenu, idPrefix }) {
  const colors = useThemeColors();
  const ref = useRef(null);

  // Mismo patrón que trainings-history-row.jsx -- NO un View absolute
  // anidado dentro de la fila: la fila vive dentro del ScrollView del
  // modal, que clippea cualquier hijo absoluto a su propio viewport sin
  // importar z-index (bug real, 2026-10-05, se veía cortado en web Y
  // mobile). measureInWindow contra `cardRef` (fuera del ScrollView) da
  // coordenadas que un ÚNICO AnimatedDropdown, montado afuera del scroll,
  // puede usar sin que nada lo recorte.
  //
  // El offset horizontal NO sale de medir el botón -- dos intentos
  // (left y right calculados con measureInWindow) seguían corridos en
  // mobile mientras web quedaba bien, señal de que la medida de ancho
  // del botón/tarjeta diverge entre plataformas. Como toda fila ocupa el
  // mismo ancho (AssignmentRow con `px-3`, sin padding propio entre
  // cardRef/ScrollView/el wrapper `gap-2`), el botón SIEMPRE queda a
  // exactamente 12px (ese `px-3`) del borde derecho de cardRef -- un
  // valor fijo, no medido, elimina la divergencia de plataforma de raíz.
  const handlePress = () => {
    if (!cardRef.current || !ref.current) return;
    cardRef.current.measureInWindow((cardX, cardY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ top: y - cardY + height + 4 }, assignment);
      });
    });
  };

  return (
    <IconTooltip idPrefix={`${idPrefix}-tooltip`} label="Más opciones">
      <Pressable
        ref={ref}
        accessibilityLabel="Más opciones"
        className="h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 active:opacity-70 dark:hover:bg-white/10"
        nativeID={idPrefix}
        onPress={handlePress}
        testID={idPrefix}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
      </Pressable>
    </IconTooltip>
  );
}

// Editar/Cancelar NAVEGAN (mismo destino que ya usa group-calendar-screen.jsx
// para esas dos acciones -- ninguna de las dos muta inline ahí tampoco, la
// vista agregada es de solo lectura por diseño, ver
// hooks/use-aggregated-calendar.js). "Vaciar" es la única excepción: un
// delete simple e idempotente, mismo hook que ya usa la pantalla del grupo,
// con confirmación porque es irreversible.
function DayDetailRowMenu({ assignment, idPrefix, onClose, onRequestClear }) {
  const router = useRouter();
  const closed = isCalendarDayClosed(assignment.date, { isPresencial: assignment.isPresencial, presencialTimeFrom: assignment.presencialTimeFrom });
  const isTraining = assignment.kind === 'training';

  const handleEdit = () => {
    onClose();
    router.push(`/teams/${assignment.teamId}/groups/${assignment.groupId}/calendar/${assignment.date}`);
  };
  const handleCancel = () => {
    onClose();
    router.push(`/teams/${assignment.teamId}/groups/${assignment.groupId}/calendar/${assignment.date}?action=cancel`);
  };

  return (
    <View className="w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID={`${idPrefix}-panel`} testID={`${idPrefix}-panel`}>
      <Pressable className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID={`${idPrefix}-edit`} onPress={handleEdit} testID={`${idPrefix}-edit`}>
        <MaterialCommunityIcons color="#64748b" name="pencil-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-edit-label`} testID={`${idPrefix}-edit-label`}>Editar</Text>
      </Pressable>
      {!closed && (
        <Pressable className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID={`${idPrefix}-clear`} onPress={() => { onClose(); onRequestClear(assignment); }} testID={`${idPrefix}-clear`}>
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
          <Text className="text-sm text-red-600 dark:text-red-400" nativeID={`${idPrefix}-clear-label`} testID={`${idPrefix}-clear-label`}>Vaciar día</Text>
        </Pressable>
      )}
      {isTraining && (
        <Pressable className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID={`${idPrefix}-cancel`} onPress={handleCancel} testID={`${idPrefix}-cancel`}>
          <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
          <Text className="text-sm text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-cancel-label`} testID={`${idPrefix}-cancel-label`}>Cancelar sesión</Text>
        </Pressable>
      )}
    </View>
  );
}

function AssignmentRow({ assignment, variant, cardRef, onOpenMenu }) {
  const colors = useThemeColors();
  const router = useRouter();
  const idPrefix = `day-detail-assignment-${assignment.id}`;

  const handleGoToDay = () => {
    router.push(`/teams/${assignment.teamId}/groups/${assignment.groupId}/calendar/${assignment.date}`);
  };

  const kindColor = KIND_DOT_COLORS[assignment.kind];

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
          <MenuToggle assignment={assignment} cardRef={cardRef} idPrefix={`${idPrefix}-menu-toggle`} onOpenMenu={onOpenMenu} />
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
  const cardRef = useRef(null);
  const [rowMenu, setRowMenu] = useState(null); // { anchor, assignment } | null
  const [clearTarget, setClearTarget] = useState(null);

  const handleCloseRowMenu = () => setRowMenu(null);
  const handleOpenRowMenu = (anchor, assignment) => setRowMenu({ anchor, assignment });

  const handleClose = () => {
    handleCloseRowMenu();
    onClose();
  };

  return (
    <Modal animationType="fade" nativeID="day-detail-modal" onRequestClose={handleClose} testID="day-detail-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="day-detail-modal-backdrop" onPress={handleClose} testID="day-detail-modal-backdrop">
        <Pressable
          className="max-h-[80%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
          nativeID="day-detail-modal-card"
          onPress={handleCloseRowMenu}
          testID="day-detail-modal-card"
        >
          {/* `cardRef` va acá, NO en el Pressable de arriba -- ese tiene
              `shadow-xl` (elevation en Android), que puede inflar el bounds
              que measureInWindow reporta para ese nodo y corría el menú
              unos px hacia la izquierda en mobile (confirmado por el
              usuario: en web, sin ese problema de elevation, ya alineaba
              bien). Este View interno no tiene sombra ni breakpoint propio. */}
          <View className="relative" nativeID="day-detail-modal-card-inner" ref={cardRef} testID="day-detail-modal-card-inner">
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
                      cardRef={cardRef}
                      key={assignment.id}
                      onOpenMenu={handleOpenRowMenu}
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

            <AnimatedDropdown anchorStyle={rowMenu ? { right: 12, top: rowMenu.anchor.top, width: 192 } : {}} onClose={handleCloseRowMenu} open={Boolean(rowMenu)}>
              {rowMenu && <DayDetailRowMenu assignment={rowMenu.assignment} idPrefix="day-detail-modal-row-menu" onClose={handleCloseRowMenu} onRequestClear={setClearTarget} />}
            </AnimatedDropdown>
          </View>
        </Pressable>
      </Pressable>

      <ClearDayConfirm clearTarget={clearTarget} onCancel={() => setClearTarget(null)} onCleared={() => setClearTarget(null)} />
    </Modal>
  );
}
