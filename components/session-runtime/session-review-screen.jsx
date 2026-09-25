import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useSessionFeedback, useSaveSetMutation, useFinishRunnerMutation, buildManualSetPayload } from '../../hooks/use-session-feedback.js';
import { createRunnerSession } from '../../services/runnerSession.js';
import { buildSessionReviewModel } from '../../services/normalizers.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { formatClock, formatStopwatch, parseClockToMs } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { InputField } from '../forms/fields.jsx';

const ROW_STATUS = {
  completed: { label: 'Completada', color: 'text-emerald-700 dark:text-emerald-400', icon: 'check-circle' },
  skipped: { label: 'Saltada', color: 'text-slate-500 dark:text-slate-400', icon: 'skip-next-circle-outline' },
  unregistered: { label: 'Sin registro', color: 'text-slate-500 dark:text-slate-400', icon: 'circle-outline' },
};

const formatDayTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

// --- Vista A: lista de ejercicios/series ---

function ReviewListView({ slot, reviewModel, loading, onOpenRow }) {
  const colors = useThemeColors();
  const router = useRouter();
  const showBadge = slot.mode === 'review';

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
        </View>

        {loading && reviewModel.length === 0 ? (
          <View className="items-center justify-center py-12" nativeID="session-review-screen-loading" testID="session-review-screen-loading">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View className="gap-3" nativeID="session-review-screen-exercise-list" testID="session-review-screen-exercise-list">
            {reviewModel.map((exercise) => (
              <View className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" key={exercise.exerciseId} nativeID={`session-review-exercise-${exercise.exerciseId}`} testID={`session-review-exercise-${exercise.exerciseId}`}>
                <Text className="mb-1 text-sm font-bold text-slate-900 dark:text-white" nativeID={`session-review-exercise-${exercise.exerciseId}-name`} testID={`session-review-exercise-${exercise.exerciseId}-name`}>
                  {exercise.exerciseName}
                </Text>
                <View className="gap-1.5" nativeID={`session-review-exercise-${exercise.exerciseId}-rows`} testID={`session-review-exercise-${exercise.exerciseId}-rows`}>
                  {exercise.rows.map((row) => {
                    const meta = ROW_STATUS[row.status] ?? ROW_STATUS.unregistered;
                    const summary = row.feedback
                      ? [row.feedback.durationMs != null ? formatStopwatch(row.feedback.durationMs) : null, row.feedback.distanceMeters != null ? formatMeters(row.feedback.distanceMeters) : null].filter(Boolean).join(' · ')
                      : '';
                    const rowId = `session-review-exercise-${exercise.exerciseId}-set-${row.setNumber}`;
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
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Vista B: detalle a pantalla completa + edición ---

function SetDetailView({ slot, exerciseId, exerciseName, row, onBack, onSessionCompleted }) {
  const colors = useThemeColors();
  const feedback = row.feedback;

  const editable = row.status === 'completed' || (row.status === 'unregistered' && slot.mode === 'manual');

  const [durationText, setDurationText] = useState(feedback?.durationMs != null ? formatClock(feedback.durationMs) : '');
  const [activeText, setActiveText] = useState(feedback?.activeDurationMs != null ? formatClock(feedback.activeDurationMs) : '');
  const [distanceText, setDistanceText] = useState(feedback?.distanceMeters != null ? String(Math.round(feedback.distanceMeters)) : '');
  const [error, setError] = useState(null);

  const sessionInstanceId = slot.sessionInstanceId ?? slot.sessionInstance?.id;
  const { groups } = useSessionFeedback(sessionInstanceId, slot.athleteUserId);
  const { mutate: saveSet, isPending: saving } = useSaveSetMutation({ sessionInstanceId, athleteUserId: slot.athleteUserId });
  const { mutate: finishRunner, isPending: finishing } = useFinishRunnerMutation({ sessionInstanceId, athleteUserId: slot.athleteUserId });
  const saveCountRef = useRef(0);
  const finishedRef = useRef(false);

  const isDirty = useFormDirty({ durationText, activeText, distanceText }, `${exerciseId}-${row.setNumber}`);
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (slot.mode !== 'manual' || saveCountRef.current === 0 || finishedRef.current) return;
    const all = buildSessionReviewModel(slot.sessionInstance ?? {}, groups);
    const total = all.reduce((acc, exercise) => acc + exercise.rows.length, 0);
    const registered = all.reduce((acc, exercise) => acc + exercise.rows.filter((r) => r.status === 'completed').length, 0);
    if (registered === total && total > 0) {
      finishedRef.current = true;
      finishRunner(undefined, { onSuccess: () => onSessionCompleted() });
    }
  }, [groups, slot.mode, slot.sessionInstance, finishRunner, onSessionCompleted]);

  const handleSave = () => {
    setError(null);
    const parseOrFallback = (text, fallback) => {
      const trimmed = String(text ?? '').trim();
      if (!trimmed) return fallback;
      const ms = parseClockToMs(trimmed);
      return ms == null ? null : ms;
    };
    const durationMs = parseOrFallback(durationText, feedback?.durationMs ?? null);
    if (String(durationText ?? '').trim() && durationMs == null) {
      setError('Tiempo total: usá el formato mm:ss (ej. 3:30).');
      return;
    }
    const activeDurationMs = parseOrFallback(activeText, feedback?.activeDurationMs ?? null);
    if (String(activeText ?? '').trim() && activeDurationMs == null) {
      setError('Tiempo activo: usá el formato mm:ss (ej. 3:30).');
      return;
    }
    let distanceMeters = feedback?.distanceMeters ?? null;
    if (String(distanceText ?? '').trim()) {
      const parsed = Number(distanceText);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Distancia: ingresá un número de metros.');
        return;
      }
      distanceMeters = parsed;
    }

    const editValues = { durationMs, activeDurationMs, distanceMeters };
    const createPayload = buildManualSetPayload({ slot, exerciseId, setNumber: row.setNumber, values: editValues });
    saveSet(
      { feedback, editValues, createPayload },
      {
        onSuccess: () => {
          saveCountRef.current += 1;
          notifySuccess();
          Toast.show({ type: 'success', text1: 'Serie guardada' });
        },
        onError: (err) => {
          notifyError();
          Toast.show({ type: 'error', text1: 'No pudimos guardar la serie', text2: err?.message ?? '' });
        },
      },
    );
  };

  const handleBack = () => guardedClose(() => onBack());

  const meta = ROW_STATUS[row.status] ?? ROW_STATUS.unregistered;

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

        {row.status === 'unregistered' && slot.mode === 'review' && (
          <View className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40" nativeID="session-review-detail-unregistered-note" testID="session-review-detail-unregistered-note">
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-unregistered-note-label" testID="session-review-detail-unregistered-note-label">
              Esta serie no tiene registro.
            </Text>
          </View>
        )}

        {feedback && (
          <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="session-review-detail-persisted" testID="session-review-detail-persisted">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-label" testID="session-review-detail-persisted-label">
              Datos registrados
            </Text>
            <View className="gap-1.5" nativeID="session-review-detail-persisted-values" testID="session-review-detail-persisted-values">
              <View className="flex-row justify-between" nativeID="session-review-detail-persisted-start" testID="session-review-detail-persisted-start">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-start-label" testID="session-review-detail-persisted-start-label">Inicio</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-start-value" testID="session-review-detail-persisted-start-value">{formatDayTime(feedback.startedAt)}</Text>
              </View>
              <View className="flex-row justify-between" nativeID="session-review-detail-persisted-end" testID="session-review-detail-persisted-end">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-end-label" testID="session-review-detail-persisted-end-label">Fin</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-end-value" testID="session-review-detail-persisted-end-value">{formatDayTime(feedback.endedAt)}</Text>
              </View>
              <View className="flex-row justify-between" nativeID="session-review-detail-persisted-duration" testID="session-review-detail-persisted-duration">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-duration-label" testID="session-review-detail-persisted-duration-label">Duración</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-duration-value" testID="session-review-detail-persisted-duration-value">{feedback.durationMs != null ? formatStopwatch(feedback.durationMs) : '—'}</Text>
              </View>
              <View className="flex-row justify-between" nativeID="session-review-detail-persisted-active" testID="session-review-detail-persisted-active">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-active-label" testID="session-review-detail-persisted-active-label">Activa</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-active-value" testID="session-review-detail-persisted-active-value">{feedback.activeDurationMs != null ? formatStopwatch(feedback.activeDurationMs) : '—'}</Text>
              </View>
              <View className="flex-row justify-between" nativeID="session-review-detail-persisted-distance" testID="session-review-detail-persisted-distance">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-distance-label" testID="session-review-detail-persisted-distance-label">Distancia</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-distance-value" testID="session-review-detail-persisted-distance-value">{feedback.distanceMeters != null ? formatMeters(feedback.distanceMeters) : '—'}</Text>
              </View>
              <View className="flex-row items-center justify-between" nativeID="session-review-detail-persisted-gps" testID="session-review-detail-persisted-gps">
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="session-review-detail-persisted-gps-label" testID="session-review-detail-persisted-gps-label">Puntos GPS</Text>
                <Text className="text-xs font-semibold text-slate-800 dark:text-slate-100" nativeID="session-review-detail-persisted-gps-value" testID="session-review-detail-persisted-gps-value">
                  {feedback.pointsCount > 0 ? `${feedback.pointsCount} punto(s) (solo lectura)` : 'Sin puntos'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {editable && (
          <View className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID="session-review-detail-editor" testID="session-review-detail-editor">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="session-review-detail-editor-label" testID="session-review-detail-editor-label">
              {slot.mode === 'manual' ? 'Cargar esta serie' : 'Editar valores'}
            </Text>

            <View className="flex-row gap-4" nativeID="session-review-detail-editor-fields" testID="session-review-detail-editor-fields">
              <InputField className="flex-1" dense hideLabel keyboardType="numbers-and-punctuation" label="Tiempo total" onChange={setDurationText} placeholder="mm:ss" value={durationText} />
              <InputField className="flex-1" dense hideLabel keyboardType="numbers-and-punctuation" label="Tiempo activo" onChange={setActiveText} placeholder="mm:ss" value={activeText} />
            </View>
            <InputField dense keyboardType="number-pad" label="Distancia (metros)" onChange={setDistanceText} placeholder="Ej. 1200" value={distanceText} />

            {error && (
              <Text className="mb-3 text-xs text-red-500 dark:text-red-400" nativeID="session-review-detail-error" testID="session-review-detail-error">{error}</Text>
            )}

            <Pressable className={`mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80 ${saving ? 'opacity-60' : ''}`} disabled={saving} nativeID="session-review-detail-save-button" onPress={handleSave} testID="session-review-detail-save-button">
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
            {finishing && (
              <Text className="mt-2 text-center text-xs text-emerald-600 dark:text-emerald-400" nativeID="session-review-detail-finishing" testID="session-review-detail-finishing">
                Completando la sesión…
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
        onSessionCompleted={() => setCompletedNow(true)}
        row={selected.row}
        slot={{ ...slot, sessionName }}
      />
    );
  }

  return (
    <ReviewListView
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