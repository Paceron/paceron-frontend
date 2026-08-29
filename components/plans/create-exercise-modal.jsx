import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExerciseStore, EXERCISE_KIND_OPTIONS } from '../../store/exercise-store.js';
import { InputField, PickerField } from '../forms/fields.jsx';

// Alta rápida de un ejercicio nuevo, sin salir de donde se lo pidió (ej.
// desde adentro de CreateSessionModal) — "un botón para acceder al
// formulario de alta ahí mismo", ver enmienda 2026-08-26 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md. El
// catálogo completo (editar/borrar ejercicios sueltos) es "otro menú" a
// futuro, esto es solo el alta.
export function CreateExerciseModal({ visible, onClose, onCreated }) {
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const createExercise = useExerciseStore((s) => s.createExercise);

  const [name, setName] = useState('');
  const [kind, setKind] = useState('walking');
  const [minutes, setMinutes] = useState('');
  const [distanceM, setDistanceM] = useState('');
  const [speedKph, setSpeedKph] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showMinutes = kind === 'walking' || kind === 'jogging';
  const showDistance = kind === 'cruising' || kind === 'running';
  const showSpeed = kind === 'running';

  const reset = () => {
    setName('');
    setKind('walking');
    setMinutes('');
    setDistanceM('');
    setSpeedKph('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!name.trim()) {
      setError('Ingresá un nombre para el ejercicio.');
      return;
    }
    setSubmitting(true);
    const result = await createExercise({
      ownerId: user?.userId,
      name: name.trim(),
      kind,
      minutes: showMinutes && minutes ? Number(minutes) : null,
      distanceM: showDistance && distanceM ? Number(distanceM) : null,
      speedKph: showSpeed && speedKph ? Number(speedKph) : null,
    });
    setSubmitting(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos crear el ejercicio', text2: result.error });
      return;
    }

    Toast.show({ type: 'success', text1: 'Ejercicio creado' });
    reset();
    onCreated(result.exercise);
  };

  return (
    <Modal animationType="fade" nativeID="create-exercise-modal" onRequestClose={handleClose} testID="create-exercise-modal" transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-exercise-modal-backdrop" testID="create-exercise-modal-backdrop">
        <View className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="create-exercise-modal-card" testID="create-exercise-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="create-exercise-modal-header" testID="create-exercise-modal-header">
            <MaterialCommunityIcons color={colors.primary} name="dumbbell" size={20} />
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-exercise-modal-title" testID="create-exercise-modal-title">Nuevo ejercicio</Text>
          </View>

          <InputField dense error={error} label="Nombre" onChange={(text) => { setName(text); if (error) setError(null); }} placeholder="Ej. Series 400m fuertes" value={name} />
          <PickerField dense label="Tipo" onChange={setKind} options={EXERCISE_KIND_OPTIONS} required value={kind} />

          {showMinutes && <InputField dense keyboardType="number-pad" label="Minutos" onChange={setMinutes} value={minutes} />}
          {showDistance && <InputField dense keyboardType="number-pad" label="Distancia (m)" onChange={setDistanceM} value={distanceM} />}
          {showSpeed && <InputField dense keyboardType="number-pad" label="Velocidad (km/h)" onChange={setSpeedKph} value={speedKph} />}

          <View className="mt-2 flex-row gap-3" nativeID="create-exercise-modal-actions" testID="create-exercise-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={submitting}
              nativeID="create-exercise-modal-cancel-button"
              onPress={handleClose}
              testID="create-exercise-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="create-exercise-modal-cancel-label" testID="create-exercise-modal-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
              disabled={submitting}
              nativeID="create-exercise-modal-confirm-button"
              onPress={handleSubmit}
              testID="create-exercise-modal-confirm-button"
            >
              {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-exercise-modal-confirm-label" testID="create-exercise-modal-confirm-label">Crear</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
