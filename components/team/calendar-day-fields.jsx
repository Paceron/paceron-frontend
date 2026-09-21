import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField, TimeField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { LocationPicker } from '../shared/location-picker';

const KIND_OPTIONS = [
  { id: 'rest', label: 'Descanso' },
  { id: 'other', label: 'Otra actividad' },
  { id: 'training', label: 'Entrenamiento' },
];

function KindSelector({ idPrefix, value, onChange, disabled }) {
  return (
    <View className="mb-5 flex-row gap-2" nativeID={`${idPrefix}-kind-selector`} testID={`${idPrefix}-kind-selector`}>
      {KIND_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            className={`flex-1 items-center rounded-xl border px-2 py-2.5 ${selected ? 'border-primary bg-primary-tint dark:bg-primary/15' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
            disabled={disabled}
            key={opt.id}
            nativeID={`${idPrefix}-kind-${opt.id}`}
            onPress={() => onChange(opt.id)}
            testID={`${idPrefix}-kind-${opt.id}`}
          >
            <Text
              className={`text-xs font-semibold ${selected ? 'text-on-primary-tint dark:text-primary' : 'text-slate-600 dark:text-slate-300'}`}
              nativeID={`${idPrefix}-kind-${opt.id}-label`}
              testID={`${idPrefix}-kind-${opt.id}-label`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PresencialToggle({ idPrefix, value, onChange, colors }) {
  return (
    <Pressable
      accessibilityLabel="¿Es presencial?"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      className="mb-4 flex-row items-center gap-3 py-1"
      nativeID={`${idPrefix}-presencial-checkbox`}
      onPress={() => onChange(!value)}
      testID={`${idPrefix}-presencial-checkbox`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded border ${value ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}
        nativeID={`${idPrefix}-presencial-checkbox-box`}
        testID={`${idPrefix}-presencial-checkbox-box`}
      >
        {value && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />}
      </View>
      <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID={`${idPrefix}-presencial-checkbox-label`} testID={`${idPrefix}-presencial-checkbox-label`}>
        ¿Es presencial?
      </Text>
    </Pressable>
  );
}

// Campos de "contenido de un día de calendario" (kind, sesión,
// presencial+horario+ubicación) — extraído de group-calendar-day-screen.jsx
// para reusarlo tal cual en cada fila expandida del preview de
// stamp-plan-modal.jsx. Sin estado propio: el caller controla todo por
// props.
export function CalendarDayFields({
  idPrefix,
  kind, onKindChange,
  otherName, onOtherNameChange,
  sessionId, onSessionIdChange, sessionOptions,
  isPresencial, onIsPresencialChange,
  presencialTimeFrom, onPresencialTimeFromChange,
  presencialTimeTo, onPresencialTimeToChange,
  presencialLocation, onPresencialLocationChange,
  currentSessionInstance,
  disabled,
}) {
  const colors = useThemeColors();

  return (
    <>
      <KindSelector disabled={disabled} idPrefix={idPrefix} onChange={onKindChange} value={kind} />

      {kind === 'other' && (
        <InputField dense label="Nombre de la actividad" onChange={onOtherNameChange} placeholder="Ej. Elongación" value={otherName} />
      )}

      {kind === 'training' && (
        <>
          {currentSessionInstance && (
            <View
              className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
              nativeID={`${idPrefix}-current-session`}
              testID={`${idPrefix}-current-session`}
            >
              <Text
                className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                nativeID={`${idPrefix}-current-session-label`}
                testID={`${idPrefix}-current-session-label`}
              >
                Sesión asignada actualmente
              </Text>
              <Text
                className="mt-1 text-sm font-medium text-slate-900 dark:text-white"
                nativeID={`${idPrefix}-current-session-name`}
                testID={`${idPrefix}-current-session-name`}
              >
                {currentSessionInstance.name}
              </Text>
              {currentSessionInstance.description && (
                <Text
                  className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                  nativeID={`${idPrefix}-current-session-description`}
                  testID={`${idPrefix}-current-session-description`}
                >
                  {currentSessionInstance.description}
                </Text>
              )}
            </View>
          )}
          {currentSessionInstance ? (
            <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-session-hint`} testID={`${idPrefix}-session-hint`}>
              &ldquo;Mantener sesión actual&rdquo; no toca el contenido guardado. Elegir cualquier otra sesión reemplaza la actual por una copia congelada nueva.
            </Text>
          ) : (
            <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-session-hint`} testID={`${idPrefix}-session-hint`}>
              Guardar instancia una copia congelada de la sesión elegida — editarla después en el catálogo no la va a afectar.
            </Text>
          )}
          <ResponsiveSelectField dense label="Sesión del catálogo" onChange={onSessionIdChange} options={sessionOptions} placeholder="Elegí una sesión" value={sessionId} />
          <PresencialToggle colors={colors} idPrefix={idPrefix} onChange={onIsPresencialChange} value={isPresencial} />
          {isPresencial && (
            <>
              <View className="flex-row gap-3" nativeID={`${idPrefix}-time-row`} testID={`${idPrefix}-time-row`}>
                <View className="flex-1" nativeID={`${idPrefix}-time-from-wrapper`} testID={`${idPrefix}-time-from-wrapper`}>
                  <TimeField label="Hora desde" onChange={onPresencialTimeFromChange} value={presencialTimeFrom} />
                </View>
                <View className="flex-1" nativeID={`${idPrefix}-time-to-wrapper`} testID={`${idPrefix}-time-to-wrapper`}>
                  <TimeField label="Hora hasta" onChange={onPresencialTimeToChange} value={presencialTimeTo} />
                </View>
              </View>
              <View className="mb-5" nativeID={`${idPrefix}-location-wrapper`} testID={`${idPrefix}-location-wrapper`}>
                <LocationPicker onChange={onPresencialLocationChange} value={presencialLocation} />
              </View>
            </>
          )}
        </>
      )}
    </>
  );
}
