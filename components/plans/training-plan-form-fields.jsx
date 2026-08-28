import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { dayLabel } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { CreateSessionModal } from './create-session-modal.jsx';
import { EXERCISE_KIND_META } from './exercise-kind-meta.js';

const DAY_KIND_OPTIONS = [
  { id: 'rest', name: 'Descanso' },
  { id: 'marathon', name: 'Maratón' },
  { id: 'other', name: 'Otra actividad' },
  { id: 'training', name: 'Entrenamiento' },
];

// Mini-preview de lo que trae una sesión elegida (warmup/main/cooldown,
// con sus íconos por tipo) — para no tener que abrir el detalle del plan
// recién guardado solo para confirmar qué se está por asignar a ese día.
function SessionPreview({ session }) {
  const exercises = useExerciseStore((s) => s.exercises);
  if (!session) return null;

  const warmup = exercises.find((e) => e.id === session.warmupExerciseId);
  const main = exercises.find((e) => e.id === session.mainExerciseId);
  const cooldown = exercises.find((e) => e.id === session.cooldownExerciseId);
  const idPrefix = `session-preview-${session.id}`;

  return (
    <View className="mt-2 flex-row flex-wrap gap-1.5" nativeID={idPrefix} testID={idPrefix}>
      {[warmup, main, cooldown].filter(Boolean).map((exercise, i) => {
        const meta = EXERCISE_KIND_META[exercise.kind];
        const label = exercise === main && session.mainRepeatCount > 1 ? `${session.mainRepeatCount}× ${exercise.name}` : exercise.name;
        return (
          <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${meta.bg}`} key={`${idPrefix}-${i}`} nativeID={`${idPrefix}-${i}`} testID={`${idPrefix}-${i}`}>
            <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={12} />
            <Text className={`text-xs font-medium ${meta.text}`} nativeID={`${idPrefix}-${i}-label`} testID={`${idPrefix}-${i}-label`}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function DayCard({ day, sessions, onChangeDay, onRequestCreateSession }) {
  const idPrefix = `plan-day-${day.sequenceNo}`;
  const selectedSession = sessions.find((s) => s.id === day.sessionId);

  const handleKindChange = (kind) => {
    if (kind === 'training') {
      onChangeDay({ kind, otherName: null, sessionId: day.sessionId });
    } else if (kind === 'other') {
      onChangeDay({ kind, otherName: day.otherName ?? '', sessionId: null });
    } else {
      onChangeDay({ kind, otherName: null, sessionId: null });
    }
  };

  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <Row narrowClassName="gap-3">
        <Col flex={0.6}>
          <View className="mb-3 h-12 justify-center" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
            <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label-text`} testID={`${idPrefix}-label-text`}>
              {dayLabel(day.dayOfWeek)}
            </Text>
          </View>
        </Col>
        <Col>
          <PickerField dense hideErrorRow className="mb-0" label="Tipo de día" onChange={handleKindChange} options={DAY_KIND_OPTIONS} value={day.kind} />
        </Col>
      </Row>

      {day.kind === 'other' && (
        <InputField
          dense
          label="Nombre de la actividad"
          onChange={(text) => onChangeDay({ otherName: text })}
          placeholder="Ej. Natación, bicicleta"
          value={day.otherName ?? ''}
        />
      )}

      {day.kind === 'training' && (
        <View className="mt-2" nativeID={`${idPrefix}-session-picker`} testID={`${idPrefix}-session-picker`}>
          <Row narrowClassName="gap-3">
            <Col flex={2}>
              <ResponsiveSelectField
                dense
                label="Sesión"
                onChange={(sessionId) => onChangeDay({ sessionId })}
                options={sessions.map((s) => ({ id: s.id, name: s.name }))}
                placeholder={sessions.length ? 'Elegí una sesión' : 'Todavía no creaste ninguna sesión'}
                value={day.sessionId ?? ''}
              />
            </Col>
            <Col flex={1}>
              <Pressable
                className="mb-3 h-12 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary px-3 hover:bg-primary-tint-subtle active:opacity-70 dark:hover:bg-primary/10"
                nativeID={`${idPrefix}-create-session-button`}
                onPress={onRequestCreateSession}
                testID={`${idPrefix}-create-session-button`}
              >
                <MaterialCommunityIcons color="#8cc63e" name="plus" size={16} />
                <Text className="text-xs font-semibold text-primary" nativeID={`${idPrefix}-create-session-button-label`} testID={`${idPrefix}-create-session-button-label`}>Crear sesión</Text>
              </Pressable>
            </Col>
          </Row>
          <SessionPreview session={selectedSession} />
        </View>
      )}
    </View>
  );
}

// Constructor de los 7 días fijos del plan. Un día de tipo "Entrenamiento"
// ELIGE una sesión ya creada (catálogo del entrenador) en vez de armar
// warmup/main/cooldown de cero cada vez — ver enmienda 2026-08-26 de
// docs/superpowers/specs/2026-08-26-training-plans-design.md. El botón
// "Crear sesión" abre un modal (CreateSessionModal) para no perder el
// plan a medio armar navegando a otra pantalla.
export function TrainingPlanFormFields({ form, durationOptions }) {
  const user = useAuthStore((s) => s.user);
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const [createSessionTargetDay, setCreateSessionTargetDay] = useState(null);

  useEffect(() => {
    if (!user?.userId) return;
    fetchSessions(user.userId);
    fetchExercises(user.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const handleSessionCreated = (session) => {
    if (createSessionTargetDay != null) form.updateDay(createSessionTargetDay, { sessionId: session.id });
    setCreateSessionTargetDay(null);
  };

  return (
    <>
      <SectionCard icon="clipboard-text-outline" title="Datos del plan">
        <InputField dense error={form.errors.name} label="Nombre del plan" onChange={form.setName} placeholder="Ej. Base 5K — nivel inicial" value={form.name} />
        <InputField dense label="Descripción" multiline numberOfLines={3} onChange={form.setDescription} placeholder="Para quién es, qué objetivo tiene." value={form.description} />
        <ResponsiveSelectField
          dense
          label="Caducidad"
          onChange={(value) => form.setDurationDays(Number(value))}
          options={durationOptions.map((d) => ({ id: String(d), name: `${d} días` }))}
          value={String(form.durationDays)}
        />
      </SectionCard>

      <SectionCard icon="calendar-week" title="Los 7 días de la semana">
        {form.errors.days && (
          <View className="mb-4 rounded-xl bg-red-50 px-4 py-3 dark:bg-red-900/20" nativeID="plan-days-error" testID="plan-days-error">
            <Text className="text-xs text-red-600 dark:text-red-400" nativeID="plan-days-error-text" testID="plan-days-error-text">{form.errors.days}</Text>
          </View>
        )}
        {form.days.map((day) => (
          <DayCard
            day={day}
            key={day.sequenceNo}
            onChangeDay={(updates) => form.updateDay(day.sequenceNo, updates)}
            onRequestCreateSession={() => setCreateSessionTargetDay(day.sequenceNo)}
            sessions={sessions}
          />
        ))}
      </SectionCard>

      <CreateSessionModal
        onClose={() => setCreateSessionTargetDay(null)}
        onCreated={handleSessionCreated}
        visible={createSessionTargetDay != null}
      />
    </>
  );
}
