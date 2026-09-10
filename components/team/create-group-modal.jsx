import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { InputField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';

// Alta de grupo — modal compartido por 2 contextos: el wizard de creación
// de equipo (create-team-screen.jsx, vía group-list-editor.jsx, donde el
// equipo todavía no existe y el grupo queda "staged" en un array local) y
// team-detail-screen.jsx (equipo real, crea contra el backend). El modal
// no sabe cuál de los dos es — solo llama a `onSubmit` y cierra si
// devuelve success. Feedback de éxito (toast) queda a cargo del caller,
// no del modal — el modo staged no quiere toast, el modo real sí.
export function CreateGroupModal({ visible, onClose, onSubmit, existingNames = [], planOptions }) {
  const colors = useThemeColors();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trainingPlanId, setTrainingPlanId] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetKey = String(visible);
  const prevResetKeyRef = useRef(null);
  const isResetting = visible && resetKey !== prevResetKeyRef.current;

  // Limpia el form cada vez que el modal se abre — mismo criterio que
  // CreateExerciseModal (ver ese archivo para el porqué del ajuste
  // síncrono durante el render, no en un useEffect).
  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    setName('');
    setDescription('');
    setTrainingPlanId('');
    setError(null);
  } else if (!visible) {
    prevResetKeyRef.current = null;
  }

  const dirtyValues = isResetting ? { name: '', description: '', trainingPlanId: '' } : { name, description, trainingPlanId };
  const formDirty = useFormDirty(dirtyValues, 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresá un nombre para el grupo.');
      return;
    }
    if (existingNames.includes(trimmed.toLowerCase())) {
      setError('Ya existe un grupo con ese nombre.');
      return;
    }
    setSubmitting(true);
    const result = await onSubmit({ name: trimmed, description: description.trim() || null, trainingPlanId: trainingPlanId || null });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal animationType="fade" nativeID="create-group-modal" onRequestClose={handleClose} testID="create-group-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-group-modal-backdrop" onPress={handleClose} testID="create-group-modal-backdrop">
          <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="create-group-modal-card" onPress={() => {}} testID="create-group-modal-card">
            <View className="mb-4 flex-row items-center gap-2" nativeID="create-group-modal-header" testID="create-group-modal-header">
              <MaterialCommunityIcons color={colors.primary} name="account-multiple" size={20} />
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-group-modal-title" testID="create-group-modal-title">
                Nuevo grupo
              </Text>
            </View>

            <View className="gap-3" nativeID="create-group-modal-fields" testID="create-group-modal-fields">
              <InputField autoFocus={!isWeb && visible} className="mb-0" dense error={error} label="Nombre del grupo" onChange={(text) => { setName(text); if (error) setError(null); }} placeholder="Ej. Grupo avanzado" value={name} />
              <ResponsiveSelectField
                className="mb-0"
                dense
                hideErrorRow
                label="Plan de entrenamiento"
                onChange={setTrainingPlanId}
                options={planOptions}
                placeholder={planOptions.length === 0 ? 'Sin planes disponibles todavía' : 'Sin plan asignado'}
                value={trainingPlanId}
              />
              <InputField className="mb-0" dense hideErrorRow label="Descripción" multiline numberOfLines={3} onChange={setDescription} placeholder="Ej. Corredores con mayor volumen y ritmo." value={description} />
            </View>

            <View className="mt-3 flex-row gap-3" nativeID="create-group-modal-actions" testID="create-group-modal-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={submitting}
                nativeID="create-group-modal-cancel-button"
                onPress={handleClose}
                testID="create-group-modal-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="create-group-modal-cancel-label" testID="create-group-modal-cancel-label">Cancelar</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
                disabled={submitting}
                nativeID="create-group-modal-confirm-button"
                onPress={handleSubmit}
                testID="create-group-modal-confirm-button"
              >
                {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-group-modal-confirm-label" testID="create-group-modal-confirm-label">
                    Crear
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
