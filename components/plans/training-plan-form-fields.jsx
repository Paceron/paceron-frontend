import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { dayLabel } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DAY_KIND_META } from './exercise-kind-meta.js';
import { CreateSessionModal } from './create-session-modal.jsx';
import { SelectWithCreateField } from './select-with-create-field.jsx';
import { SessionExercisesPreview } from './session-exercises-preview.jsx';

const DAY_KIND_ORDER = ['rest', 'other', 'training'];

// Segmented pill de 3 opciones para "Tipo de día" — reemplaza al <select>
// de ancho completo que antes repetía el label "Tipo de día" en las 7
// filas. Un solo call site (DayRow), no se comparte — mismo criterio que
// Segment dentro de RoleSwitchToggle (components/profile/role-switch-toggle.jsx),
// que tampoco se exporta.
function DaySegmentedPicker({ idPrefix, value, onChange }) {
  return (
    <View
      accessibilityLabel="Tipo de día"
      accessibilityRole="radiogroup"
      className="flex-row items-center rounded-full bg-slate-100 p-1 dark:bg-slate-800"
      nativeID={`${idPrefix}-kind-pill`}
      testID={`${idPrefix}-kind-pill`}
    >
      {DAY_KIND_ORDER.map((kind) => {
        const meta = DAY_KIND_META[kind];
        const active = value === kind;
        const segId = `${idPrefix}-kind-${kind}`;
        return (
          <Pressable
            accessibilityLabel={meta.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className={`flex-row items-center gap-1 rounded-full px-2.5 py-1.5 ${active ? meta.bg : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
            key={kind}
            nativeID={segId}
            onPress={() => onChange(kind)}
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

// Fila compacta por día — antes era una card completa por día (mucho
// espacio en blanco en los días de "Descanso", que son la mayoría) con
// el label "Tipo de día" repetido 7 veces. Ahora: en web (más ancho
// disponible) la fila viene siempre expandida; en mobile arranca
// colapsada mostrando solo un chip-resumen, y se expande al tocarla
// (mismo mecanismo — Pressable + estado local, sin animación de layout —
// que ya usan RunnerRow en team-detail-screen.jsx y la DayRow de solo
// lectura en training-plan-detail-screen.jsx, de la que también se toma
// el estilo de contenedor por fila).
function DayRow({ day, sessions, onChangeDay, onRequestCreateSession }) {
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const [expanded, setExpanded] = useState(false);
  const idPrefix = `plan-day-${day.sequenceNo}`;
  const selectedSession = sessions.find((s) => s.id === day.sessionId);
  const kindMeta = DAY_KIND_META[day.kind] ?? DAY_KIND_META.rest;

  const handleKindChange = (kind) => {
    if (kind === 'training') {
      onChangeDay({ kind, otherName: null, sessionId: day.sessionId });
    } else if (kind === 'other') {
      onChangeDay({ kind, otherName: day.otherName ?? '', sessionId: null });
    } else {
      onChangeDay({ kind, otherName: null, sessionId: null });
    }
  };

  const conditionalContent = (
    <>
      {day.kind === 'other' && (
        <InputField
          dense
          hideErrorRow
          label="Nombre de la actividad"
          onChange={(text) => onChangeDay({ otherName: text })}
          placeholder="Ej. Natación, bicicleta"
          value={day.otherName ?? ''}
        />
      )}
      {day.kind === 'training' && (
        <View className="mt-2" nativeID={`${idPrefix}-session-picker`} testID={`${idPrefix}-session-picker`}>
          <SelectWithCreateField
            createAccessibilityLabel="Crear sesión"
            hideLabel
            label="Sesión"
            onChange={(sessionId) => onChangeDay({ sessionId })}
            onRequestCreate={onRequestCreateSession}
            options={sessions.map((s) => ({ id: s.id, name: s.name }))}
            placeholder={sessions.length ? 'Elegí una sesión' : 'Todavía no creaste ninguna sesión'}
            scope={`${idPrefix}-session-field`}
            value={day.sessionId ?? ''}
          />
          <SessionExercisesPreview session={selectedSession} />
        </View>
      )}
    </>
  );

  // Fila siempre expandida solo cuando hay ancho real de sobra (web
  // ancho) — en mobile nativo Y en web angosto (mismo ancho de ventana
  // que un teléfono) se usa la variante colapsable de más abajo. El
  // contenedor de esta pantalla limita su columna a max-w-3xl, pero
  // useIsNarrowWeb() mide el ancho real de la ventana (useWindowDimensions),
  // no el ancho ya recortado de la columna — por eso sigue siendo la
  // condición correcta y no queda "siempre angosta" por culpa del cap.
  if (isWeb && !isNarrowWeb) {
    return (
      <View
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
        nativeID={idPrefix}
        testID={idPrefix}
      >
        <View className="flex-row flex-wrap items-center gap-3" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
          <Text className="w-24 shrink-0 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
            {dayLabel(day.dayOfWeek)}
          </Text>
          <DaySegmentedPicker idPrefix={idPrefix} onChange={handleKindChange} value={day.kind} />
        </View>
        {day.kind !== 'rest' && (
          <View className="w-full pl-24" nativeID={`${idPrefix}-conditional`} testID={`${idPrefix}-conditional`}>
            {conditionalContent}
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900"
      nativeID={idPrefix}
      testID={idPrefix}
    >
      <Pressable
        accessibilityLabel={`${dayLabel(day.dayOfWeek)}, ${kindMeta.label}, ${expanded ? 'ocultar detalle' : 'ver detalle'}`}
        accessibilityRole="button"
        className="flex-row items-center gap-2 active:opacity-80"
        nativeID={`${idPrefix}-toggle`}
        onPress={() => setExpanded((v) => !v)}
        testID={`${idPrefix}-toggle`}
      >
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {dayLabel(day.dayOfWeek)}
        </Text>
        <View className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${kindMeta.bg}`} nativeID={`${idPrefix}-summary-chip`} testID={`${idPrefix}-summary-chip`}>
          <MaterialCommunityIcons color={kindMeta.iconColor} name={kindMeta.icon} size={14} />
          <Text className={`text-xs font-semibold ${kindMeta.text}`} nativeID={`${idPrefix}-summary-chip-label`} testID={`${idPrefix}-summary-chip-label`}>
            {kindMeta.label}
          </Text>
        </View>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>

      {expanded && (
        <View className="gap-2 pt-2" nativeID={`${idPrefix}-expanded`} testID={`${idPrefix}-expanded`}>
          <DaySegmentedPicker idPrefix={idPrefix} onChange={handleKindChange} value={day.kind} />
          {conditionalContent}
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
        <InputField dense hideErrorRow label="Descripción" multiline numberOfLines={3} onChange={form.setDescription} placeholder="Para quién es, qué objetivo tiene." value={form.description} />
        <ResponsiveSelectField
          dense
          hideErrorRow
          label="Caducidad"
          onChange={(value) => form.setDurationDays(Number(value))}
          options={durationOptions.map((d) => ({ id: String(d), name: `${d} días` }))}
          required
          value={String(form.durationDays)}
        />
      </SectionCard>

      <SectionCard icon="calendar-week" title="Los 7 días de la semana">
        {form.errors.days && (
          <View className="mb-4 rounded-xl bg-red-50 px-4 py-3 dark:bg-red-900/20" nativeID="plan-days-error" testID="plan-days-error">
            <Text className="text-xs text-red-600 dark:text-red-400" nativeID="plan-days-error-text" testID="plan-days-error-text">{form.errors.days}</Text>
          </View>
        )}
        <View className="gap-2" nativeID="plan-days-list" testID="plan-days-list">
          {form.days.map((day) => (
            <DayRow
              day={day}
              key={day.sequenceNo}
              onChangeDay={(updates) => form.updateDay(day.sequenceNo, updates)}
              onRequestCreateSession={() => setCreateSessionTargetDay(day.sequenceNo)}
              sessions={sessions}
            />
          ))}
        </View>
      </SectionCard>

      <CreateSessionModal
        onClose={() => setCreateSessionTargetDay(null)}
        onCreated={handleSessionCreated}
        visible={createSessionTargetDay != null}
      />
    </>
  );
}
