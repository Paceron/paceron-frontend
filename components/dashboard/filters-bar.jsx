import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Row, Col, FIELD_LABEL } from '../forms/fields.jsx';
import { NumberFieldWithSuggestions } from '../forms/number-field-with-suggestions.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { SearchablePickerField } from '../forms/searchable-picker-field.jsx';
import { DISTANCE_SUGGESTIONS_KM, TIME_SUGGESTIONS_MIN } from '../../utils/dashboard-range.js';
import { formatKind } from '../../utils/dashboard-format.js';
import { useThemeColors } from '../../theme/colors.js';
import { TypeFilter } from './type-filter.jsx';
import { DashboardDateField } from './dashboard-date-field.jsx';

// Rótulo de cada extremo de un rango: el título del grupo ya dice de qué es el
// rango ("Distancia", "Tiempo", "Fecha"), así que acá va chico y en gris para
// que se lea la jerarquía (título → extremo) y para no competir con los rótulos
// de los campos de arriba.
const RANGE_SUBLABEL = 'mb-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400';

// Los campos de la barra de filtros del dashboard, en el orden de la cascada:
// Tipo → Ejercicio → Rangos → Fechas. Cada paso habilita al siguiente, y cada
// rótulo dice qué filtro es: "Tipo de ejercicio" y "Ejercicio" son dos filtros
// distintos que antes se llamaban igual.
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
//
// NO es una card: la card, el título "Filtros", el scope, el badge con el conteo
// y el botón de colapsar los pone el `FilterPanel` que lo envuelve
// (dashboard-screen.jsx). Antes traía su propia card adentro del panel, o sea una
// card dentro de otra. "Filtrar" y "Limpiar" SÍ viven acá (son lo único del panel
// que movimos hacia adentro) porque quedaron al pie del form, junto a las fechas:
// el form es un BORRADOR y nada se consulta hasta presionar "Filtrar" — escribir
// un rango no dispara una request por tecla. El `FilterPanel` sigue soportando
// `onClear` en el header para las dos pantallas de calendario, que sí lo usan ahí.
//
// "Filtrar" es la acción primaria (verde); "Limpiar" es secundaria (gris) y solo
// aparece cuando hay algo aplicado que limpiar.
export function FiltersBar({
  id = 'dashboard-filters',
  groups = [],
  athletes = [],
  exercises = [],
  kinds,
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
  dateErrors = {},
  hasActiveFilters = false,
  onApply,
  onClear,
  applyDisabled = false,
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

  // Los cuatro rangos dependen del SCOPE (grupo/corredor), no del ejercicio: el
  // contrato aplica `distance_*`/`time_*` en el WHERE por su cuenta, igual que
  // `kind`/`exercise_id`. Antes se deshabilitaban sin ejercicio y eso además los
  // apagaba cada vez que la cascada reseteaba el ejercicio al cambiar de grupo o
  // corredor, por eso el bloqueo se veía intermitente. Solo se deshabilitan
  // mientras los filtros todavía están cargando.
  const rangesDisabled = loading;

  return (
    <View nativeID={id} testID={id}>
      {/* Alcance y cascada en una sola fila de 4 columnas en ancho: Grupo,
          Corredor, Tipo y Ejercicio. En angosto cada uno cae a ancho completo.
          Antes eran dos filas de 2; juntarlas es lo que permite que el form
          abierto ocupe solo dos filas en desktop sin esconder ningún filtro. */}
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
        <Col>
          <TypeFilter kind={kind} kinds={kinds} onChange={onChangeKind} />
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

      {/* Distancia, Tiempo y Fecha comparten la segunda fila en ancho: son tres
          grupos más un bloque de acciones debajo de la fecha. Cada grupo es UNA
          pregunta con dos extremos, con un solo título ("Distancia", "Tiempo",
          "Fecha") y las dos cajas debajo; el título NO repite "desde / hasta"
          porque cada caja ya lo dice. Así el form entero queda en dos filas en
          desktop sin recortar los campos numéricos (el `dense` de web achica el
          toggle de sugerencias a 36 px y el padding del input; en táctil se
          mantienen los 44 px) ni las fechas.

          Los dos extremos van en un `flex-row` con slots `flex-1` propios, no en
          `Row`/`Col`: el `flex: 1` de `Col` solo aplica en ventana ancha
          (components/forms/fields.jsx), y acá los dos extremos tienen que quedar
          50/50 en cualquier ancho (si no, un `<input>` con `min-w-0` se encoge a
          su contenido). El `Row`/`Col` de afuera sí queda, para apilar los tres
          grupos en angosto. */}
      <Row>
        <Col>
          <View nativeID={`${id}-distance-range`} testID={`${id}-distance-range`}>
            <Text
              className={FIELD_LABEL}
              nativeID={`${id}-distance-range-title`}
              testID={`${id}-distance-range-title`}
            >
              Distancia
            </Text>
            <View
              className="flex-row gap-3"
              nativeID={`${id}-distance-range-inputs`}
              testID={`${id}-distance-range-inputs`}
            >
              <View className="flex-1" nativeID={`${id}-distance-from-slot`} testID={`${id}-distance-from-slot`}>
                <NumberFieldWithSuggestions
                  accessibilityLabel="Distancia desde"
                  dense
                  disabled={rangesDisabled}
                  error={rangeErrors.distanceFrom}
                  idPrefix={`${id}-distance-from`}
                  label="Desde"
                  labelClassName={RANGE_SUBLABEL}
                  onChange={onChangeDistanceFrom}
                  placeholder={loading ? 'Cargando…' : undefined}
                  suggestions={DISTANCE_SUGGESTIONS_KM}
                  unit="km"
                  value={distanceFrom ?? ''}
                />
              </View>
              <View className="flex-1" nativeID={`${id}-distance-to-slot`} testID={`${id}-distance-to-slot`}>
                <NumberFieldWithSuggestions
                  accessibilityLabel="Distancia hasta"
                  dense
                  disabled={rangesDisabled}
                  error={rangeErrors.distanceTo}
                  idPrefix={`${id}-distance-to`}
                  label="Hasta"
                  labelClassName={RANGE_SUBLABEL}
                  onChange={onChangeDistanceTo}
                  placeholder={loading ? 'Cargando…' : undefined}
                  suggestions={DISTANCE_SUGGESTIONS_KM}
                  unit="km"
                  value={distanceTo ?? ''}
                />
              </View>
            </View>
          </View>
        </Col>
        <Col>
          <View nativeID={`${id}-time-range`} testID={`${id}-time-range`}>
            <Text
              className={FIELD_LABEL}
              nativeID={`${id}-time-range-title`}
              testID={`${id}-time-range-title`}
            >
              Tiempo
            </Text>
            <View
              className="flex-row gap-3"
              nativeID={`${id}-time-range-inputs`}
              testID={`${id}-time-range-inputs`}
            >
              <View className="flex-1" nativeID={`${id}-time-from-slot`} testID={`${id}-time-from-slot`}>
                <NumberFieldWithSuggestions
                  accessibilityLabel="Tiempo desde"
                  dense
                  disabled={rangesDisabled}
                  error={rangeErrors.timeFrom}
                  idPrefix={`${id}-time-from`}
                  label="Desde"
                  labelClassName={RANGE_SUBLABEL}
                  onChange={onChangeTimeFrom}
                  placeholder={loading ? 'Cargando…' : undefined}
                  suggestions={TIME_SUGGESTIONS_MIN}
                  unit="min"
                  value={timeFrom ?? ''}
                />
              </View>
              <View className="flex-1" nativeID={`${id}-time-to-slot`} testID={`${id}-time-to-slot`}>
                <NumberFieldWithSuggestions
                  accessibilityLabel="Tiempo hasta"
                  dense
                  disabled={rangesDisabled}
                  error={rangeErrors.timeTo}
                  idPrefix={`${id}-time-to`}
                  label="Hasta"
                  labelClassName={RANGE_SUBLABEL}
                  onChange={onChangeTimeTo}
                  placeholder={loading ? 'Cargando…' : undefined}
                  suggestions={TIME_SUGGESTIONS_MIN}
                  unit="min"
                  value={timeTo ?? ''}
                />
              </View>
            </View>
          </View>
        </Col>
        <Col>
          <View nativeID={`${id}-date-range`} testID={`${id}-date-range`}>
            <Text
              className={FIELD_LABEL}
              nativeID={`${id}-date-range-title`}
              testID={`${id}-date-range-title`}
            >
              Fecha
            </Text>
            <View
              className="flex-row gap-3"
              nativeID={`${id}-date-range-inputs`}
              testID={`${id}-date-range-inputs`}
            >
              <View className="flex-1" nativeID={`${id}-date-from-slot`} testID={`${id}-date-from-slot`}>
                <DashboardDateField
                  className=""
                  dense
                  disableFutureLimit
                  error={dateErrors.from}
                  idPrefix={`${id}-date-from`}
                  label="Desde"
                  labelClassName={RANGE_SUBLABEL}
                  onChange={onChangeFrom}
                  value={from ?? ''}
                />
              </View>
              <View className="flex-1" nativeID={`${id}-date-to-slot`} testID={`${id}-date-to-slot`}>
                <DashboardDateField
                  className=""
                  dense
                  disableFutureLimit
                  error={dateErrors.to}
                  idPrefix={`${id}-date-to`}
                  label="Hasta"
                  labelClassName={RANGE_SUBLABEL}
                  onChange={onChangeTo}
                  value={to ?? ''}
                />
              </View>
            </View>
          </View>

          {/* Las acciones cierran el form debajo de la fecha, alineadas a la
              derecha: siguen al pie (no en el header, donde estaban lejos de lo
              que limpian) y no necesitan una fila propia. "Limpiar" (gris,
              secundaria) va primero; "Filtrar" (verde, primaria) cierra. */}
          <View
            className="mt-3 flex-row items-center justify-end gap-2"
            nativeID={`${id}-actions-slot`}
            testID={`${id}-actions-slot`}
          >
            {hasActiveFilters ? (
              <Pressable
                accessibilityLabel="Limpiar los filtros"
                className="h-9 flex-row items-center gap-1.5 rounded-full bg-slate-200 px-4 active:opacity-80 dark:bg-slate-700"
                nativeID={`${id}-clear`}
                onPress={onClear}
                testID={`${id}-clear`}
              >
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="broom" size={16} />
                <Text
                  className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200"
                  nativeID={`${id}-clear-label`}
                  testID={`${id}-clear-label`}
                >
                  Limpiar
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="Aplicar los filtros"
              accessibilityState={{ disabled: applyDisabled }}
              className={`h-9 flex-row items-center gap-1.5 rounded-full bg-primary px-4 ${
                applyDisabled ? 'opacity-50' : 'active:opacity-80'
              }`}
              disabled={applyDisabled}
              nativeID={`${id}-apply`}
              onPress={onApply}
              testID={`${id}-apply`}
            >
              <MaterialCommunityIcons color={colors.onPrimary} name="filter-check" size={16} />
              <Text
                className="text-xs font-semibold uppercase tracking-wide text-[#111518]"
                nativeID={`${id}-apply-label`}
                testID={`${id}-apply-label`}
              >
                Filtrar
              </Text>
            </Pressable>
          </View>
        </Col>
      </Row>
    </View>
  );
}
