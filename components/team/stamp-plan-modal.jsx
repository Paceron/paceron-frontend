import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useTrainingPlans } from '../../hooks/use-training-plans.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useGroupCalendar, useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { DateField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { CalendarDayFields } from './calendar-day-fields.jsx';
import { toISODate } from '../../utils/date-field-format.js';
import { buildStampDraft, addDaysISO, findClosedDraftDates } from '../../utils/build-stamp-draft.js';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

function StampPreviewRow({ day, onToggleExpand, expanded, sessionOptions, onChangeDay, existingDay }) {
  const colors = useThemeColors();
  const idPrefix = `stamp-plan-day-${day.sequenceNo}`;
  const kindLabel = day.kind === 'rest' ? 'Descanso' : day.kind === 'other' ? (day.otherName || 'Otra actividad') : 'Entrenamiento';

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-2 active:opacity-80"
        nativeID={`${idPrefix}-toggle`}
        onPress={onToggleExpand}
        testID={`${idPrefix}-toggle`}
      >
        <Text className="w-24 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
          {day.date}
        </Text>
        <Text className="flex-1 text-sm text-slate-900 dark:text-white" nativeID={`${idPrefix}-summary`} testID={`${idPrefix}-summary`}>
          {kindLabel}
        </Text>
        {existingDay && (
          <View className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-900/30" nativeID={`${idPrefix}-conflict-badge`} testID={`${idPrefix}-conflict-badge`}>
            <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-conflict-badge-label`} testID={`${idPrefix}-conflict-badge-label`}>
              Se pisa
            </Text>
          </View>
        )}
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>

      {expanded && (
        <View className="mt-2" nativeID={`${idPrefix}-expanded`} testID={`${idPrefix}-expanded`}>
          <CalendarDayFields
            currentSessionInstance={null}
            disabled={false}
            idPrefix={idPrefix}
            isPresencial={day.isPresencial}
            kind={day.kind}
            onIsPresencialChange={(v) => onChangeDay({ isPresencial: v, touched: true })}
            onKindChange={(v) => onChangeDay({ kind: v, touched: true })}
            onOtherNameChange={(text) => onChangeDay({ otherName: text, touched: true })}
            onPresencialLocationChange={(v) => onChangeDay({ presencialLocation: v, touched: true })}
            onPresencialTimeFromChange={(v) => onChangeDay({ presencialTimeFrom: v, touched: true })}
            onPresencialTimeToChange={(v) => onChangeDay({ presencialTimeTo: v, touched: true })}
            onSessionIdChange={(v) => onChangeDay({ sessionId: v, touched: true })}
            otherName={day.otherName ?? ''}
            presencialLocation={day.presencialLocation}
            presencialTimeFrom={day.presencialTimeFrom ?? ''}
            presencialTimeTo={day.presencialTimeTo ?? ''}
            sessionId={day.sessionId ?? ''}
            sessionOptions={sessionOptions}
          />
        </View>
      )}
    </View>
  );
}

export function StampPlanModal({ visible, onClose, groupId, ownerId }) {
  const colors = useThemeColors();
  const { plans } = useTrainingPlans(ownerId);
  const { sessions } = useSessions(ownerId);
  const { upsertDay, stampPlan, isStamping } = useGroupCalendarMutations(groupId);

  const [step, setStep] = useState('select');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [draftDays, setDraftDays] = useState([]);
  const [expandedSeq, setExpandedSeq] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const rangeEnd = plan && startDate ? addDaysISO(startDate, plan.days.length - 1) : null;
  const { days: existingDays } = useGroupCalendar(groupId, startDate || null, rangeEnd);
  const existingByDate = useMemo(() => Object.fromEntries(existingDays.map((d) => [d.date, d])), [existingDays]);

  const isDirty = useFormDirty({ planId, startDate, draftDays }, visible);
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const resetKey = visible;
  const prevResetKeyRef = useRef(resetKey);
  if (resetKey !== prevResetKeyRef.current) {
    prevResetKeyRef.current = resetKey;
    setStep('select');
    setPlanId('');
    setStartDate('');
    setDraftDays([]);
    setExpandedSeq(null);
    setError(null);
  }

  const sessionOptions = sessions.map((s) => ({ id: s.id, name: s.name }));

  const handleClose = () => guardedClose(onClose);

  const handleContinue = () => {
    if (!plan || !startDate) {
      setError('Elegí un plan y una fecha de inicio.');
      return;
    }
    const draft = buildStampDraft(plan, startDate);
    const closedDates = findClosedDraftDates(draft);
    if (closedDates.length > 0) {
      setError(`El plan cubre ${closedDates.length} día(s) ya cerrado(s) (empezando ${closedDates[0]}). Elegí otra fecha de inicio.`);
      return;
    }
    setError(null);
    setDraftDays(draft);
    setStep('preview');
  };

  const handleChangeDraftDay = (sequenceNo, updates) => {
    setDraftDays((prev) => prev.map((d) => (d.sequenceNo === sequenceNo ? { ...d, ...updates } : d)));
  };

  const handleSave = async () => {
    setSaving(true);
    const hasConflicts = draftDays.some((d) => Boolean(existingByDate[d.date]));
    const stampResult = await stampPlan({ planId, startDate, force: hasConflicts });
    if (!stampResult.success) {
      setSaving(false);
      notifyError();
      if (stampResult.conflict) {
        Toast.show({ type: 'error', text1: 'El calendario cambió', text2: 'Volvé a revisar el preview antes de guardar.' });
      } else {
        Toast.show({ type: 'error', text1: 'No pudimos estampar el plan', text2: stampResult.error });
      }
      return;
    }

    const touchedDays = draftDays.filter((d) => d.touched);
    for (const day of touchedDays) {
      const result = await upsertDay({ date: day.date, day });
      if (!result.success) {
        notifyError();
        Toast.show({ type: 'error', text1: `No pudimos ajustar el día ${day.date}`, text2: result.error });
      }
    }

    setSaving(false);
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Plan estampado' });
    bypassGuard(onClose);
  };

  return (
    <>
      <Modal animationType="fade" nativeID="stamp-plan-modal" onRequestClose={handleClose} testID="stamp-plan-modal" transparent visible={visible}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="stamp-plan-modal-backdrop" onPress={handleClose} testID="stamp-plan-modal-backdrop">
          <Pressable
            className="max-h-[85%] w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="stamp-plan-modal-card"
            onPress={() => {}}
            testID="stamp-plan-modal-card"
          >
            <Text className="mb-2 text-lg font-bold text-slate-900 dark:text-white" nativeID="stamp-plan-modal-title" testID="stamp-plan-modal-title">
              Estampar plan
            </Text>

            {error && (
              <Text className="mb-2 text-xs text-red-500 dark:text-red-400" nativeID="stamp-plan-modal-error" testID="stamp-plan-modal-error">{error}</Text>
            )}

            {step === 'select' && (
              <>
                <ResponsiveSelectField
                  dense
                  label="Plan"
                  onChange={setPlanId}
                  options={plans.map((p) => ({ id: p.id, name: p.name }))}
                  placeholder="Elegí un plan"
                  value={planId}
                />
                <DateField
                  disableFutureLimit
                  label="Fecha de inicio"
                  minimumDate={new Date()}
                  onChange={(v) => setStartDate(toISODate(v))}
                  value={startDate}
                />
                <Pressable
                  className="mt-2 h-11 flex-row items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
                  nativeID="stamp-plan-modal-continue-button"
                  onPress={handleContinue}
                  testID="stamp-plan-modal-continue-button"
                >
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="stamp-plan-modal-continue-button-label" testID="stamp-plan-modal-continue-button-label">
                    Continuar
                  </Text>
                </Pressable>
              </>
            )}

            {step === 'preview' && (
              <>
                <ScrollView className="max-h-96" nativeID="stamp-plan-modal-preview-scroll" testID="stamp-plan-modal-preview-scroll">
                  <View className="gap-2" nativeID="stamp-plan-modal-preview-list" testID="stamp-plan-modal-preview-list">
                    {draftDays.map((day) => (
                      <StampPreviewRow
                        day={day}
                        existingDay={existingByDate[day.date] ?? null}
                        expanded={expandedSeq === day.sequenceNo}
                        key={day.sequenceNo}
                        onChangeDay={(updates) => handleChangeDraftDay(day.sequenceNo, updates)}
                        onToggleExpand={() => setExpandedSeq((prev) => (prev === day.sequenceNo ? null : day.sequenceNo))}
                        sessionOptions={sessionOptions}
                      />
                    ))}
                  </View>
                </ScrollView>
                <View className="mt-4 flex-row gap-3" nativeID="stamp-plan-modal-preview-actions" testID="stamp-plan-modal-preview-actions">
                  <Pressable
                    className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                    nativeID="stamp-plan-modal-back-button"
                    onPress={() => setStep('select')}
                    testID="stamp-plan-modal-back-button"
                  >
                    <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="stamp-plan-modal-back-button-label" testID="stamp-plan-modal-back-button-label">
                      Atrás
                    </Text>
                  </Pressable>
                  <Pressable
                    className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${saving || isStamping ? 'opacity-60' : ''}`}
                    disabled={saving || isStamping}
                    nativeID="stamp-plan-modal-save-button"
                    onPress={handleSave}
                    testID="stamp-plan-modal-save-button"
                  >
                    {saving || isStamping ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="stamp-plan-modal-save-button-label" testID="stamp-plan-modal-save-button-label">
                        Guardar
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
