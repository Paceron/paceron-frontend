import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Col, DateField, Row } from '../forms/fields.jsx';
import { NumberFieldWithSuggestions } from '../forms/number-field-with-suggestions.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { SearchablePickerField } from '../forms/searchable-picker-field.jsx';
import { DISTANCE_SUGGESTIONS_KM, TIME_SUGGESTIONS_MIN } from '../../utils/dashboard-range.js';
import { formatKind } from '../../utils/dashboard-format.js';
import { useThemeColors } from '../../theme/colors.js';
import { TypeFilter } from './type-filter.jsx';

// Barra de filtros del dashboard, en el orden de la cascada: Tipo → Ejercicio →
// Rangos → Fechas. Cada paso habilita al siguiente, y cada rótulo dice qué filtro
// es: "Tipo de ejercicio" y "Ejercicio" son dos filtros distintos que antes se
// llamaban igual.
//
// Grupo y corredor NO son parte de la cascada: son el scope de qué se está
// mirando (quién y de qué equipo), y van arriba. El corredor SOLO aparece en la
// vista de entrenador (`showAthlete`): en la del corredor el backend ya recorta
// el scope a sus propias series, así que ofrecerle elegir entre corredores sería
// un filtro que no puede cambiar nada.
//
// El EQUIPO no tiene select a propósito: la pantalla vive en
// `/teams/[teamId]/dashboard`, así que el equipo ya lo fija la ruta, y
// `/dashboard/filters` devuelve un único equipo —el del scope—. Un select con una
// sola opción es ruido.
export function FiltersBar({
  id = 'dashboard-filters',
  groups = [],
  athletes = [],
  exercises = [],
  scope,
  showAthlete = false,
  groupId,
  athleteUserId,
  kind,
  exerciseId,
  from,
  to,
  distanceFrom,
  distanceTo,
  timeFrom,
  timeTo,
  onChangeGroup,
  onChangeAthlete,
  onChangeKind,
  onChangeExercise,
  onChangeFrom,
  onChangeTo,
  onChangeDistanceFrom,
  onChangeDistanceTo,
  onChangeTimeFrom,
  onChangeTimeTo,
  rangeErrors = {},
  loading = false,
}) {
  const colors = useThemeColors();
  const groupOptions = groups.map((group) => ({ id: group.id, name: group.name }));
  const athleteOptions = athletes.map((athlete) => ({ id: athlete.id, name: `${athlete.name} ${athlete.surname}`.trim() }));
  const exerciseOptions = exercises.map((exercise) => ({ id: exercise.id, name: exercise.name }));
  const kindById = useMemo(
    () => new Map(exercises.map((exercise) => [String(exercise.id), exercise.kind])),
    [exercises],
  );

  // Sin ejercicio elegido el rango no tiene contra qué acotar, así que los cuatro
  // campos quedan deshabilitados (spec, cascada).
  const rangesDisabled = !exerciseId;

  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={id} testID={id}>
      <View className="mb-3 flex-row items-center gap-2" nativeID={`${id}-header`} testID={`${id}-header`}>
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="filter-variant" size={16} />
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${id}-title`} testID={`${id}-title`}>
          Filtros
        </Text>
        {scope ? (
          <Text className="ml-auto text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-scope`} testID={`${id}-scope`}>
            {scope}
          </Text>
        ) : null}
      </View>

      <Row>
        <Col>
          <ResponsiveSelectField
            dense
            idPrefix={`${id}-group`}
            label="Grupo"
            onChange={onChangeGroup}
            options={groupOptions}
            placeholder="Todos los grupos"
            value={groupId ?? ''}
          />
        </Col>
        {showAthlete ? (
          <Col>
            <ResponsiveSelectField
              dense
              idPrefix={`${id}-athlete`}
              label="Corredor"
              onChange={onChangeAthlete}
              options={athleteOptions}
              placeholder="Todos los corredores"
              value={athleteUserId ?? ''}
            />
          </Col>
        ) : null}
      </Row>

      <Row>
        <Col>
          <TypeFilter kind={kind} onChange={onChangeKind} />
        </Col>
        <Col>
          <SearchablePickerField
            dense
            idPrefix={`${id}-exercise`}
            label="Ejercicio"
            loading={loading}
            onChange={onChangeExercise}
            options={exerciseOptions}
            placeholder="Todos los ejercicios"
            renderOptionMeta={(option) => {
              const optionKind = kindById.get(String(option.id));
              return optionKind ? formatKind(optionKind) : null;
            }}
            value={exerciseId ?? ''}
          />
        </Col>
      </Row>

      <Text
        className="mb-1 text-xs text-slate-500 dark:text-slate-400"
        nativeID={`${id}-ranges-hint`}
        testID={`${id}-ranges-hint`}
      >
        {rangesDisabled
          ? 'Elegí un ejercicio para acotar por distancia y tiempo.'
          : 'Escribí el valor o elegí uno de los sugeridos.'}
      </Text>

      <Row>
        <Col>
          <NumberFieldWithSuggestions
            dense
            disabled={rangesDisabled}
            error={rangeErrors.distanceFrom}
            idPrefix={`${id}-distance-from`}
            label="Distancia desde"
            onChange={onChangeDistanceFrom}
            suggestions={DISTANCE_SUGGESTIONS_KM}
            unit="km"
            value={distanceFrom ?? ''}
          />
        </Col>
        <Col>
          <NumberFieldWithSuggestions
            dense
            disabled={rangesDisabled}
            error={rangeErrors.distanceTo}
            idPrefix={`${id}-distance-to`}
            label="Distancia hasta"
            onChange={onChangeDistanceTo}
            suggestions={DISTANCE_SUGGESTIONS_KM}
            unit="km"
            value={distanceTo ?? ''}
          />
        </Col>
      </Row>

      <Row>
        <Col>
          <NumberFieldWithSuggestions
            dense
            disabled={rangesDisabled}
            error={rangeErrors.timeFrom}
            idPrefix={`${id}-time-from`}
            label="Tiempo desde"
            onChange={onChangeTimeFrom}
            suggestions={TIME_SUGGESTIONS_MIN}
            unit="min"
            value={timeFrom ?? ''}
          />
        </Col>
        <Col>
          <NumberFieldWithSuggestions
            dense
            disabled={rangesDisabled}
            error={rangeErrors.timeTo}
            idPrefix={`${id}-time-to`}
            label="Tiempo hasta"
            onChange={onChangeTimeTo}
            suggestions={TIME_SUGGESTIONS_MIN}
            unit="min"
            value={timeTo ?? ''}
          />
        </Col>
      </Row>

      <Row>
        <Col>
          <DateField disableFutureLimit label="Desde" onChange={onChangeFrom} value={from ?? ''} />
        </Col>
        <Col>
          <DateField disableFutureLimit label="Hasta" onChange={onChangeTo} value={to ?? ''} />
        </Col>
      </Row>
    </View>
  );
}