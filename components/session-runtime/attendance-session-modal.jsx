import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useSessionAttendance, useSaveAttendance, useDeleteAttendance } from '../../hooks/use-attendance.js';
import { AttendanceGrid } from '../attendance/attendance-grid.jsx';
import { AttendanceQrModal } from '../attendance/attendance-qr-modal.jsx';
import { formatSessionDate } from '../attendance/attendance-selection-panel.jsx';
import { ConfirmDestructiveModal } from '../shared/confirm-destructive-modal.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/haptics.js';

// Empaqueta components/attendance/ (AttendanceGrid + AttendanceQrModal, sin
// modificarlos) para una sesión YA CONOCIDA -- sin el selector team→grupo→
// sesión de AttendanceScreen, porque acá los tres ids ya se saben de
// pendingSession. Un solo componente, usado desde el pre-start y la pantalla
// en vivo del entrenador.
export function AttendanceSessionModal({ visible, onClose, teamId, groupId, sessionInstanceId, teamName, sessionName, sessionDate }) {
  const colors = useThemeColors();
  const idPrefix = 'attendance-session-modal';

  // Polling liviano SOLO mientras el modal está abierto -- ver el comentario
  // en useSessionAttendance (sin evento WS de asistencia, es el único camino
  // "casi en vivo" sin backend nuevo).
  const { rows, summary, isLoading, isRefetching, error, refetch } = useSessionAttendance(sessionInstanceId, teamId, groupId, { refetchInterval: visible ? 6000 : false });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [discardVisible, setDiscardVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const toggleRow = useCallback((userId) => {
    const key = String(userId);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const { saveAttendance, isSaving } = useSaveAttendance(teamId);
  const { deleteAttendance, isDeleting } = useDeleteAttendance(teamId);

  useEffect(() => { if (pendingDelete) notifyWarning(); }, [pendingDelete]);

  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    try {
      const result = await saveAttendance({ teamId, trainingSessionId: sessionInstanceId, userIds: [...selectedIds] });
      setSelectedIds(new Set());
      notifySuccess();
      Toast.show({
        type: 'success',
        text1: 'Asistencia guardada',
        text2: `${result?.created ?? 0} nueva${(result?.created ?? 0) === 1 ? '' : 's'}, ${result?.updated ?? 0} actualizada${(result?.updated ?? 0) === 1 ? '' : 's'}`,
      });
    } catch (err) {
      notifyError();
      if (err.status === 403) {
        Toast.show({ type: 'error', text1: 'No administrás ese equipo', text2: 'Pedile a otro entrenador del equipo que cargue la asistencia.' });
      } else if (err.status === 422) {
        Toast.show({ type: 'error', text1: 'No se pudo guardar', text2: 'La sesión dejó de ser presencial o algún corredor no era del grupo en esa fecha.' });
      } else {
        Toast.show({ type: 'error', text1: 'No se pudo guardar la asistencia', text2: err.message });
      }
    }
  };

  const handleRequestDelete = useCallback((row) => setPendingDelete(row), []);
  const handleCancelDelete = () => { if (!isDeleting) setPendingDelete(null); };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || isDeleting) return;
    try {
      await deleteAttendance({ attendanceId: pendingDelete.attendance_id });
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(String(pendingDelete.user_id));
        return next;
      });
      setPendingDelete(null);
      notifySuccess();
      Toast.show({ type: 'success', text1: 'Asistencia eliminada' });
    } catch (err) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No se pudo eliminar', text2: err.message });
    }
  };

  // Sin useUnsavedChangesGuard/usePreventRemove: no hay navegación que
  // interceptar acá, solo un Modal con dos vías de cierre que ya controlamos
  // (backdrop y el botón de cerrar) -- las dos pasan por este mismo embudo.
  const handleRequestClose = () => {
    if (selectedIds.size > 0) {
      setDiscardVisible(true);
      return;
    }
    onClose();
  };

  const session = { name: sessionName, date: sessionDate };

  return (
    <Modal animationType="fade" nativeID={`${idPrefix}-modal`} onRequestClose={handleRequestClose} testID={`${idPrefix}-modal`} transparent visible={visible}>
      <Pressable className={`flex-1 bg-black/50 ${isWeb ? 'items-center justify-center px-4' : 'items-end'}`} nativeID={`${idPrefix}-backdrop`} onPress={handleRequestClose} testID={`${idPrefix}-backdrop`}>
        <Pressable
          className={isWeb ? 'max-h-[85vh] w-full max-w-3xl rounded-2xl bg-white dark:bg-surface' : 'h-full w-full max-w-lg bg-white dark:bg-surface'}
          nativeID={`${idPrefix}-card`}
          onPress={() => {}}
          testID={`${idPrefix}-card`}
        >
          <SafeAreaView className="flex-1 p-4" edges={['top', 'bottom']} nativeID={`${idPrefix}-card-safe-area`} testID={`${idPrefix}-card-safe-area`}>
            <View className="mb-3 flex-row items-center justify-between" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>
                Asistencia
              </Text>
              <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header-actions`} testID={`${idPrefix}-header-actions`}>
                <Pressable
                  className="h-9 flex-row items-center gap-1.5 rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
                  nativeID={`${idPrefix}-qr-button`}
                  onPress={() => setQrModalVisible(true)}
                  testID={`${idPrefix}-qr-button`}
                >
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="qrcode" size={16} />
                  <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-qr-button-label`} testID={`${idPrefix}-qr-button-label`}>
                    Mostrar QR
                  </Text>
                </Pressable>
                <Pressable className="h-9 w-9 items-center justify-center rounded-full active:opacity-70" nativeID={`${idPrefix}-close-button`} onPress={handleRequestClose} testID={`${idPrefix}-close-button`}>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
                </Pressable>
              </View>
            </View>

            <ScrollView className="flex-1" nativeID={`${idPrefix}-grid-scroll`} testID={`${idPrefix}-grid-scroll`}>
              <AttendanceGrid
                error={error}
                idPrefix={`${idPrefix}-grid`}
                isLoading={isLoading}
                isRefetching={isRefetching}
                isSaving={isSaving}
                onRefresh={refetch}
                onRequestDelete={handleRequestDelete}
                onRetry={refetch}
                onSave={handleSave}
                onToggle={toggleRow}
                rows={rows}
                selectedIds={selectedIds}
                summary={summary}
              />
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>

      <DiscardChangesModal onCancel={() => setDiscardVisible(false)} onConfirm={() => { setDiscardVisible(false); setSelectedIds(new Set()); onClose(); }} visible={discardVisible} />

      <ConfirmDestructiveModal
        confirmLabel="Eliminar"
        description={pendingDelete ? `Vas a eliminar la asistencia de ${pendingDelete.name} a la sesión del ${formatSessionDate(sessionDate)}. Esta acción no se puede deshacer.` : ''}
        idPrefix={`${idPrefix}-delete-attendance`}
        loading={isDeleting}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Eliminar asistencia"
        visible={Boolean(pendingDelete)}
      />

      <AttendanceQrModal
        formatDate={formatSessionDate}
        onClose={() => setQrModalVisible(false)}
        session={session}
        sessionInstanceId={sessionInstanceId}
        teamId={teamId}
        teamName={teamName}
        visible={qrModalVisible}
      />
    </Modal>
  );
}
