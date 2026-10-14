import { TabBar } from '../shared/tab-bar.jsx';
import { KIND_LABELS } from '../../utils/dashboard-format.js';

// Filtro de TIPO de ejercicio como tablist real, reusando `TabBar` — que ya
// resuelve el patrón entero: `accessibilityRole="tab"` + `aria-selected` (los dos
// caminos, porque react-native-web@0.21 no implementa `accessibilityState`),
// roving `tabIndex` y flechas + `Home`/`End` con wrap-around.
//
// Es de selección única y por eso encaja con el patrón tablist: la opción activa
// se marca con `aria-selected` y las otras salen del recorrido con Tab. El
// filtro viaja a la API como `kinds[]` (1:N) y NO como `exercise_id`: son
// excluyentes entre sí en el backend (resolveExerciseFilter) y el array es la
// forma que el endpoint entiende.
//
// El rol de panel de tab NO se usa en ningún lado: no existe en el switch de
// ReactAccessibilityDelegate.java — el mismo delegate cuyo switch está
// verificado por __tests__/accessibility-roles.test.js, que además escanea el
// código de todo el repo y falla si aparece ese rol.

const ALL = 'all';

const KIND_TABS = [
  { id: ALL, label: 'Todos', icon: 'filter-variant' },
  { id: 'velocidad_tiempo', label: KIND_LABELS.velocidad_tiempo, icon: 'timer-outline' },
  { id: 'velocidad_distancia', label: KIND_LABELS.velocidad_distancia, icon: 'ruler' },
  { id: 'liviano', label: KIND_LABELS.liviano, icon: 'weather-windy' },
  { id: 'elongacion', label: KIND_LABELS.elongacion, icon: 'meditation' },
  { id: 'ritmo_continuo', label: KIND_LABELS.ritmo_continuo, icon: 'run' },
];

export function KindFilter({ id = 'dashboard-kind-filter', value, onChange }) {
  const active = value ?? ALL;
  return (
    <TabBar
      active={active}
      onChange={onChange}
      scope={id}
      tabs={KIND_TABS}
    />
  );
}

export { ALL as ALL_KINDS };
