import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { InputField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { CreateExerciseModal } from './create-exercise-modal.jsx';

const WARMCOOL_KINDS = ['walking', 'jogging', 'elongation'];

// Picker de ejercicio + botón "Nuevo" al lado — mismo espíritu que el
// resto del módulo: elegir de un catálogo ya armado es el camino
// principal, dar de alta uno nuevo es la excepción con su propio acceso
// directo (acá abre CreateExerciseModal, no navega a otro lado).
function ExercisePickerRow({ label, exercises, value, onChange, onRequestCreate }) {
  return (
    <View nativeID={`session-exercise-picker-${label}`} testID={`session-exercise-picker-${label}`}>
      <Row narrowClassName="gap-3">
        <Col flex={2}>
          <ResponsiveSelectField
            dense
            label={label}
            onChange={onChange}
            options={exercises.map((e) => ({ id: e.id, name: e.name }))}
            placeholder={exercises.length ? 'Elegí un ejercicio' : 'Todavía no hay ejercicios de este tipo'}
            value={value}
          />
        </Col>
        <Col flex={1}>
          <Pressable
            className="mb-3 h-12 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary px-3 hover:bg-primary-tint-subtle active:opacity-70 dark:hover:bg-primary/10"
            nativeID={`session-exercise-picker-${label}-new-button`}
            onPress={onRequestCreate}
            testID={`session-exercise-picker-${label}-new-button`}
          >
            <MaterialCommunityIcons color="#8cc63e" name="plus" size={16} />
            <Text className="text-xs font-semibold text-primary" nativeID={`session-exercise-picker-${label}-new-label`} testID={`session-exercise-picker-${label}-new-label`}>Nuevo</Text>
          </Pressable>
        </Col>
      </Row>
    </View>
  );
}

// Alta rápida de una sesión nueva desde adentro de armar un día de
// entrenamiento en un plan — mismo motivo que CreateExerciseModal: un
// modal, no una pantalla nueva, para no perder el plan a medio armar.
export function CreateSessionModal({ visible, onClose, onCreated }) {
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const exercises = useExerciseStore((s) => s.exercises);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const createSession = useSessionStore((s) => s.createSession);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [warmupExerciseId, setWarmupExerciseId] = useState('');
  const [mainExerciseId, setMainExerciseId] = useState('');
  const [mainRepeatCount, setMainRepeatCount] = useState('1');
  const [mainRestMinutes, setMainRestMinutes] = useState('0');
  const [cooldownExerciseId, setCooldownExerciseId] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [createExerciseTarget, setCreateExerciseTarget] = useState(null); // 'warmup' | 'main' | 'cooldown' | null

  useEffect(() => {
    if (visible && user?.userId) fetchExercises(user.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.userId]);

  const warmcoolExercises = exercises.filter((e) => WARMCOOL_KINDS.includes(e.kind));

  const reset = () => {
    setName('');
    setDescription('');
    setWarmupExerciseId('');
    setMainExerciseId('');
    setMainRepeatCount('1');
    setMainRestMinutes('0');
    setCooldownExerciseId('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleExerciseCreated = (exercise) => {
    if (createExerciseTarget === 'warmup') setWarmupExerciseId(exercise.id);
    if (createExerciseTarget === 'main') setMainExerciseId(exercise.id);
    if (createExerciseTarget === 'cooldown') setCooldownExerciseId(exercise.id);
    setCreateExerciseTarget(null);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!name.trim() || !warmupExerciseId || !mainExerciseId || !cooldownExerciseId) {
      setError('Completá el nombre y los 3 ejercicios (entrada en calor, principal, vuelta a la calma).');
      return;
    }
    setSubmitting(true);
    const result = await createSession({
      ownerId: user?.userId,
      name: name.trim(),
      description: description.trim(),
      warmupExerciseId,
      mainExerciseId,
      mainRepeatCount: Number(mainRepeatCount) || 1,
      mainRestMinutes: Number(mainRestMinutes) || 0,
      cooldownExerciseId,
    });
    setSubmitting(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos crear la sesión', text2: result.error });
      return;
    }

    Toast.show({ type: 'success', text1: 'Sesión creada' });
    reset();
    onCreated(result.session);
  };

  return (
    <>
      <Modal animationType="fade" nativeID="create-session-modal" onRequestClose={handleClose} testID="create-session-modal" transparent visible={visible}>
        <View className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-session-modal-backdrop" testID="create-session-modal-backdrop">
          <View className="max-h-[90%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="create-session-modal-card" testID="create-session-modal-card">
            <View className="mb-4 flex-row items-center gap-2" nativeID="create-session-modal-header" testID="create-session-modal-header">
              <MaterialCommunityIcons color={colors.primary} name="clipboard-plus-outline" size={20} />
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-session-modal-title" testID="create-session-modal-title">Nueva sesión</Text>
            </View>

            <ScrollView nativeID="create-session-modal-scroll" showsVerticalScrollIndicator={false} testID="create-session-modal-scroll">
              <InputField dense label="Nombre" onChange={setName} placeholder="Ej. Series de velocidad" value={name} />
              <InputField dense label="Descripción" multiline numberOfLines={2} onChange={setDescription} value={description} />

              <ExercisePickerRow
                exercises={warmcoolExercises}
                label="Entrada en calor"
                onChange={setWarmupExerciseId}
                onRequestCreate={() => setCreateExerciseTarget('warmup')}
                value={warmupExerciseId}
              />
              <ExercisePickerRow
                exercises={exercises}
                label="Principal"
                onChange={setMainExerciseId}
                onRequestCreate={() => setCreateExerciseTarget('main')}
                value={mainExerciseId}
              />
              <Row narrowClassName="gap-3">
                <Col>
                  <InputField dense keyboardType="number-pad" label="Repeticiones" onChange={setMainRepeatCount} value={mainRepeatCount} />
                </Col>
                <Col>
                  <InputField dense keyboardType="number-pad" label="Descanso entre series (min)" onChange={setMainRestMinutes} value={mainRestMinutes} />
                </Col>
              </Row>
              <ExercisePickerRow
                exercises={warmcoolExercises}
                label="Vuelta a la calma"
                onChange={setCooldownExerciseId}
                onRequestCreate={() => setCreateExerciseTarget('cooldown')}
                value={cooldownExerciseId}
              />

              {error && (
                <Text className="mb-3 text-xs text-red-500 dark:text-red-400" nativeID="create-session-modal-error" testID="create-session-modal-error">{error}</Text>
              )}
            </ScrollView>

            <View className="mt-2 flex-row gap-3" nativeID="create-session-modal-actions" testID="create-session-modal-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                disabled={submitting}
                nativeID="create-session-modal-cancel-button"
                onPress={handleClose}
                testID="create-session-modal-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="create-session-modal-cancel-label" testID="create-session-modal-cancel-label">Cancelar</Text>
              </Pressable>
              <Pressable
                className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary hover:opacity-90 active:opacity-80"
                disabled={submitting}
                nativeID="create-session-modal-confirm-button"
                onPress={handleSubmit}
                testID="create-session-modal-confirm-button"
              >
                {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-session-modal-confirm-label" testID="create-session-modal-confirm-label">Crear</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CreateExerciseModal
        onClose={() => setCreateExerciseTarget(null)}
        onCreated={handleExerciseCreated}
        visible={createExerciseTarget != null}
      />
    </>
  );
}
