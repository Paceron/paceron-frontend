import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Col, DateField, Row } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { SearchablePickerField } from '../forms/searchable-picker-field.jsx';
import { formatKind } from '../../utils/dashboard-format.js';
import { useThemeColors } from '../../theme/colors.js';

// Barra de filtros del dashboard: grupo, corredor, rango de fechas y tipo de
// ejercicio.
//
// El filtro de TIPO no vive acá: es el tablist de `kind-filter.jsx`, que va
// arriba de la barra. Acá va el ejercicio del catálogo, que es otra cosa — son 12
// filas del seed y se distinguen por un dato secundario (su tipo), que es
// exactamente el criterio de CLAUDE.md para `SearchablePickerField` sobre
// `ResponsiveSelectField`.
//
// El corredor SOLO aparece en la vista de entrenador (`showAthlete`): en la del
// corredor el backend ya recorta el scope a sus propias series, así que ofrecerle
// elegir entre corredores sería un filtro que no puede cambiar nada.
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
  exerciseId,
  from,
  to,
  onChangeGroup,
  onChangeAthlete,
  onChangeExercise,
  onChangeFrom,
  onChangeTo,
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
          <DateField disableFutureLimit label="Desde" onChange={onChangeFrom} value={from ?? ''} />
        </Col>
        <Col>
          <DateField disableFutureLimit label="Hasta" onChange={onChangeTo} value={to ?? ''} />
        </Col>
      </Row>

      <SearchablePickerField
        dense
        idPrefix={`${id}-exercise`}
        label="Tipo de ejercicio"
        loading={loading}
        onChange={onChangeExercise}
        options={exerciseOptions}
        placeholder="Todos los ejercicios"
        renderOptionMeta={(option) => {
          const kind = kindById.get(String(option.id));
          return kind ? formatKind(kind) : null;
        }}
        value={exerciseId ?? ''}
      />
    </View>
  );
}
