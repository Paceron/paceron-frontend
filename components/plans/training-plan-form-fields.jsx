import { Text, View } from 'react-native';
import { dayLabel } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField, Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

const DAY_KIND_OPTIONS = [
  { id: 'rest', name: 'Descanso' },
  { id: 'marathon', name: 'Maratón' },
  { id: 'other', name: 'Otra actividad' },
  { id: 'training', name: 'Entrenamiento' },
];

const WARMCOOL_KIND_OPTIONS = [
  { id: 'walking', name: 'Caminata' },
  { id: 'jogging', name: 'Trote suave' },
  { id: 'elongation', name: 'Elongación' },
];

const MAIN_KIND_OPTIONS = [
  { id: 'cruising', name: 'Ritmo continuo' },
  { id: 'walking', name: 'Caminata' },
  { id: 'jogging', name: 'Trote suave' },
  { id: 'set', name: 'Serie (repeticiones)' },
];

const SET_KIND_OPTIONS = [
  { id: 'walking', name: 'Caminata' },
  { id: 'jogging', name: 'Trote suave' },
  { id: 'running', name: 'Corrida' },
];

const DEFAULT_SESSION = {
  warmup: { kind: 'walking', minutes: 5 },
  main: { kind: 'jogging', minutes: 20 },
  cooldown: { kind: 'elongation' },
};

function WarmcoolBlockEditor({ idPrefix, label, block, onChange }) {
  const kind = block?.kind ?? 'walking';
  const showMinutes = kind === 'walking' || kind === 'jogging';

  return (
    <SectionCard icon="timer-sand" title={label}>
      <Row narrowClassName="gap-3">
        <Col>
          <PickerField
            dense
            hideErrorRow
            className="mb-0"
            label="Tipo"
            onChange={(value) => onChange({ kind: value, minutes: value === 'elongation' ? undefined : (block?.minutes ?? 5) })}
            options={WARMCOOL_KIND_OPTIONS}
            value={kind}
          />
        </Col>
        {showMinutes && (
          <Col>
            <InputField
              dense
              hideErrorRow
              className="mb-0"
              keyboardType="number-pad"
              label="Minutos"
              onChange={(text) => onChange({ ...block, minutes: text === '' ? null : Number(text) })}
              value={block?.minutes != null ? String(block.minutes) : ''}
            />
          </Col>
        )}
      </Row>
    </SectionCard>
  );
}

function SetBlockEditor({ set, onChange }) {
  const kind = set?.kind ?? 'running';
  const showMinutes = kind === 'walking' || kind === 'jogging';
  const showRunningFields = kind === 'running';

  return (
    <View className="mt-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900" nativeID="plan-set-block" testID="plan-set-block">
      <Row narrowClassName="gap-3">
        <Col>
          <InputField
            dense
            hideErrorRow
            className="mb-0"
            keyboardType="number-pad"
            label="Repeticiones"
            onChange={(text) => onChange({ ...set, repeatCount: text === '' ? null : Number(text) })}
            value={set?.repeatCount != null ? String(set.repeatCount) : ''}
          />
        </Col>
        <Col>
          <InputField
            dense
            hideErrorRow
            className="mb-0"
            keyboardType="number-pad"
            label="Descanso entre series (min)"
            onChange={(text) => onChange({ ...set, restMinutes: text === '' ? null : Number(text) })}
            value={set?.restMinutes != null ? String(set.restMinutes) : ''}
          />
        </Col>
      </Row>

      <PickerField
        dense
        hideErrorRow
        className="mb-0"
        label="Tipo de serie"
        onChange={(value) => onChange({ ...set, kind: value })}
        options={SET_KIND_OPTIONS}
        value={kind}
      />

      {showMinutes && (
        <InputField
          dense
          hideErrorRow
          className="mb-0"
          keyboardType="number-pad"
          label="Minutos"
          onChange={(text) => onChange({ ...set, minutes: text === '' ? null : Number(text) })}
          value={set?.minutes != null ? String(set.minutes) : ''}
        />
      )}

      {showRunningFields && (
        <Row narrowClassName="gap-3">
          <Col>
            <InputField
              dense
              hideErrorRow
              className="mb-0"
              keyboardType="number-pad"
              label="Distancia (m)"
              onChange={(text) => onChange({ ...set, distanceM: text === '' ? null : Number(text) })}
              value={set?.distanceM != null ? String(set.distanceM) : ''}
            />
          </Col>
          <Col>
            <InputField
              dense
              hideErrorRow
              className="mb-0"
              keyboardType="number-pad"
              label="Velocidad (km/h)"
              onChange={(text) => onChange({ ...set, speedKph: text === '' ? null : Number(text) })}
              value={set?.speedKph != null ? String(set.speedKph) : ''}
            />
          </Col>
        </Row>
      )}
    </View>
  );
}

function MainBlockEditor({ block, onChange }) {
  const kind = block?.kind ?? 'cruising';
  const showDistance = kind === 'cruising';
  const showMinutes = kind === 'walking' || kind === 'jogging';
  const showSet = kind === 'set';

  return (
    <SectionCard icon="run-fast" title="Bloque principal">
      <PickerField
        dense
        hideErrorRow
        className="mb-0"
        label="Tipo"
        onChange={(value) => onChange({
          kind: value,
          distanceM: value === 'cruising' ? (block?.distanceM ?? 3000) : undefined,
          minutes: value === 'walking' || value === 'jogging' ? (block?.minutes ?? 20) : undefined,
          set: value === 'set' ? (block?.set ?? { repeatCount: 4, restMinutes: 2, kind: 'running', distanceM: 400, speedKph: 10 }) : undefined,
        })}
        options={MAIN_KIND_OPTIONS}
        value={kind}
      />

      {showDistance && (
        <View className="mt-3" nativeID="plan-main-distance-wrapper" testID="plan-main-distance-wrapper">
          <InputField
            dense
            hideErrorRow
            className="mb-0"
            keyboardType="number-pad"
            label="Distancia (m)"
            onChange={(text) => onChange({ ...block, distanceM: text === '' ? null : Number(text) })}
            value={block?.distanceM != null ? String(block.distanceM) : ''}
          />
        </View>
      )}

      {showMinutes && (
        <View className="mt-3" nativeID="plan-main-minutes-wrapper" testID="plan-main-minutes-wrapper">
          <InputField
            dense
            hideErrorRow
            className="mb-0"
            keyboardType="number-pad"
            label="Minutos"
            onChange={(text) => onChange({ ...block, minutes: text === '' ? null : Number(text) })}
            value={block?.minutes != null ? String(block.minutes) : ''}
          />
        </View>
      )}

      {showSet && <SetBlockEditor onChange={(set) => onChange({ ...block, set })} set={block?.set} />}
    </SectionCard>
  );
}

function DayCard({ day, onChangeDay }) {
  const idPrefix = `plan-day-${day.sequenceNo}`;

  const handleKindChange = (kind) => {
    if (kind === 'training') {
      onChangeDay({ kind, otherName: null, session: day.session ?? DEFAULT_SESSION });
    } else if (kind === 'other') {
      onChangeDay({ kind, otherName: day.otherName ?? '', session: null });
    } else {
      onChangeDay({ kind, otherName: null, session: null });
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
        <View className="mt-2 gap-3" nativeID={`${idPrefix}-session`} testID={`${idPrefix}-session`}>
          <WarmcoolBlockEditor
            block={day.session?.warmup}
            idPrefix={`${idPrefix}-warmup`}
            label="Entrada en calor"
            onChange={(warmup) => onChangeDay({ session: { ...day.session, warmup } })}
          />
          <MainBlockEditor block={day.session?.main} onChange={(main) => onChangeDay({ session: { ...day.session, main } })} />
          <WarmcoolBlockEditor
            block={day.session?.cooldown}
            idPrefix={`${idPrefix}-cooldown`}
            label="Vuelta a la calma"
            onChange={(cooldown) => onChangeDay({ session: { ...day.session, cooldown } })}
          />
        </View>
      )}
    </View>
  );
}

// Constructor de los 7 días fijos del plan — un DayCard por día, cada uno
// con su selector de tipo y (si es "Entrenamiento") sus 3 sub-bloques.
// Compartido por CreateTrainingPlanScreen y EditTrainingPlanScreen, mismo
// patrón que TeamGeneralInfoFields con useTeamGeneralInfoForm.
export function TrainingPlanFormFields({ form, durationOptions }) {
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
          <DayCard day={day} key={day.sequenceNo} onChangeDay={(updates) => form.updateDay(day.sequenceNo, updates)} />
        ))}
      </SectionCard>
    </>
  );
}
