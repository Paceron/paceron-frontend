import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useGroups } from '../../hooks/use-groups.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useGroupCalendar, useGroupCalendarMutations } from '../../hooks/use-group-calendar.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField } from '../forms/fields.jsx';
import { CalendarDayFields } from './calendar-day-fields.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/haptics.js';
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { StartSessionButton } from '../calendar/start-session-button.jsx';
import { KEEP_CURRENT_SESSION } from '../../services/normalizers.js';

function GroupCalendarDayScreenContent({ teamId, groupId, date, action }) {
  const router = useRouter();
  const colors = useThemeColors();
  // userId sale directo del auth store (sincrónico), sin esperar
  // useUser(userId) — evita una vuelta de red extra antes de poder
  // arrancar el fetch de grupos/sesiones, mismo valor.
  const userId = useAuthStore((s) => s.userId);
  const { groups, loading: loadingGroups } = useGroups(teamId, userId);
  const group = groups.find((g) => g.id === groupId);
  const { sessions } = useSessions(userId);
  const { days, loading: loadingDay } = useGroupCalendar(groupId, date, date);
  const { upsertDay, isUpserting, deleteDay, isDeleting } = useGroupCalendarMutations(groupId);
  const existingDay = days[0] ?? null;

  const [kind, setKind] = useState('rest');
  const [otherName, setOtherName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isPresencial, setIsPresencial] = useState(false);
  const [presencialTimeFrom, setPresencialTimeFrom] = useState('');
  const [presencialTimeTo, setPresencialTimeTo] = useState('');
  const [presencialLocation, setPresencialLocation] = useState(null);
  const [error, setError] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelPromptVisible, setCancelPromptVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Solo semilla una vez, cuando el rango [date, date] terminó de cargar
  // — no un useEffect que resincroniza en cada render del objeto fuente
  // (ver CLAUDE.md, bug real ya documentado en edit-group-screen.jsx). Si
  // el día ya tiene una instancia, arranca en KEEP_CURRENT_SESSION (Gap 7
  // resuelto — "no reasignar", el backend la conserva sin reinstanciar) en
  // vez de intentar adivinar cuál sesión de catálogo la originó.
  const seededRef = useRef(false);
  useEffect(() => {
    if (loadingDay || seededRef.current) return;
    seededRef.current = true;
    if (existingDay) {
      setKind(existingDay.kind === 'cancelled' ? 'training' : existingDay.kind);
      setOtherName(existingDay.otherName ?? '');
      setSessionId(existingDay.sessionInstance ? KEEP_CURRENT_SESSION : '');
      setIsPresencial(existingDay.isPresencial);
      setPresencialTimeFrom(existingDay.presencialTimeFrom ?? '');
      setPresencialTimeTo(existingDay.presencialTimeTo ?? '');
      setPresencialLocation(existingDay.presencialLocation ?? null);
      if (action === 'cancel' && existingDay.kind === 'training') {
        setCancelPromptVisible(true);
      }
    }
  }, [loadingDay, existingDay, action]);

  const isDirty = useFormDirty({ kind, otherName, sessionId, isPresencial, presencialTimeFrom, presencialTimeTo, presencialLocation });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const clearError = () => { if (error) setError(null); };

  const handleSubmit = async () => {
    if (isUpserting) return;
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
    const result = await upsertDay({ date, day });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos guardar el día', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Día guardado' });
    if (result.sameTeamWarnings?.length > 0) {
      Toast.show({ type: 'info', text1: 'Superposición con otro grupo', text2: 'Mismo equipo — se guardó igual.' });
    }
    bypassGuard(() => router.back());
  };

  const handleClear = async () => {
    const result = await deleteDay({ date });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos vaciar el día', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Día vaciado' });
    bypassGuard(() => router.back());
  };

  const handleOpenCancelPrompt = () => {
    notifyWarning();
    setCancelPromptVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    const result = await upsertDay({ date, day: { kind: 'cancelled', cancelledReason: cancelReason.trim() } });
    setCancelling(false);
    setCancelPromptVisible(false);
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos cancelar la sesión', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Sesión cancelada' });
    bypassGuard(() => router.back());
  };

  const sessionOptions = existingDay?.sessionInstance
    ? [{ id: KEEP_CURRENT_SESSION, name: 'Mantener sesión actual (sin cambios)' }, ...sessions.map((s) => ({ id: s.id, name: s.name }))]
    : sessions.map((s) => ({ id: s.id, name: s.name }));
  const canCancelSession = existingDay?.kind === 'training';
  // Mismo criterio que el backend (calendar_service.go#isCalendarDayClosed,
  // ver utils/calendar-day-closed.js) — usa el estado ACTUAL del form, no
  // el existingDay guardado: hoy con presencial activado y horario futuro
  // puede seguir abierto aunque el día ya tenga contenido guardado antes.
  // Solo advisory (el backend sigue siendo la fuente real, esto evita
  // mostrar una acción que va a terminar en 422).
  const closed = kind === 'training' && isPresencial
    ? isCalendarDayClosed(date, { isPresencial: true, presencialTimeFrom })
    : isCalendarDayClosed(date, { isPresencial: false });

  if (loadingGroups || loadingDay) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="group-calendar-day-loading" testID="group-calendar-day-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="group-calendar-day-not-found" testID="group-calendar-day-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="group-calendar-day-not-found-label" testID="group-calendar-day-not-found-label">
          No encontramos este grupo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="group-calendar-day-not-found-back-button"
          onPress={() => router.back()}
          testID="group-calendar-day-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-day-not-found-back-button-label" testID="group-calendar-day-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-paper dark:bg-ink"
        contentContainerClassName="px-4 py-8"
        nativeID="group-calendar-day-screen-scroll"
        showsVerticalScrollIndicator={false}
        testID="group-calendar-day-screen-scroll"
      >
        <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="group-calendar-day-screen-container" testID="group-calendar-day-screen-container">
          <View className="mb-8 flex-row items-center gap-2" nativeID="group-calendar-day-screen-header" testID="group-calendar-day-screen-header">
            <Pressable
              className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
              nativeID="group-calendar-day-screen-back-button"
              onPress={() => guardedClose(() => router.back())}
              testID="group-calendar-day-screen-back-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            </Pressable>
            <Text className="text-xl text-slate-900 dark:text-white" nativeID="group-calendar-day-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="group-calendar-day-screen-title">
              {formatWeekdayLabel(date)}, {formatDisplayDate(date)}
            </Text>
          </View>

          {existingDay && <StartSessionButton assignment={existingDay} role="trainer" teamId={teamId} />}

          <SectionCard icon="calendar-blank-outline" title={`Día de ${group.name}`}>
            {closed && (
              <View
                className="mb-4 flex-row items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
                nativeID="group-calendar-day-closed-banner"
                testID="group-calendar-day-closed-banner"
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="lock-outline" size={16} />
                <Text
                  className="flex-1 text-xs text-slate-500 dark:text-slate-400"
                  nativeID="group-calendar-day-closed-banner-label"
                  testID="group-calendar-day-closed-banner-label"
                >
                  Este día ya pasó (o ya arrancó) — queda como historial, no se puede editar ni vaciar.
                  {canCancelSession ? ' Podés cancelar la sesión asignada si hace falta.' : ''}
                </Text>
              </View>
            )}

            {error && (
              <Text className="mb-4 text-xs text-red-500 dark:text-red-400" nativeID="group-calendar-day-error" testID="group-calendar-day-error">{error}</Text>
            )}

            <CalendarDayFields
              currentSessionInstance={existingDay?.sessionInstance ?? null}
              disabled={isUpserting}
              idPrefix="group-calendar-day"
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
              className={`h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${isUpserting || closed ? 'opacity-60' : ''}`}
              disabled={isUpserting || closed}
              nativeID="group-calendar-day-save-button"
              onPress={handleSubmit}
              testID="group-calendar-day-save-button"
            >
              {isUpserting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="group-calendar-day-save-button-label" testID="group-calendar-day-save-button-label">
                    Guardar
                  </Text>
                </>
              )}
            </Pressable>

            {canCancelSession && (
              <Pressable
                className="mt-3 h-12 flex-row items-center justify-center gap-2 rounded-full border border-amber-400 hover:bg-amber-50 active:opacity-80 dark:border-amber-700 dark:hover:bg-amber-900/20"
                nativeID="group-calendar-day-cancel-session-button"
                onPress={handleOpenCancelPrompt}
                testID="group-calendar-day-cancel-session-button"
              >
                <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={18} />
                <Text className="text-sm font-semibold text-amber-700 dark:text-amber-400" nativeID="group-calendar-day-cancel-session-button-label" testID="group-calendar-day-cancel-session-button-label">
                  Cancelar esta sesión
                </Text>
              </Pressable>
            )}

            {existingDay && (
              <Pressable
                className={`mt-3 h-12 flex-row items-center justify-center gap-2 rounded-full border border-red-300 hover:bg-red-50 active:opacity-80 dark:border-red-800 dark:hover:bg-red-900/20 ${isDeleting || closed ? 'opacity-60' : ''}`}
                disabled={isDeleting || closed}
                nativeID="group-calendar-day-clear-button"
                onPress={handleClear}
                testID="group-calendar-day-clear-button"
              >
                {isDeleting ? (
                  <ActivityIndicator color="#ef4444" />
                ) : (
                  <>
                    <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
                    <Text className="text-sm font-semibold text-red-600 dark:text-red-400" nativeID="group-calendar-day-clear-button-label" testID="group-calendar-day-clear-button-label">
                      Vaciar día
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </SectionCard>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        nativeID="group-calendar-day-cancel-prompt-modal"
        onRequestClose={() => setCancelPromptVisible(false)}
        testID="group-calendar-day-cancel-prompt-modal"
        transparent
        visible={cancelPromptVisible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          nativeID="group-calendar-day-cancel-prompt-backdrop"
          onPress={() => setCancelPromptVisible(false)}
          testID="group-calendar-day-cancel-prompt-backdrop"
        >
          <Pressable
            className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl dark:border-amber-900/50 dark:bg-surface"
            nativeID="group-calendar-day-cancel-prompt-card"
            onPress={() => {}}
            testID="group-calendar-day-cancel-prompt-card"
          >
            <Text className="mb-3 text-lg font-bold text-amber-700 dark:text-amber-400" nativeID="group-calendar-day-cancel-prompt-title" testID="group-calendar-day-cancel-prompt-title">
              Cancelar sesión
            </Text>
            <InputField dense label="Motivo" multiline numberOfLines={2} onChange={setCancelReason} placeholder="Ej. Lluvia" value={cancelReason} />
            <View className="flex-row gap-3" nativeID="group-calendar-day-cancel-prompt-actions" testID="group-calendar-day-cancel-prompt-actions">
              <Pressable
                className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
                nativeID="group-calendar-day-cancel-prompt-cancel-button"
                onPress={() => setCancelPromptVisible(false)}
                testID="group-calendar-day-cancel-prompt-cancel-button"
              >
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="group-calendar-day-cancel-prompt-cancel-label" testID="group-calendar-day-cancel-prompt-cancel-label">
                  Volver
                </Text>
              </Pressable>
              <Pressable
                className={`h-11 flex-1 items-center justify-center rounded-full bg-amber-600 hover:opacity-90 active:opacity-80 ${cancelling || !cancelReason.trim() ? 'opacity-60' : ''}`}
                disabled={cancelling || !cancelReason.trim()}
                nativeID="group-calendar-day-cancel-prompt-confirm-button"
                onPress={handleConfirmCancel}
                testID="group-calendar-day-cancel-prompt-confirm-button"
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="group-calendar-day-cancel-prompt-confirm-label" testID="group-calendar-day-cancel-prompt-confirm-label">
                    Confirmar
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

export function GroupCalendarDayScreen({ teamId, groupId, date, action }) {
  return (
    <RequireAuth>
      <GroupCalendarDayScreenContent action={action} date={date} groupId={groupId} teamId={teamId} />
    </RequireAuth>
  );
}
