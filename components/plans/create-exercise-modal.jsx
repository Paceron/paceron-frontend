import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExerciseStore, EXERCISE_KIND_OPTIONS, MUSCLE_GROUP_OPTIONS } from '../../store/exercise-store.js';
import { FIELD_LABEL, InputField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { INTENSITY_ORDER, INTENSITY_META, buildExerciseName } from './exercise-kind-meta.js';

// Selector de intensidad — 3 segmentos siempre con uno seleccionado
// (nunca vacío, por eso no hace falta validarlo en submit, igual que el
// select de Tipo). Standalone en su propia fila, no convive con otro
// control de altura fija al lado, así que el alto queda orgánico (no
// hace falta forzar h-12 como en SessionRoleSegmentedPicker).
function IntensitySegmentedPicker({ idPrefix, value, onChange }) {
  return (
    <View
      accessibilityLabel="Intensidad"
      accessibilityRole="radiogroup"
      className="flex-row items-center rounded-full bg-slate-100 p-1 dark:bg-slate-800"
      nativeID={`${idPrefix}-intensity-pill`}
      testID={`${idPrefix}-intensity-pill`}
    >
      {INTENSITY_ORDER.map((level) => {
        const meta = INTENSITY_META[level];
        const active = value === level;
        const segId = `${idPrefix}-intensity-${level}`;
        return (
          <Pressable
            accessibilityLabel={meta.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className={`flex-row items-center gap-1 rounded-full px-2.5 py-1.5 ${active ? meta.bg : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
            key={level}
            nativeID={segId}
            onPress={() => onChange(level)}
            testID={segId}
          >
            <MaterialCommunityIcons color={active ? meta.iconColor : '#94a3b8'} name={meta.icon} size={16} />
            <Text className={`text-xs font-semibold ${active ? meta.text : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${segId}-label`} testID={`${segId}-label`}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Alta rápida de un ejercicio nuevo, sin salir de donde se lo pidió (ej.
// desde adentro de CreateSessionModal) — "un botón para acceder al
// formulario de alta ahí mismo", ver enmienda 2026-08-26 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md. Con la
// prop opcional `exercise` (ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md)
// dobla como edición: precarga los valores, cambia título/botón y
// llama updateExercise en vez de createExercise — mismo modal, no un
// componente aparte, para no duplicar el formulario. El nombre ya no se
// tipea — se arma solo a partir del tipo, la intensidad y la duración o
// distancia (ver enmienda 2026-09-06 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md).
export function CreateExerciseModal({ visible, onClose, onCreated, exercise }) {
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const createExercise = useExerciseStore((s) => s.createExercise);
  const updateExercise = useExerciseStore((s) => s.updateExercise);
  const isEditing = Boolean(exercise);

  const [kind, setKind] = useState('walking');
  const [intensity, setIntensity] = useState('light');
  const [minutes, setMinutes] = useState('');
  const [distanceM, setDistanceM] = useState('');
  const [speedKph, setSpeedKph] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetKey = `${visible}-${exercise?.id ?? 'new'}`;
  const prevResetKeyRef = useRef(null);
  const isResetting = visible && resetKey !== prevResetKeyRef.current;

  // Precarga (o limpia) el formulario cada vez que el modal se abre —
  // así reabrirlo para editar otro ejercicio no arrastra el anterior. Se
  // ajusta de forma síncrona durante el render (no en un useEffect) para
  // que useFormDirty, más abajo, pueda usar los valores del registro que
  // se está editando en el mismo render donde cambia el resetKey. Los
  // setState de acá no se reflejan en `kind`/`intensity`/etc. hasta el
  // próximo render (React no muta el valor en el render en curso), así
  // que dirtyValues no puede leerlos directo — usa los valores
  // "efectivos" post-reset (`resetValues`) mientras `isResetting` es
  // true, y `useFormDirty` recibe ese objeto como snapshot base en el
  // mismo render donde resetKey cambia. Sin este ajuste, useFormDirty
  // capturaría el baseline un render antes de tiempo, con los valores
  // viejos/vacíos todavía en los states, y marcaría dirty=true de
  // entrada al reabrir en modo edición (falso positivo).
  const resetValues = {
    kind: exercise?.kind ?? 'walking',
    intensity: exercise?.intensity ?? 'light',
    minutes: exercise?.minutes != null ? String(exercise.minutes) : '',
    distanceM: exercise?.distanceM != null ? String(exercise.distanceM) : '',
    speedKph: exercise?.speedKph != null ? String(exercise.speedKph) : '',
    muscleGroup: exercise?.muscleGroup ?? '',
  };

  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    setKind(resetValues.kind);
    setIntensity(resetValues.intensity);
    setMinutes(resetValues.minutes);
    setDistanceM(resetValues.distanceM);
    setSpeedKph(resetValues.speedKph);
    setMuscleGroup(resetValues.muscleGroup);
    setError(null);
  } else if (!visible) {
    prevResetKeyRef.current = null;
  }

  const dirtyValues = isResetting ? resetValues : { kind, intensity, minutes, distanceM, speedKph, muscleGroup };
  const formDirty = useFormDirty(dirtyValues, exercise?.id ?? 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const showIntensity = kind !== 'elongation';
  const showMinutes = kind === 'walking' || kind === 'jogging';
  const showDistance = kind !== 'elongation';
  const showSpeed = kind === 'cruising' || kind === 'running';
  const showMuscleGroup = kind === 'elongation';

  // Preview en vivo — se recalcula en cada render a partir del estado
  // actual, ya no se tipea.
  const computedName = buildExerciseName({
    kind,
    intensity: showIntensity ? intensity : null,
    minutes: showMinutes && minutes ? Number(minutes) : null,
    distanceM: showDistance && distanceM ? Number(distanceM) : null,
    muscleGroup: showMuscleGroup ? muscleGroup : null,
  });

  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (showMuscleGroup && !muscleGroup) {
      setError('Elegí el grupo muscular que trabaja.');
      return;
    }
    setSubmitting(true);
    const form = {
      ownerId: user?.userId,
      name: computedName,
      kind,
      intensity: showIntensity ? intensity : null,
      minutes: showMinutes && minutes ? Number(minutes) : null,
      distanceM: showDistance && distanceM ? Number(distanceM) : null,
      speedKph: showSpeed && speedKph ? Number(speedKph) : null,
      muscleGroup: showMuscleGroup && muscleGroup ? muscleGroup : null,
    };
    const result = isEditing ? await updateExercise(exercise.id, form) : await createExercise(form);
    setSubmitting(false);

    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: `No pudimos ${isEditing ? 'guardar' : 'crear'} el ejercicio`, text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: isEditing ? 'Ejercicio actualizado' : 'Ejercicio creado' });
    onCreated(result.exercise);
  };

  return (
    <>
    <Modal animationType="fade" nativeID="create-exercise-modal" onRequestClose={handleClose} testID="create-exercise-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-exercise-modal-backdrop" onPress={handleClose} testID="create-exercise-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="create-exercise-modal-card" onPress={() => {}} testID="create-exercise-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="create-exercise-modal-header" testID="create-exercise-modal-header">
            <MaterialCommunityIcons color={colors.primary} name={isEditing ? 'pencil-outline' : 'dumbbell'} size={20} />
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-exercise-modal-title" testID="create-exercise-modal-title">
              {isEditing ? 'Editar ejercicio' : 'Nuevo ejercicio'}
            </Text>
          </View>

          <ResponsiveSelectField dense hideErrorRow label="Tipo" onChange={setKind} options={EXERCISE_KIND_OPTIONS} required value={kind} />

          {showIntensity && (
            <View className="mb-3" nativeID="create-exercise-modal-intensity" testID="create-exercise-modal-intensity">
              <Text className={FIELD_LABEL} nativeID="create-exercise-modal-intensity-label" testID="create-exercise-modal-intensity-label">Intensidad</Text>
              <IntensitySegmentedPicker idPrefix="create-exercise-modal" onChange={setIntensity} value={intensity} />
            </View>
          )}

          {showMuscleGroup && (
            <ResponsiveSelectField dense error={error} label="Grupo muscular" onChange={(v) => { setMuscleGroup(v); if (error) setError(null); }} options={MUSCLE_GROUP_OPTIONS} placeholder="Elegí el grupo muscular" required value={muscleGroup} />
          )}

          {(kind === 'walking' || kind === 'jogging') && (
            <Row narrowClassName="gap-3">
              <Col><InputField className="mb-0" dense hideErrorRow keyboardType="number-pad" label="Minutos" onChange={setMinutes} value={minutes} /></Col>
              <Col><InputField className="mb-0" dense hideErrorRow keyboardType="number-pad" label="Distancia (m)" onChange={setDistanceM} value={distanceM} /></Col>
            </Row>
          )}
          {(kind === 'cruising' || kind === 'running') && (
            <Row narrowClassName="gap-3">
              <Col><InputField className="mb-0" dense hideErrorRow keyboardType="number-pad" label="Distancia (m)" onChange={setDistanceM} value={distanceM} /></Col>
              <Col><InputField className="mb-0" dense hideErrorRow keyboardType="number-pad" label="Velocidad (km/h)" onChange={setSpeedKph} value={speedKph} /></Col>
            </Row>
          )}

          <InputField dense disabled hint="Se arma solo con el tipo, la intensidad y la distancia o duración." label="Nombre" value={computedName} />

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
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-exercise-modal-confirm-label" testID="create-exercise-modal-confirm-label">
                  {isEditing ? 'Guardar cambios' : 'Crear'}
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
