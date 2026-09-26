import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useSessionFeedback, useSaveSetMutation, useFinishRunnerMutation, useSaveExerciseMutation, buildManualSetPayload } from '../../hooks/use-session-feedback.js';
import { createRunnerSession } from '../../services/runnerSession.js';
import { buildSessionReviewModel } from '../../services/normalizers.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { formatClock, formatDurationInput, formatStopwatch, parseClockToMs } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { composeDateTime, deriveDurationMs, mirrorEndIfEmpty, splitDateTime } from '../../utils/datetime-parts.js';
import { DateField, DurationField, InputField, TimeField } from '../forms/fields.jsx';
import { TrajectorySketch } from './trajectory-sketch.jsx';
import { VoiceAnnotationControls } from './voice-annotation-controls.jsx';

const ROW_STATUS = {
  completed: { label: 'Completada', color: 'text-emerald-700 dark:text-emerald-400', icon: 'check-circle' },
  skipped: { label: 'Saltada', color: 'text-slate-500 dark:text-slate-400', icon: 'skip-next-circle-outline' },
  unregistered: { label: 'Sin registro', color: 'text-slate-500 dark:text-slate-400', icon: 'circle-outline' },
};

const DASH = '—';

const pad2 = (n) => String(n).padStart(2, '0');

const formatDayTime = (iso) => {
  if (!iso) return DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

// --- Guardado por ejercicio: una tanda de valores → varias series ---

function ExerciseBulkSave({ exercise, onClose, slot }) {
  const colors = useThemeColors();
  const sessionInstanceId = slot.sessionInstanceId ?? slot.sessionInstance?.id;
  const { mutate: saveExercise, isPending } = useSaveExerciseMutation({ sessionInstanceId, athleteUserId: slot.athleteUserId });

  const [durationText, setDurationText] = useState('');
  const [activeText, setActiveText] = useState('');
  const [distanceText, setDistanceText] = useState('');
  const [annotations, setAnnotations] = useState('');
  const [error, setError] = useState(null);

  // Solo tiene sentido cargar de una vez las series que aún no tienen registro.
  const targets = exercise.rows.filter((row) => row.status !== 'skipped');
  const targetIds = targets.map((r) => r.setNumber).join(',');
  const boxId = `session-review-bulk-${exercise.exerciseId}`;

  const handleSave = () => {
    setError(null);
    const durationMs = String(durationText).trim() ? parseClockToMs(durationText) : null;
    if (String(durationText).trim() && durationMs == null) {
      setError('Tiempo total: usá el formato mm:ss (ej. 3:30).');
      return;
    }
    const activeDurationMs = String(activeText).trim() ? parseClockToMs(activeText) : null;
    if (String(activeText).trim() && activeDurationMs == null) {
      setError('Tiempo activo: usá el formato mm:ss (ej. 3:30).');
      return;
    }
    let distanceMeters = null;
    if (String(distanceText).trim()) {
      const parsed = Number(distanceText);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Distancia: ingresá un número de metros.');
        return;
      }
      distanceMeters = parsed;
    }

    saveExercise(
      { slot, exerciseId: exercise.exerciseId, targets, values: { durationMs, activeDurationMs, distanceMeters, annotations: annotations.trim() || null } },
      {
        onSuccess: (saved) => {
          notifySuccess();
          Toast.show({ type: 'success', text1: 'Ejercicio guardado', text2: `${saved.length} serie(s) actualizadas.` });
          onClose();
        },
        onError: (err) => {
          notifyError();
          Toast.show({ type: 'error', text1: 'No pudimos guardar el ejercicio', text2: err?.message ?? '' });
        },
      },
    );
  };

  return (
    <View className="mt-2 rounded-xl border border-primary/40 bg-slate-50 p-3 dark:bg-slate-900/50" key={targetIds} nativeID={boxId} testID={boxId}>
      <Text className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${boxId}-label`} testID={`${boxId}-label`}>
        Guardar {targets.length} serie{targets.length === 1 ? '' : 's'} de {exercise.exerciseName} con los mismos valores
      </Text>

      <View className="flex-row gap-3" nativeID={`${boxId}-times`} testID={`${boxId}-times`}>
        <DurationField className="mb-0 flex-1" hideErrorRow hideLabel label="Tiempo total" onChange={setDurationText} placeholder="330 → 3:30" value={durationText} />
        <DurationField className="mb-0 flex-1" hideErrorRow hideLabel label="Tiempo activo" onChange={setActiveText} placeholder="320 → 3:20" value={activeText} />
      </View>
      <InputField dense keyboardType="number-pad" label="Distancia (metros)" onChange={setDistanceText} placeholder="Ej. 1200" value={distanceText} />

      <View className="max-h-28" nativeID={`${boxId}-annotations-box`} testID={`${boxId}-annotations-box`}>
        <ScrollView nestedScrollEnabled nativeID={`${boxId}-annotations-scroll`} testID={`${boxId}-annotations-scroll`}>
          <InputField dense hideLabel label="Anotaciones" multiline numberOfLines={3} onChange={setAnnotations} placeholder="Anotaciones para estas series…" value={annotations} />
        </ScrollView>
      </View>

      {error && (
        <Text className="mb-2 text-xs text-red-500 dark:text-red-400" nativeID={`${boxId}-error`} testID={`${boxId}-error`}>{error}</Text>
      )}

      <View className="mt-2 flex-row gap-2" nativeID={`${boxId}-actions`} testID={`${boxId}-actions`}>
        <Pressable className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80 disabled:opacity-50" disabled={isPending} nativeID={`${boxId}-save`} onPress={handleSave} testID={`${boxId}-save`}>
          {isPending ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <MaterialCommunityIcons color={colors.onPrimary} name="content-save-outline" size={16} />}
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${boxId}-save-label`} testID={`${boxId}-save-label`}>
            Guardar ejercicio
          </Text>
        </Pressable>
        <Pressable className="h-11 w-11 items-center justify-center rounded-full border border-slate-300 active:opacity-70 dark:border-slate-600" nativeID={`${boxId}-cancel`} onPress={onClose} testID={`${boxId}-cancel`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

// --- Vista A: lista de ejercicios/series ---

function ReviewListView({ slot, reviewModel, loading, completing, onOpenRow }) {
  const colors = useThemeColors();
  const router = useRouter();
  const showBadge = slot.mode === 'review';
  const [bulkExerciseId, setBulkExerciseId] = useState(null);

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="session-review-screen-root" testID="session-review-screen-root">
      <ScrollView contentContainerClassName="px-4 py-6" nativeID="session-review-screen-scroll" testID="session-review-screen-scroll">
        <Pressable className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70" nativeID="session-review-screen-back-button" onPress={() => router.back()} testID="session-review-screen-back-button">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
        </Pressable>

        <View className="mb-5 mt-4" nativeID="session-review-screen-header" testID="session-review-screen-header">
          <Text className="text-base text-slate-500 dark:text-slate-400" nativeID="session-review-screen-date" testID="session-review-screen-date">
            {formatWeekdayLabel(slot.date)}, {formatDisplayDate(slot.date)}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-2" nativeID="session-review-screen-title-row" testID="session-review-screen-title-row">
            <Text className="flex-shrink text-2xl text-slate-900 dark:text-white" nativeID="session-review-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="session-review-screen-title">
              {slot.sessionName ?? slot.sessionInstance?.name ?? 'Registro de Sesión'}
            </Text>
            {showBadge && (
              <View className="flex-row items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-900/20" nativeID="session-review-screen-completed-badge" testID="session-review-screen-completed-badge">
                <MaterialCommunityIcons color="#16a34a" name="check-decagram" size={14} />
                <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400" nativeID="session-review-screen-completed-badge-label" testID="session-review-screen-completed-badge-label">
                  Sesión completada
                </Text>
              </View>
            )}
          </View>
          <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-screen-mode-hint" testID="session-review-screen-mode-hint">
            {slot.mode === 'manual' ? 'Ingreso manual — cargá las series que faltan.' : 'Revisión — tocá una serie para ver y editar sus datos.'}
            {slot.teamName ? ` · ${slot.teamName}${slot.groupName ? ` · ${slot.groupName}` : ''}` : ''}
          </Text>
          {completing && (
            <View className="mt-2 flex-row items-center gap-2" nativeID="session-review-screen-completing" testID="session-review-screen-completing">
              <ActivityIndicator color={colors.primary} size="small" />
              <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400" nativeID="session-review-screen-completing-label" testID="session-review-screen-completing-label">
                Completando la sesión…
              </Text>
            </View>
          )}
        </View>

        {loading && reviewModel.length === 0 ? (
          <View className="items-center justify-center py-12" nativeID="session-review-screen-loading" testID="session-review-screen-loading">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View className="gap-3" nativeID="session-review-screen-exercise-list" testID="session-review-screen-exercise-list">
            {reviewModel.map((exercise) => {
              const exerciseId = `session-review-exercise-${exercise.exerciseId}`;
              // Mismo criterio que `editable` del detalle: "sin registro" entra
              // también en revisión, así que el guardado por ejercicio las cubre.
              const editableRows = exercise.rows.filter((row) => row.status === 'completed' || row.status === 'unregistered');
              const canBulkSave = editableRows.length > 1;
              return (
              <View className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" key={exercise.exerciseId} nativeID={exerciseId} testID={exerciseId}>
                <View className="mb-1 flex-row items-center justify-between gap-2" nativeID={`${exerciseId}-header`} testID={`${exerciseId}-header`}>
                  <Text className="flex-1 text-sm font-bold text-slate-900 dark:text-white" nativeID={`${exerciseId}-name`} testID={`${exerciseId}-name`}>
                    {exercise.exerciseName}
                  </Text>
                  {canBulkSave && (
                    <Pressable
                      className="h-8 flex-row items-center gap-1 rounded-full border border-slate-200 px-2.5 active:opacity-70 dark:border-slate-700"
                      nativeID={`${exerciseId}-bulk-toggle`}
                      onPress={() => setBulkExerciseId((v) => (v === exercise.exerciseId ? null : exercise.exerciseId))}
                      testID={`${exerciseId}-bulk-toggle`}
                    >
                      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="playlist-edit" size={14} />
                      <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300" nativeID={`${exerciseId}-bulk-toggle-label`} testID={`${exerciseId}-bulk-toggle-label`}>
                        Guardar todo
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View className="gap-1.5" nativeID={`${exerciseId}-rows`} testID={`${exerciseId}-rows`}>
                  {exercise.rows.map((row) => {
                    const meta = ROW_STATUS[row.status] ?? ROW_STATUS.unregistered;
                    const summary = row.feedback
                      ? [row.feedback.durationMs != null ? formatStopwatch(row.feedback.durationMs) : null, row.feedback.distanceMeters != null ? formatMeters(row.feedback.distanceMeters) : null].filter(Boolean).join(' · ')
                      : '';
                    const rowId = `${exerciseId}-set-${row.setNumber}`;
                    return (
                      <Pressable className="flex-row items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 active:opacity-70 dark:border-slate-800 dark:bg-slate-900/50" key={row.setNumber} nativeID={rowId} onPress={() => onOpenRow({ exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName, setNumber: row.setNumber, row })} testID={rowId}>
                        <MaterialCommunityIcons color={colors.primary} name={meta.icon} size={18} />
                        <View className="flex-1" nativeID={`${rowId}-text`} testID={`${rowId}-text`}>
                          <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100" nativeID={`${rowId}-label`} testID={`${rowId}-label`}>
                            Serie {row.setNumber}
                          </Text>
                          {summary ? (
                            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${rowId}-summary`} testID={`${rowId}-summary`}>
                              {summary}
                            </Text>
                          ) : null}
                        </View>
                        <Text className={`text-xs font-bold ${meta.color}`} nativeID={`${rowId}-status`} testID={`${rowId}-status`}>
                          {meta.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {bulkExerciseId === exercise.exerciseId && (
                  <ExerciseBulkSave exercise={exercise} onClose={() => setBulkExerciseId(null)} slot={slot} />
                )}
              </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Fila de dato: read-only hasta que se aprieta el lapiz ---

function DataField({ editable, editing, id, label, hint, children, onToggleEdit }) {
  return (
    <View className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-surface" nativeID={id} testID={id}>
      <View className="flex-row items-center justify-between gap-2" nativeID={`${id}-header`} testID={`${id}-header`}>
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${id}-label`} testID={`${id}-label`}>
          {label}
        </Text>
        {editable && (
          <Pressable
            className="h-6 w-6 items-center justify-center rounded-full active:opacity-70"
            hitSlop={8}
            nativeID={`${id}-edit-button`}
            onPress={onToggleEdit}
            testID={`${id}-edit-button`}
          >
            <MaterialCommunityIcons color={editing ? '#16a34a' : '#94a3b8'} name={editing ? 'check' : 'pencil-outline'} size={15} />
          </Pressable>
        )}
      </View>
      <View className="mt-1" nativeID={`${id}-value`} testID={`${id}-value`}>
        {editing ? children : <Text className="text-sm text-slate-800 dark:text-slate-100" nativeID={`${id}-readonly-text`} testID={`${id}-readonly-text`}>{children}</Text>}
      </View>
      {hint ? (
        <Text className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500" nativeID={`${id}-hint`} testID={`${id}-hint`}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// --- Vista B: detalle a pantalla completa + edición ---

function SetDetailView({ slot, exerciseId, exerciseName, row, onBack, onSeriesSaved }) {
  const colors = useThemeColors();
  const feedback = row.feedback;

  // "Sin registro" es editable en AMBOS modos, no solo en manual: una sesión
  // puede estar `finished` (todas las series completadas o salteadas) y aun así
  // quedarle alguna serie sin fila de feedback — por ejemplo una que el
  // corredor salteó y después quiere cargar igual. Guardarla crea la fila
  // (POST, no PATCH) vía buildManualSetPayload; ver useSaveSetMutation.
  const editable = row.status === 'completed' || row.status === 'unregistered';

  const [editing, setEditing] = useState(false);
  const [durationText, setDurationText] = useState(feedback?.durationMs != null ? formatDurationInput(String(feedback.durationMs)) : '');
  const [activeText, setActiveText] = useState(feedback?.activeDurationMs != null ? formatDurationInput(String(feedback.activeDurationMs)) : '');
  const [distanceText, setDistanceText] = useState(feedback?.distanceMeters != null ? String(Math.round(feedback.distanceMeters)) : '');
  // Fecha y hora van en los dos formatos que ya manejan DateField/TimeField
  // (DD/MM/AAAA y HH:mm); se componen a ISO recién en handleSave.
  const initialStart = useMemo(() => splitDateTime(feedback?.startedAt), [feedback?.startedAt]);
  const initialEnd = useMemo(() => splitDateTime(feedback?.endedAt), [feedback?.endedAt]);
  const [startedDate, setStartedDate] = useState(initialStart.date);
  const [startedTime, setStartedTime] = useState(initialStart.time);
  const [endedDate, setEndedDate] = useState(initialEnd.date);
  const [endedTime, setEndedTime] = useState(initialEnd.time);
  const [annotations, setAnnotations] = useState(feedback?.annotations ?? '');
  const [error, setError] = useState(null);

  const sessionInstanceId = slot.sessionInstanceId ?? slot.sessionInstance?.id;
  const { mutate: saveSet, isPending: saving } = useSaveSetMutation({ sessionInstanceId, athleteUserId: slot.athleteUserId });

  const isDirty = useFormDirty({ durationText, activeText, distanceText, startedDate, startedTime, endedDate, endedTime, annotations }, `${exerciseId}-${row.setNumber}`);
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  // --- Editores de fecha/hora: espejo inicio→fin + duración derivada ---
  // Las dos reglas viven en utils/datetime-parts.js para que sean testeables
  // sin renderizar. Se aplican JUNTAS y en un solo lugar porque comparten el
  // mismo estado: tocar la fecha de inicio primero espeja el fin (quedaría
  // end==start) y después calcula la duración 0 → que deriveDurationMs
  // rechaza, así que recién cuando llega la hora del fin se completa sola.
  const applyDateTimeChange = (part, value) => {
    const next = { startedDate, startedTime, endedDate, endedTime, [part]: value };

    const isStartPart = part === 'startedDate' || part === 'startedTime';
    const mirrored = mirrorEndIfEmpty({
      startChanged: isStartPart,
      nextStartValue: value,
      currentEndValue: isStartPart ? next.endedDate : next.endedTime,
    });
    if (mirrored != null) {
      if (part === 'startedDate') next.endedDate = mirrored;
      else next.endedTime = mirrored;
    }

    // Solo autocompleta si el campo duración sigue vacío.
    const derived = deriveDurationMs({ durationText, ...next });
    if (derived != null) setDurationText(formatDurationInput(String(derived)));

    setStartedDate(next.startedDate);
    setStartedTime(next.startedTime);
    setEndedDate(next.endedDate);
    setEndedTime(next.endedTime);
  };

  const handleStartDateChange = (v) => applyDateTimeChange('startedDate', v);
  const handleStartTimeChange = (v) => applyDateTimeChange('startedTime', v);
  const handleEndDateChange = (v) => applyDateTimeChange('endedDate', v);
  const handleEndTimeChange = (v) => applyDateTimeChange('endedTime', v);

  const parseDuration = (text, label) => {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return null;
    const ms = parseClockToMs(trimmed);
    if (ms == null) {
      setError(`${label}: usá dígitos — el formato se arma solo (ej. 330 → 3:30).`);
      return undefined;
    }
    return ms;
  };

  const handleSave = () => {
    setError(null);

    const durationParsed = parseDuration(durationText, 'Tiempo total');
    if (durationParsed === undefined) return;
    const activeParsed = parseDuration(activeText, 'Tiempo activo');
    if (activeParsed === undefined) return;

    const durationMs = durationParsed ?? feedback?.durationMs ?? null;
    const activeDurationMs = activeParsed ?? feedback?.activeDurationMs ?? null;

    let distanceMeters = feedback?.distanceMeters ?? null;
    if (String(distanceText ?? '').trim()) {
      const parsed = Number(distanceText);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Distancia: ingresá un número de metros.');
        return;
      }
      distanceMeters = parsed;
    }

    // Inicio/fin: fecha y hora se componen juntas. Si la fecha está vacía pero
    // la hora no (o al revés) se considera inválido — a medio escribir no se guarda.
    const resolveDateTime = (dateText, timeText, fallbackIso, label) => {
      const hasDate = Boolean(String(dateText).trim());
      const hasTime = Boolean(String(timeText).trim());
      if (!hasDate && !hasTime) return { value: fallbackIso ?? null };
      if (!hasDate || !hasTime) {
        setError(`${label}: cargá fecha y hora, o ninguna de las dos.`);
        return { invalid: true };
      }
      const composed = composeDateTime(dateText, timeText);
      if (!composed) {
        setError(`${label}: fecha u hora inválida.`);
        return { invalid: true };
      }
      return { value: composed.toISOString() };
    };

    const start = resolveDateTime(startedDate, startedTime, feedback?.startedAt, 'Inicio');
    if (start.invalid) return;
    const end = resolveDateTime(endedDate, endedTime, feedback?.endedAt, 'Fin');
    if (end.invalid) return;

    if (start.value && end.value && new Date(end.value) < new Date(start.value)) {
      setError('El fin no puede ser anterior al inicio.');
      return;
    }

    const editValues = {
      startedAt: start.value ?? null,
      endedAt: end.value ?? null,
      durationMs,
      activeDurationMs,
      distanceMeters,
      annotations: annotations.trim() || null,
    };
    const createPayload = buildManualSetPayload({ slot, exerciseId, setNumber: row.setNumber, values: editValues });
    saveSet(
      { feedback, editValues, createPayload },
      {
        onSuccess: () => {
          onSeriesSaved();
          notifySuccess();
          Toast.show({ type: 'success', text1: 'Serie guardada' });
          // Vuelve al listado: la serie ya quedó persista y el detalle ya no
          // tiene nada pendiente. El effect que completa la sesión vive en
          // ReviewFlow (que sigue montado), así que el PATCH finished igual
          // dispara aunque salgamos del detalle en el mismo tick.
          onBack();
        },
        onError: (err) => {
          notifyError();
          Toast.show({ type: 'error', text1: 'No pudimos guardar la serie', text2: err?.message ?? '' });
        },
      },
    );
  };

  const handleBack = () => guardedClose(() => onBack());

  const displayDuration = (ms) => {
    if (ms == null) return DASH;
    return formatClock(ms);
  };

  // El input muestra mm:ss pero lo que se guarda (y lo que el backend llama
  // duration_ms) son milisegundos. Mostrar el equivalente abajo del valor
  // evita la confusión de un label que decía "ms" sobre un campo "mm:ss".
  const durationHint = (() => {
    const ms = parseClockToMs(durationText);
    if (ms == null) return feedback?.durationMs != null ? `Se guarda como ${Math.round(feedback.durationMs)} ms` : 'Se guarda en milisegundos';
    return `${Math.round(ms)} ms`;
  })();

  const meta = ROW_STATUS[row.status] ?? ROW_STATUS.unregistered;
  const fieldId = `session-review-detail-field-${row.setNumber}`;

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="session-review-detail-root" testID="session-review-detail-root">
      <ScrollView contentContainerClassName="px-4 py-6" nativeID="session-review-detail-scroll" testID="session-review-detail-scroll">
        <Pressable className="h-9 w-9 items-center justify-center self-start rounded-full active:opacity-70" nativeID="session-review-detail-back-button" onPress={handleBack} testID="session-review-detail-back-button">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={20} />
        </Pressable>

        <View className="mb-5 mt-4" nativeID="session-review-detail-header" testID="session-review-detail-header">
          <View className="flex-row flex-wrap items-center gap-2" nativeID="session-review-detail-title-row" testID="session-review-detail-title-row">
            <Text className="flex-shrink text-xl text-slate-900 dark:text-white" nativeID="session-review-detail-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="session-review-detail-title">
              Serie {row.setNumber} · {exerciseName}
            </Text>
            <Text className={`text-xs font-bold ${meta.color}`} nativeID="session-review-detail-status" testID="session-review-detail-status">
              {meta.label}
            </Text>
          </View>
        </View>

        {row.status === 'skipped' && (
          <View className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40" nativeID="session-review-detail-skipped-note" testID="session-review-detail-skipped-note">
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-skipped-note-label" testID="session-review-detail-skipped-note-label">
              Esta serie fue salteada — no tiene valores para editar en esta versión.
            </Text>
          </View>
        )}

        {row.status === 'unregistered' && (
          <View className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40" nativeID="session-review-detail-unregistered-note" testID="session-review-detail-unregistered-note">
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-unregistered-note-label" testID="session-review-detail-unregistered-note-label">
              Esta serie no tiene registro todavía — cargá los datos y se guardan.
            </Text>
          </View>
        )}

        <View className="mb-4 gap-2.5" nativeID="session-review-detail-fields" testID="session-review-detail-fields">
          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-started`}
            label="Inicio (started_at)"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <View className="gap-2" nativeID={`${fieldId}-started-editor`} testID={`${fieldId}-started-editor`}>
                <DateField
                  disableFutureLimit
                  label="Fecha de inicio"
                  onChange={handleStartDateChange}
                  value={startedDate}
                />
                <TimeField
                  className="mb-0"
                  hideErrorRow
                  label="Hora de inicio"
                  onChange={handleStartTimeChange}
                  value={startedTime}
                />
              </View>
            ) : (
              formatDayTime(feedback?.startedAt)
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-ended`}
            label="Fin (ended_at)"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <View className="gap-2" nativeID={`${fieldId}-ended-editor`} testID={`${fieldId}-ended-editor`}>
                <DateField
                  disableFutureLimit
                  label="Fecha de fin"
                  onChange={handleEndDateChange}
                  value={endedDate}
                />
                <TimeField
                  className="mb-0"
                  hideErrorRow
                  label="Hora de fin"
                  onChange={handleEndTimeChange}
                  value={endedTime}
                />
              </View>
            ) : (
              formatDayTime(feedback?.endedAt)
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            hint={durationHint}
            id={`${fieldId}-duration`}
            label="Duración"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <DurationField
                className="mb-0"
                hideErrorRow
                hideLabel
                label="Duración"
                onChange={setDurationText}
                placeholder="330 → 3:30"
                value={durationText}
              />
            ) : (
              displayDuration(feedback?.durationMs)
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-active`}
            label="Tiempo activo (active_duration_ms)"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <DurationField
                className="mb-0"
                hideErrorRow
                hideLabel
                label="Tiempo activo"
                onChange={setActiveText}
                placeholder="320 → 3:20"
                value={activeText}
              />
            ) : (
              displayDuration(feedback?.activeDurationMs)
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-distance`}
            label="Distancia (m)"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <InputField dense hideLabel keyboardType="number-pad" label="Distancia (metros)" onChange={setDistanceText} placeholder="Ej. 1200" value={distanceText} />
            ) : (
              feedback?.distanceMeters != null ? formatMeters(feedback.distanceMeters) : DASH
            )}
          </DataField>

          <DataField
            editable={editable}
            editing={editing}
            id={`${fieldId}-annotations`}
            label="Anotaciones"
            onToggleEdit={() => setEditing((v) => !v)}
          >
            {editing ? (
              <View className="gap-2" nativeID={`${fieldId}-annotations-editor`} testID={`${fieldId}-annotations-editor`}>
                <View className="max-h-40" nativeID={`${fieldId}-annotations-scroll-box`} testID={`${fieldId}-annotations-scroll-box`}>
                  <ScrollView nestedScrollEnabled nativeID={`${fieldId}-annotations-scroll`} testID={`${fieldId}-annotations-scroll`}>
                    <InputField dense hideLabel label="Anotaciones" multiline numberOfLines={4} onChange={setAnnotations} placeholder="Notas sobre esta serie…" value={annotations} />
                  </ScrollView>
                </View>
                <VoiceAnnotationControls onAppendText={setAnnotations} text={annotations} />
              </View>
            ) : feedback?.annotations ? (
              <ScrollView nestedScrollEnabled className="max-h-32" nativeID={`${fieldId}-annotations-readonly-scroll`} testID={`${fieldId}-annotations-readonly-scroll`}>
                <Text className="text-sm text-slate-800 dark:text-slate-100" nativeID={`${fieldId}-annotations-readonly-text`} testID={`${fieldId}-annotations-readonly-text`}>
                  {feedback.annotations}
                </Text>
              </ScrollView>
            ) : (
              DASH
            )}
          </DataField>
        </View>

        {feedback && (
          <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="session-review-detail-persisted" testID="session-review-detail-persisted">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-label" testID="session-review-detail-persisted-label">
              Metadatos
            </Text>
            <View className="gap-1.5" nativeID="session-review-detail-persisted-values" testID="session-review-detail-persisted-values">
              <View className="flex-row items-center justify-between" nativeID="session-review-detail-persisted-gps" testID="session-review-detail-persisted-gps">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-gps-label" testID="session-review-detail-persisted-gps-label">Puntos GPS</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-gps-value" testID="session-review-detail-persisted-gps-value">
                  {feedback.pointsCount > 0 ? `${feedback.pointsCount} punto(s)` : 'Sin puntos'}
                </Text>
              </View>
              <View className="flex-row items-center justify-between" nativeID="session-review-detail-persisted-source" testID="session-review-detail-persisted-source">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-source-label" testID="session-review-detail-persisted-source-label">Origen</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-source-value" testID="session-review-detail-persisted-source-value">
                  {feedback.reportSource ?? DASH}
                </Text>
              </View>
            </View>
          </View>
        )}

        {feedback && (
          <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="session-review-detail-trajectory-card" testID="session-review-detail-trajectory-card">
            <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-review-detail-trajectory-card-label" testID="session-review-detail-trajectory-card-label">
              Trayectoria
            </Text>
            <TrajectorySketch feedbackId={feedback.id} pointsCount={feedback.pointsCount} />
          </View>
        )}

        {editable && (
          <View className="gap-2" nativeID="session-review-detail-actions" testID="session-review-detail-actions">
            {error && (
              <Text className="text-xs text-red-500 dark:text-red-400" nativeID="session-review-detail-error" testID="session-review-detail-error">{error}</Text>
            )}

            <Pressable
              className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80 ${saving || !editing ? 'opacity-50' : ''}`}
              disabled={saving || !editing}
              nativeID="session-review-detail-save-button"
              onPress={handleSave}
              testID="session-review-detail-save-button"
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons color={colors.onPrimary} name="content-save-outline" size={18} />
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="session-review-detail-save-label" testID="session-review-detail-save-label">
                    Guardar serie
                  </Text>
                </>
              )}
            </Pressable>

            {!editing && (
              <Text className="text-center text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-edit-hint" testID="session-review-detail-edit-hint">
                Tocá el ícono de lápiz para editar los valores.
              </Text>
            )}
          </View>
        )}

        <View className="h-8" nativeID="session-review-detail-spacer" testID="session-review-detail-spacer" />
      </ScrollView>

      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </SafeAreaView>
  );
}

// --- Flujo (Vista A ↔ Vista B) ---

function ReviewFlow({ slot }) {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [completedNow, setCompletedNow] = useState(false);

  const sessionInstanceId = slot.sessionInstanceId ?? slot.sessionInstance?.id;
  const { groups, loading } = useSessionFeedback(sessionInstanceId, slot.athleteUserId);

  // Primer ingreso al modo manual → upsert idempotente de runner_session
  // (wip). Fire-and-forget: si falla (offline), el pipeline de sync del
  // próximo run reintenta el mismo create. El 200 de "ya existía" es ok.
  const manualFiredRef = useRef(false);
  useEffect(() => {
    if (slot.mode !== 'manual' || manualFiredRef.current) return;
    manualFiredRef.current = true;
    createRunnerSession(sessionInstanceId, { startDate: new Date().toISOString(), athleteUserId: slot.athleteUserId }).catch(() => {});
  }, [slot.mode, sessionInstanceId, slot.athleteUserId]);

  // Completar la sesión (PATCH finished) vive ACÁ y no en el detalle: al
  // guardar una serie se vuelve al listado, el detalle se desmonta, y el
  // effect igual tiene que correr. Solo dispara si hubo al menos un guardado
  // en esta visita (no al entrar a una sesión que ya venía completa).
  const { mutate: finishRunner, isPending: finishing } = useFinishRunnerMutation({ sessionInstanceId, athleteUserId: slot.athleteUserId });
  const saveCountRef = useRef(0);
  const finishedRef = useRef(false);
  useEffect(() => {
    if (slot.mode !== 'manual' || saveCountRef.current === 0 || finishedRef.current) return;
    const all = buildSessionReviewModel(slot.sessionInstance ?? {}, groups);
    const total = all.reduce((acc, exercise) => acc + exercise.rows.length, 0);
    const registered = all.reduce((acc, exercise) => acc + exercise.rows.filter((r) => r.status === 'completed').length, 0);
    if (registered === total && total > 0) {
      finishedRef.current = true;
      finishRunner(undefined, { onSuccess: () => setCompletedNow(true) });
    }
  }, [groups, slot.mode, slot.sessionInstance, finishRunner]);

  const reviewModel = useMemo(() => buildSessionReviewModel(slot.sessionInstance ?? {}, groups), [slot.sessionInstance, groups]);
  const sessionName = slot.sessionName ?? slot.sessionInstance?.name;

  if (!slot.sessionInstance?.exercises?.length) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" edges={['top', 'bottom']} nativeID="session-review-empty-root" testID="session-review-empty-root">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="session-review-empty-label" testID="session-review-empty-label">
          Esta sesión no tiene ejercicios para revisar.
        </Text>
        <Pressable className="h-11 items-center justify-center rounded-full bg-primary px-6 active:opacity-80" nativeID="session-review-empty-back-button" onPress={() => router.back()} testID="session-review-empty-back-button">
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="session-review-empty-back-label" testID="session-review-empty-back-label">Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (selected) {
    return (
      <SetDetailView
        exerciseId={selected.exerciseId}
        exerciseName={selected.exerciseName}
        key={`${selected.exerciseId}-${selected.setNumber}`}
        onBack={() => setSelected(null)}
        onSeriesSaved={() => {
          saveCountRef.current += 1;
        }}
        row={selected.row}
        slot={{ ...slot, sessionName }}
      />
    );
  }

  return (
    <ReviewListView
      completing={finishing}
      loading={loading}
      onOpenRow={(payload) => setSelected(payload)}
      reviewModel={reviewModel}
      slot={{ ...slot, sessionName, mode: completedNow ? 'review' : slot.mode }}
    />
  );
}

export function SessionReviewScreen() {
  return (
    <RequireAuth>
      <SessionReviewScreenContent />
    </RequireAuth>
  );
}

function SessionReviewScreenContent() {
  const reviewSlot = useSessionReviewStore((s) => s.reviewSlot);
  if (!reviewSlot) return <Redirect href="/" />;
  return <ReviewFlow key={`${reviewSlot.sessionInstanceId}-${reviewSlot.athleteUserId}-${reviewSlot.mode}`} slot={reviewSlot} />;
}
