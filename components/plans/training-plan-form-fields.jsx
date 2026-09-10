import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { dayLabel } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DAY_KIND_META } from './exercise-kind-meta.js';
import { SessionExercisesPreview } from './session-exercises-preview.jsx';

const DAY_KIND_ORDER = ['rest', 'other', 'training'];

// Segmented pill de 3 opciones para "Tipo de día" — usado en la variante
// colapsable de mobile/web angosto (ver DayRow). El header de web ancho
// arma su propio layout full-width con expansión (DayHeaderRowWide más
// abajo): comparten meta/orden pero no componente, porque ahí el
// segmento activo (si necesita un dato más) crece para embeber su
// control adentro del pill, algo que no tiene sentido en el espacio
// angosto de mobile.
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
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-full px-1.5 py-2 ${active ? meta.bg : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
            key={kind}
            nativeID={segId}
            onPress={() => onChange(kind)}
            testID={segId}
          >
            <MaterialCommunityIcons color={active ? meta.iconColor : '#94a3b8'} name={meta.icon} size={16} />
            <Text className={`shrink text-sm font-semibold ${active ? meta.text : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${segId}-label`} numberOfLines={1} testID={`${segId}-label`}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Header de día en web ancho — los 3 segmentos ocupan todo el ancho de
// la fila (a diferencia del pill de ancho orgánico de DaySegmentedPicker
// arriba). "Otra actividad" y "Entrenamiento" necesitan un dato más: en
// vez de mostrarlo en una fila aparte debajo (como antes), el segmento
// activo crece y lo embebe directo adentro del pill, compactando los
// otros dos a solo ícono. Con "Descanso" no hay nada que embeber, así
// que los 3 quedan iguales. Sin botón de "crear sesión" acá — crear
// sesiones nuevas se hace desde la pestaña de catálogo, no desde este
// formulario (antes tenía uno embebido para no cortar el flujo, pero
// duplicaba una acción que ya vive en un solo lugar).
function DayHeaderRowWide({ day, sessions, onChangeDay, onKindChange, idPrefix }) {
  const selectedSession = sessions.find((s) => s.id === day.sessionId);

  return (
    <>
      <View className="flex-row items-center gap-3" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Text className="w-24 shrink-0 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          {dayLabel(day.dayOfWeek)}
        </Text>
        <View className="flex-1 flex-row items-center gap-2" nativeID={`${idPrefix}-kind-pill`} testID={`${idPrefix}-kind-pill`}>
          {DAY_KIND_ORDER.map((kind) => {
            const meta = DAY_KIND_META[kind];
            const active = day.kind === kind;
            const expanded = active && kind !== 'rest';
            const segId = `${idPrefix}-kind-${kind}`;

            if (expanded) {
              return (
                <View className={`h-14 flex-1 flex-row items-center gap-2 rounded-full px-3.5 ${meta.bg}`} key={kind} nativeID={segId} testID={segId}>
                  <MaterialCommunityIcons color={meta.iconColor} name={meta.icon} size={18} />
                  {kind === 'other' && (
                    <InputField
                      className="mb-0 flex-1"
                      dense
                      hideErrorRow
                      hideLabel
                      onChange={(text) => onChangeDay({ otherName: text })}
                      placeholder="Ej. Natación, bicicleta"
                      value={day.otherName ?? ''}
                    />
                  )}
                  {kind === 'training' && (
                    <ResponsiveSelectField
                      className="mb-0 flex-1"
                      dense
                      hideErrorRow
                      hideLabel
                      label="Sesión"
                      onChange={(sessionId) => onChangeDay({ sessionId })}
                      options={sessions.map((s) => ({ id: s.id, name: s.name }))}
                      placeholder={sessions.length ? 'Elegí una sesión' : 'Todavía no creaste ninguna sesión'}
                      value={day.sessionId ?? ''}
                    />
                  )}
                </View>
              );
            }

            const compact = day.kind !== 'rest';
            return (
              <Pressable
                accessibilityLabel={meta.label}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className={`h-14 items-center justify-center rounded-full ${compact ? 'w-14' : 'flex-1 flex-row gap-1.5'} ${active ? meta.bg : 'bg-slate-100 hover:bg-slate-200/60 dark:bg-slate-800 dark:hover:bg-slate-700/60'}`}
                key={kind}
                nativeID={segId}
                onPress={() => onKindChange(kind)}
                testID={segId}
              >
                <MaterialCommunityIcons color={active ? meta.iconColor : '#94a3b8'} name={meta.icon} size={18} />
                {!compact && (
                  <Text className={`text-sm font-semibold ${active ? meta.text : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${segId}-label`} testID={`${segId}-label`}>
                    {meta.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
      {day.kind === 'training' && selectedSession && (
        <View className="pl-24 pt-2" nativeID={`${idPrefix}-session-preview`} testID={`${idPrefix}-session-preview`}>
          <SessionExercisesPreview session={selectedSession} />
        </View>
      )}
    </>
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
function DayRow({ day, sessions, onChangeDay }) {
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const [expanded, setExpanded] = useState(false);
  const idPrefix = `plan-day-${day.sequenceNo}`;
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

  // Fila siempre expandida solo cuando hay ancho real de sobra (web
  // ancho) — en mobile nativo Y en web angosto (mismo ancho de ventana
  // que un teléfono) se usa la variante colapsable de más abajo. El
  // contenedor de esta pantalla limita su columna a max-w-3xl, pero
  // useIsNarrowWeb() mide el ancho real de la ventana (useWindowDimensions),
  // no el ancho ya recortado de la columna — por eso sigue siendo la
  // condición correcta y no queda "siempre angosta" por culpa del cap.
  if (isWeb && !isNarrowWeb) {
    return (
      <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
        <DayHeaderRowWide day={day} idPrefix={idPrefix} onChangeDay={onChangeDay} onKindChange={handleKindChange} sessions={sessions} />
      </View>
    );
  }

  const selectedSession = sessions.find((s) => s.id === day.sessionId);
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
          <ResponsiveSelectField
            dense
            hideErrorRow
            hideLabel
            label="Sesión"
            onChange={(sessionId) => onChangeDay({ sessionId })}
            options={sessions.map((s) => ({ id: s.id, name: s.name }))}
            placeholder={sessions.length ? 'Elegí una sesión' : 'Todavía no creaste ninguna sesión'}
            value={day.sessionId ?? ''}
          />
          <SessionExercisesPreview session={selectedSession} />
        </View>
      )}
    </>
  );

  return (
    <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
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
// docs/superpowers/specs/2026-08-26-training-plans-design.md.
export function TrainingPlanFormFields({ form, durationOptions, autoFocusName = false }) {
  const userId = useAuthStore((s) => s.userId);
  const { sessions } = useSessions(userId);
  useExercises(userId); // precarga el cache que usa SessionExercisesPreview del picker de sesión

  return (
    <>
      <SectionCard icon="clipboard-text-outline" title="Datos del plan">
        <InputField autoFocus={autoFocusName} dense error={form.errors.name} label="Nombre del plan" onChange={form.setName} placeholder="Ej. Base 5K — nivel inicial" value={form.name} />
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
              sessions={sessions}
            />
          ))}
        </View>
      </SectionCard>
    </>
  );
}
