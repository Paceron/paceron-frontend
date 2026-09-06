import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExerciseStore, EXERCISE_KIND_OPTIONS, MUSCLE_GROUP_OPTIONS } from '../../store/exercise-store.js';
import { FIELD_LABEL, InputField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { INTENSITY_ORDER, INTENSITY_META } from './exercise-kind-meta.js';

// Selector de intensidad — a diferencia de un segmented picker "cerrado"
// (Tipo de día, Rol de ejercicio en una sesión), acá la intensidad es
// opcional: tocar el segmento ya activo lo vuelve a dejar sin elegir
// (`value` puede ser null, con los 3 segmentos en gris neutro). Standalone
// en su propia fila, no convive con otro control de altura fija al lado,
// así que el alto queda orgánico.
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
            onPress={() => onChange(active ? null : level)}
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
// dobla como edición: precarga los valores, cambia título/botón y llama
// updateExercise en vez de createExercise — mismo modal, no un
// componente aparte, para no duplicar el formulario. Único obligatorio
// además del tipo: nombre y descripción — intensidad/minutos/distancia/
// velocidad/grupo muscular son todos opcionales y se muestran siempre,
// sin importar el tipo elegido (ver enmienda 2026-09-06 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md: intentar
// mapear qué característica aplica a qué tipo terminó siendo más
// complejidad de la que valía, dado lo variado que es un ejercicio real).
export function CreateExerciseModal({ visible, onClose, onCreated, exercise }) {
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const createExercise = useExerciseStore((s) => s.createExercise);
  const updateExercise = useExerciseStore((s) => s.updateExercise);
  const isEditing = Boolean(exercise);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('walking');
  const [intensity, setIntensity] = useState(null);
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
  // setState de acá no se reflejan en `name`/`kind`/etc. hasta el
  // próximo render (React no muta el valor en el render en curso), así
  // que dirtyValues no puede leerlos directo — usa los valores
  // "efectivos" post-reset (`resetValues`) mientras `isResetting` es
  // true, y `useFormDirty` recibe ese objeto como snapshot base en el
  // mismo render donde resetKey cambia. Sin este ajuste, useFormDirty
  // capturaría el baseline un render antes de tiempo, con los valores
  // viejos/vacíos todavía en los states, y marcaría dirty=true de
  // entrada al reabrir en modo edición (falso positivo).
  const resetValues = {
    name: exercise?.name ?? '',
    description: exercise?.description ?? '',
    kind: exercise?.kind ?? 'walking',
    intensity: exercise?.intensity ?? null,
    minutes: exercise?.minutes != null ? String(exercise.minutes) : '',
    distanceM: exercise?.distanceM != null ? String(exercise.distanceM) : '',
    speedKph: exercise?.speedKph != null ? String(exercise.speedKph) : '',
    muscleGroup: exercise?.muscleGroup ?? '',
  };

  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    setName(resetValues.name);
    setDescription(resetValues.description);
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

  const dirtyValues = isResetting ? resetValues : { name, description, kind, intensity, minutes, distanceM, speedKph, muscleGroup };
  const formDirty = useFormDirty(dirtyValues, exercise?.id ?? 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!name.trim() || !description.trim()) {
      setError('Completá el nombre y la descripción.');
      return;
    }
    setSubmitting(true);
    const form = {
      ownerId: user?.userId,
      name: name.trim(),
      description: description.trim(),
      kind,
      intensity,
      minutes: minutes ? Number(minutes) : null,
      distanceM: distanceM ? Number(distanceM) : null,
      speedKph: speedKph ? Number(speedKph) : null,
      muscleGroup: muscleGroup || null,
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

          <InputField autoFocus={!isWeb && visible} dense error={error} label="Nombre" onChange={(text) => { setName(text); if (error) setError(null); }} placeholder="Ej. Fartlek de martes" value={name} />
          <InputField dense hideErrorRow label="Descripción" multiline numberOfLines={2} onChange={setDescription} placeholder="Para qué sirve, cómo se hace." value={description} />
          <ResponsiveSelectField dense hideErrorRow label="Tipo" onChange={setKind} options={EXERCISE_KIND_OPTIONS} required value={kind} />

          <View className="mb-3" nativeID="create-exercise-modal-intensity" testID="create-exercise-modal-intensity">
            <Text className={FIELD_LABEL} nativeID="create-exercise-modal-intensity-label" testID="create-exercise-modal-intensity-label">Intensidad (opcional)</Text>
            <IntensitySegmentedPicker idPrefix="create-exercise-modal" onChange={setIntensity} value={intensity} />
          </View>

          <Row narrowClassName="gap-3">
            <Col><InputField className="mb-0" dense hideErrorRow keyboardType="number-pad" label="Minutos" onChange={setMinutes} value={minutes} /></Col>
            <Col><InputField className="mb-0" dense hideErrorRow keyboardType="number-pad" label="Distancia (m)" onChange={setDistanceM} value={distanceM} /></Col>
          </Row>
          <Row narrowClassName="gap-3">
            <Col><InputField className="mb-0" dense hideErrorRow keyboardType="number-pad" label="Velocidad (km/h)" onChange={setSpeedKph} value={speedKph} /></Col>
            <Col><ResponsiveSelectField className="mb-0" dense hideErrorRow label="Grupo muscular" onChange={setMuscleGroup} options={MUSCLE_GROUP_OPTIONS} placeholder="Ninguno" value={muscleGroup} /></Col>
          </Row>

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
