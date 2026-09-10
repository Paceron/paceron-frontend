import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { InputField, Row, Col, FIELD_LABEL } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { CreateExerciseModal } from './create-exercise-modal.jsx';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META } from './exercise-kind-meta.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

const WARMCOOL_KINDS = ['walking', 'jogging', 'elongation'];

// Selector de rol de un ejercicio dentro de la sesión — solo-ícono (sin
// label visible, accessibilityLabel por segmento) para que, junto al
// select de ejercicio y el botón de quitar, una fila entera quepa en una
// sola línea incluso en mobile. El contenedor fuerza h-12 explícito en
// vez de dejar que el padding lo determine solo — a diferencia de
// DaySegmentedPicker (training-plan-form-fields.jsx), que nunca tuvo un
// vecino de altura fija al lado y por eso nadie notó que su alto
// orgánico no daba justo 48px. Acá sí importa (pedido explícito: selector
// de rol "a la misma altura" que el resto de los campos).
function SessionRoleSegmentedPicker({ idPrefix, value, onChange }) {
  return (
    <View
      accessibilityLabel="Rol del ejercicio"
      accessibilityRole="radiogroup"
      className="h-12 flex-row items-center gap-1 self-start rounded-full bg-slate-100 px-1 dark:bg-slate-800"
      nativeID={`${idPrefix}-role-pill`}
      testID={`${idPrefix}-role-pill`}
    >
      {SESSION_ROLE_ORDER.map((role) => {
        const meta = SESSION_ROLE_META[role];
        const active = value === role;
        const segId = `${idPrefix}-role-${role}`;
        return (
          <Pressable
            accessibilityLabel={meta.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className={`h-9 w-9 items-center justify-center rounded-full ${active ? meta.bg : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
            key={role}
            nativeID={segId}
            onPress={() => onChange(role)}
            testID={segId}
          >
            <MaterialCommunityIcons color={active ? meta.iconColor : '#94a3b8'} name={meta.icon} size={18} />
          </Pressable>
        );
      })}
    </View>
  );
}

// Una fila = un ejercicio de la sesión. Rol (pill solo-ícono) + select de
// ejercicio + botón de quitar en una sola línea, siempre a la misma
// altura (h-12 los 3); "Serie repetida" es un toggle chico aparte —
// colapsado por default para que la fila no crezca salvo que haga falta,
// mismo criterio ya usado para los días de un plan.
function SessionExerciseRow({ idPrefix, entry, index, catalogExercises, onChangeExercise, onChangeRole, onRemove }) {
  const [isSeries, setIsSeries] = useState(entry.repeatCount > 1);
  const roleOptions = entry.role === 'main' ? catalogExercises : catalogExercises.filter((e) => WARMCOOL_KINDS.includes(e.kind));

  const handleToggleSeries = () => {
    const next = !isSeries;
    setIsSeries(next);
    if (!next) onChangeExercise(entry.localKey, { repeatCount: 1, restMinutes: 0 });
  };

  return (
    <View className="gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-fields`} testID={`${idPrefix}-fields`}>
        <SessionRoleSegmentedPicker idPrefix={idPrefix} onChange={(role) => onChangeRole(entry.localKey, role)} value={entry.role} />
        <View className="flex-1" nativeID={`${idPrefix}-select-wrapper`} testID={`${idPrefix}-select-wrapper`}>
          <ResponsiveSelectField
            className="mb-0"
            dense
            hideErrorRow
            hideLabel
            label={`Ejercicio ${index + 1}`}
            onChange={(exerciseId) => onChangeExercise(entry.localKey, { exerciseId })}
            options={roleOptions.map((e) => ({ id: e.id, name: e.name }))}
            placeholder={roleOptions.length ? 'Elegí un ejercicio' : 'Todavía no hay ejercicios de este tipo'}
            required
            value={entry.exerciseId}
          />
        </View>
        <Pressable
          accessibilityLabel="Quitar ejercicio"
          className="h-12 w-12 items-center justify-center rounded-xl border border-slate-200 hover:bg-red-50 active:opacity-70 dark:border-slate-700 dark:hover:bg-red-900/20"
          nativeID={`${idPrefix}-remove-button`}
          onPress={() => onRemove(entry.localKey)}
          testID={`${idPrefix}-remove-button`}
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel="Marcar como serie repetida"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSeries }}
        className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
        nativeID={`${idPrefix}-series-toggle`}
        onPress={handleToggleSeries}
        testID={`${idPrefix}-series-toggle`}
      >
        <MaterialCommunityIcons color={isSeries ? '#8cc63e' : '#94a3b8'} name="repeat-variant" size={16} />
        <Text className={`text-xs font-semibold ${isSeries ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${idPrefix}-series-toggle-label`} testID={`${idPrefix}-series-toggle-label`}>
          Serie repetida
        </Text>
      </Pressable>

      {isSeries && (
        <Row narrowClassName="gap-3">
          <Col>
            <InputField
              className="mb-0"
              dense
              hideErrorRow
              keyboardType="number-pad"
              label="Repeticiones"
              onChange={(v) => onChangeExercise(entry.localKey, { repeatCount: Number(v) || 1 })}
              value={String(entry.repeatCount)}
            />
          </Col>
          <Col>
            <InputField
              className="mb-0"
              dense
              hideErrorRow
              keyboardType="number-pad"
              label="Descanso entre series (min)"
              onChange={(v) => onChangeExercise(entry.localKey, { restMinutes: Number(v) || 0 })}
              value={String(entry.restMinutes)}
            />
          </Col>
        </Row>
      )}
    </View>
  );
}

// Alta rápida de una sesión nueva desde adentro de armar un día de
// entrenamiento en un plan — mismo motivo que CreateExerciseModal: un
// modal, no una pantalla nueva, para no perder el plan a medio armar.
// Con la prop opcional `session` (ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md)
// dobla como edición, mismo criterio que CreateExerciseModal. Una sesión
// ya no son 3 bloques fijos — es una lista libre de ejercicios, cada uno
// con su propio rol (ver enmienda 2026-09-05 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md); igual se
// pide al menos 1 ejercicio de cada rol al guardar.
export function CreateSessionModal({ visible, onClose, onCreated, session }) {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const catalogExercises = useExerciseStore((s) => s.exercises);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const createSession = useSessionStore((s) => s.createSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const isEditing = Boolean(session);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateExerciseModal, setShowCreateExerciseModal] = useState(false);
  const draftSeq = useRef(0);

  const makeBlankRow = (role) => ({
    localKey: `session-exercise-draft-${Date.now()}-${draftSeq.current++}`,
    exerciseId: '',
    role,
    repeatCount: 1,
    restMinutes: 0,
  });

  const resetKey = `${visible}-${session?.id ?? 'new'}`;
  const prevResetKeyRef = useRef(null);
  const isResetting = visible && resetKey !== prevResetKeyRef.current;

  // Precarga (o limpia) el formulario cada vez que el modal se abre —
  // mismo criterio que CreateExerciseModal. Se ajusta de forma síncrona
  // durante el render (no en un useEffect) para que useFormDirty, más
  // abajo, pueda usar los valores del registro que se está editando en
  // el mismo render donde cambia el resetKey. Los setState de acá no se
  // reflejan en `name`/`description`/`exercises` hasta el próximo render
  // (React no muta el valor en el render en curso), así que dirtyValues
  // no puede leerlos directo — usa los valores "efectivos" post-reset
  // (`resetValues`) mientras `isResetting` es true, y `useFormDirty`
  // recibe ese objeto como snapshot base en el mismo render donde
  // resetKey cambia. Sin este ajuste, useFormDirty capturaría el
  // baseline un render antes de tiempo, con los valores viejos/vacíos
  // todavía en los states, y marcaría dirty=true de entrada al reabrir
  // en modo edición (falso positivo). Una sesión nueva arranca con 1
  // fila en blanco por rol (mismo criterio que antes de este merge).
  const resetValues = {
    name: session?.name ?? '',
    description: session?.description ?? '',
    exercises: session?.exercises?.length ? session.exercises.map((e) => ({ ...e })) : SESSION_ROLE_ORDER.map(makeBlankRow),
  };

  if (isResetting) {
    prevResetKeyRef.current = resetKey;
    setName(resetValues.name);
    setDescription(resetValues.description);
    setExercises(resetValues.exercises);
    setError(null);
  } else if (!visible) {
    prevResetKeyRef.current = null;
  }

  const dirtyValues = isResetting ? resetValues : { name, description, exercises };
  const formDirty = useFormDirty(dirtyValues, session?.id ?? 'new');
  const isDirty = visible && formDirty;
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (visible && user?.userId) fetchExercises(user.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.userId]);

  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };

  const handleChangeExercise = (localKey, patch) => {
    setExercises((rows) => rows.map((r) => (r.localKey === localKey ? { ...r, ...patch } : r)));
  };

  // Si la fila pasa a un rol restringido (calor/calma) y el ejercicio ya
  // elegido no es de los kinds permitidos ahí, se limpia la selección —
  // evita que "Series 400m fuertes" quede como vuelta a la calma.
  const handleChangeRole = (localKey, role) => {
    setExercises((rows) => rows.map((r) => {
      if (r.localKey !== localKey) return r;
      if (role !== 'main' && r.exerciseId) {
        const chosen = catalogExercises.find((e) => e.id === r.exerciseId);
        if (chosen && !WARMCOOL_KINDS.includes(chosen.kind)) return { ...r, role, exerciseId: '' };
      }
      return { ...r, role };
    }));
  };

  const handleAddExercise = () => setExercises((rows) => [...rows, makeBlankRow('main')]);
  const handleRemoveExercise = (localKey) => setExercises((rows) => rows.filter((r) => r.localKey !== localKey));

  const handleSubmit = async () => {
    if (submitting) return;
    if (!name.trim() || exercises.length === 0) {
      setError('Completá el nombre y agregá al menos un ejercicio de cada tipo (entrada en calor, principal, vuelta a la calma).');
      return;
    }
    if (exercises.some((e) => !e.exerciseId)) {
      setError('Completá o quitá los ejercicios sin seleccionar.');
      return;
    }
    const missingRoles = SESSION_ROLE_ORDER.filter((role) => !exercises.some((e) => e.role === role));
    if (missingRoles.length > 0) {
      setError(`Falta al menos un ejercicio de: ${missingRoles.map((r) => SESSION_ROLE_META[r].label).join(', ')}.`);
      return;
    }
    setSubmitting(true);
    const form = {
      ownerId: user?.userId,
      name: name.trim(),
      description: description.trim(),
      exercises,
    };
    const result = isEditing ? await updateSession(session.id, form) : await createSession(form);
    setSubmitting(false);

    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: `No pudimos ${isEditing ? 'guardar' : 'crear'} la sesión`, text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: isEditing ? 'Sesión actualizada' : 'Sesión creada' });
    onCreated(result.session);
  };

  return (
    <>
      <Modal animationType="fade" nativeID="create-session-modal" onRequestClose={handleClose} testID="create-session-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="create-session-modal-backdrop" onPress={handleClose} testID="create-session-modal-backdrop">
          <Pressable className="max-h-[90%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="create-session-modal-card" onPress={() => {}} testID="create-session-modal-card">
            <View className="mb-4 flex-row items-center gap-2" nativeID="create-session-modal-header" testID="create-session-modal-header">
              <MaterialCommunityIcons color={colors.primary} name={isEditing ? 'pencil-outline' : 'clipboard-plus-outline'} size={20} />
              <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="create-session-modal-title" testID="create-session-modal-title">
                {isEditing ? 'Editar sesión' : 'Nueva sesión'}
              </Text>
            </View>

            <ScrollView nativeID="create-session-modal-scroll" showsVerticalScrollIndicator={false} testID="create-session-modal-scroll">
              <InputField autoFocus={!isWeb && visible} dense hideErrorRow label="Nombre" onChange={setName} placeholder="Ej. Series de velocidad" value={name} />
              <InputField dense hideErrorRow label="Descripción" multiline numberOfLines={2} onChange={setDescription} value={description} />

              <View className="mb-2 flex-row items-center justify-between" nativeID="create-session-modal-exercises-header" testID="create-session-modal-exercises-header">
                <Text className={FIELD_LABEL} nativeID="create-session-modal-exercises-header-label" testID="create-session-modal-exercises-header-label">Ejercicios</Text>
                <Pressable
                  className="rounded-lg px-2 py-1 hover:opacity-70 active:opacity-70"
                  nativeID="create-session-modal-create-exercise-button"
                  onPress={() => setShowCreateExerciseModal(true)}
                  testID="create-session-modal-create-exercise-button"
                >
                  <Text className="text-sm font-semibold text-primary" nativeID="create-session-modal-create-exercise-button-label" testID="create-session-modal-create-exercise-button-label">
                    + Crear ejercicio
                  </Text>
                </Pressable>
              </View>

              <View className="gap-2" nativeID="create-session-modal-exercises-list" testID="create-session-modal-exercises-list">
                {exercises.map((entry, index) => (
                  <SessionExerciseRow
                    catalogExercises={catalogExercises}
                    entry={entry}
                    idPrefix={`create-session-modal-exercise-row-${entry.localKey}`}
                    index={index}
                    key={entry.localKey}
                    onChangeExercise={handleChangeExercise}
                    onChangeRole={handleChangeRole}
                    onRemove={handleRemoveExercise}
                  />
                ))}
              </View>

              <Pressable
                className="mb-3 mt-2 h-11 flex-row items-center justify-center gap-1.5 self-start rounded-full border border-dashed border-primary px-4 hover:bg-primary-tint-subtle active:opacity-70 dark:hover:bg-primary/10"
                nativeID="create-session-modal-add-exercise-button"
                onPress={handleAddExercise}
                testID="create-session-modal-add-exercise-button"
              >
                <MaterialCommunityIcons color="#8cc63e" name="plus" size={18} />
                <Text className="text-sm font-semibold text-primary" nativeID="create-session-modal-add-exercise-button-label" testID="create-session-modal-add-exercise-button-label">
                  Agregar ejercicio
                </Text>
              </Pressable>

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
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-session-modal-confirm-label" testID="create-session-modal-confirm-label">
                    {isEditing ? 'Guardar cambios' : 'Crear'}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CreateExerciseModal
        onClose={() => setShowCreateExerciseModal(false)}
        onCreated={() => setShowCreateExerciseModal(false)}
        visible={showCreateExerciseModal}
      />
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
