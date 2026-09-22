import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text } from 'react-native';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { CalendarDayFields } from './calendar-day-fields.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

// Modal de "editar en lote" — un solo kind/contenido aplicado a TODAS
// las fechas seleccionadas de una (mapea directo al bulk-assign del
// backend, ver docs/superpowers/specs/2026-09-21-calendar-multi-select-design.md
// §4). Nunca ofrece KEEP_CURRENT_SESSION en el selector de sesión — cada
// fecha del lote puede tener una sesión actual distinta o ninguna,
// "mantener la actual" no tiene un significado único acá.
export function BulkEditDaysModal({ visible, onClose, onSuccess, groupId, ownerId, dates }) {
  const colors = useThemeColors();
  const { sessions } = useSessions(ownerId);
  const { bulkAssign, isBulkAssigning } = useGroupCalendarMutations(groupId);

  const [kind, setKind] = useState('rest');
  const [otherName, setOtherName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isPresencial, setIsPresencial] = useState(false);
  const [presencialTimeFrom, setPresencialTimeFrom] = useState('');
  const [presencialTimeTo, setPresencialTimeTo] = useState('');
  const [presencialLocation, setPresencialLocation] = useState(null);
  const [error, setError] = useState(null);

  const resetKey = visible;
  const prevResetKeyRef = useRef(resetKey);
  if (resetKey !== prevResetKeyRef.current) {
    prevResetKeyRef.current = resetKey;
    setKind('rest');
    setOtherName('');
    setSessionId('');
    setIsPresencial(false);
    setPresencialTimeFrom('');
    setPresencialTimeTo('');
    setPresencialLocation(null);
    setError(null);
  }

  const isDirty = useFormDirty({ kind, otherName, sessionId, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation }, resetKey);
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const clearError = () => { if (error) setError(null); };
  const sessionOptions = sessions.map((s) => ({ id: s.id, name: s.name }));

  const handleSubmit = async () => {
    if (kind === 'other' && !otherName.trim()) {
      setError('Ingresá el nombre de la actividad.');
      return;
    }
    if (kind === 'training' && !sessionId) {
      setError('Elegí una sesión del catálogo.');
      return;
    }
    if (kind === 'training' && isPresencial) {
      if (!presencialTimeFrom || !presencialTimeTo) {
        setError('Cargá el horario de inicio y fin.');
        return;
      }
      if (presencialTimeTo <= presencialTimeFrom) {
        setError('El horario de fin debe ser posterior al de inicio.');
        return;
      }
      if (!presencialLocation) {
        setError('Elegí la ubicación del encuentro.');
        return;
      }
    }
    setError(null);

    const day = { kind, otherName, sessionId, isPresencial: kind === 'training' && isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation };
    const result = await bulkAssign({ dates, day });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos editar los días', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: `${dates.length} día${dates.length === 1 ? '' : 's'} actualizados` });
    if (result.sameTeamWarnings?.length > 0) {
      Toast.show({ type: 'info', text1: 'Superposición con otro grupo', text2: 'Mismo equipo — se guardó igual.' });
    }
    onSuccess();
    onClose();
  };

  const handleClose = () => guardedClose(onClose);

  return (
    <>
      <Modal animationType="fade" nativeID="bulk-edit-days-modal" onRequestClose={handleClose} testID="bulk-edit-days-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="bulk-edit-days-modal-backdrop" onPress={handleClose} testID="bulk-edit-days-modal-backdrop">
          <Pressable
            className="max-h-[85%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="bulk-edit-days-modal-card"
            onPress={() => {}}
            testID="bulk-edit-days-modal-card"
          >
            <Text className="mb-2 text-lg font-bold text-slate-900 dark:text-white" nativeID="bulk-edit-days-modal-title" testID="bulk-edit-days-modal-title">
              Editar {dates.length} día{dates.length === 1 ? '' : 's'}
            </Text>

            {error && (
              <Text className="mb-2 text-xs text-red-500 dark:text-red-400" nativeID="bulk-edit-days-modal-error" testID="bulk-edit-days-modal-error">{error}</Text>
            )}

            <CalendarDayFields
              currentSessionInstance={null}
              disabled={isBulkAssigning}
              idPrefix="bulk-edit-days"
              isPresencial={isPresencial}
              kind={kind}
              onIsPresencialChange={setIsPresencial}
              onKindChange={(v) => { setKind(v); clearError(); }}
              onOtherNameChange={(text) => { setOtherName(text); clearError(); }}
              onPresencialLocationChange={(v) => { setPresencialLocation(v); clearError(); }}
              onPresencialTimeFromChange={(v) => { setPresencialTimeFrom(v); clearError(); }}
              onPresencialTimeToChange={(v) => { setPresencialTimeTo(v); clearError(); }}
              onSessionIdChange={(v) => { setSessionId(v); clearError(); }}
              otherName={otherName}
              presencialLocation={presencialLocation}
              presencialTimeFrom={presencialTimeFrom}
              presencialTimeTo={presencialTimeTo}
              sessionId={sessionId}
              sessionOptions={sessionOptions}
            />

            <Pressable
              className={`mt-2 h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${isBulkAssigning ? 'opacity-60' : ''}`}
              disabled={isBulkAssigning}
              nativeID="bulk-edit-days-modal-save-button"
              onPress={handleSubmit}
              testID="bulk-edit-days-modal-save-button"
            >
              {isBulkAssigning ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="bulk-edit-days-modal-save-button-label" testID="bulk-edit-days-modal-save-button-label">
                  Guardar
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
