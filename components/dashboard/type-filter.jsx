import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { EXERCISE_KIND_META } from '../plans/exercise-kind-meta.js';
import { METRIC_KINDS } from '../../utils/dashboard-filter-cascade.js';

// Primer filtro de la cascada del dashboard: el TIPO de ejercicio.
//
// Es un desplegable de selección única y no el tablist que había antes
// (`kind-filter.jsx`, borrado): el pedido es "tipo → ejercicio → rangos → fechas",
// el tipo tiene opción "todos", y un grupo de cinco botones arriba de la barra
// competía con el filtro de ejercicio en vez de completar la cascada.
//
// "Todos" es el valor VACÍO y no un id más: viaja al backend como la AUSENCIA
// del parámetro `kind`, que es lo que acepta el contrato (`kind` es escalar, no
// `kinds[]`).
export function TypeFilter({ kind = '', onChange, disabled = false, kinds = METRIC_KINDS }) {
  const options = kinds.map((value) => ({ id: value, name: EXERCISE_KIND_META[value]?.label ?? value }));

  // Sin `idPrefix`: SelectField y PickerField no lo tienen — los dos derivan el
  // nativeID del slug del label (fields.jsx), que acá ya es único en la pantalla.
  return (
    <ResponsiveSelectField
      dense
      disabled={disabled}
      label="Tipo de ejercicio"
      onChange={onChange}
      options={options}
      placeholder="Todos"
      value={kind}
    />
  );
}