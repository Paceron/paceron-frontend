import { useThemeColors } from '../../theme/colors';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DASHBOARD_GRANULARITIES } from '../../services/dashboard.js';
import { GRANULARITY_LABELS } from '../../utils/dashboard-format.js';

// Control de granularidad de la línea de evolución.
//
// Va montado EN el ChartCard de la evolución y no en la barra de filtros porque
// no selecciona datos: decide cómo se agrupan los que ya están. Puesto en la
// barra se leía como un filtro más y no se entendía qué cambiaba.
//
// `hideLabel` porque el ícono + el valor alcanzado se entienden solos; el
// accessibilityLabel del select sigue nombrándolo para lector de pantalla.
export function GranularitySelect({ id, value, onChange, enabled = true }) {
  const colors = useThemeColors();

  return (
    <ResponsiveSelectField
      dense
      disabled={!enabled}
      hideLabel
      idPrefix={id}
      label="Agrupar por"
      onChange={onChange}
      options={DASHBOARD_GRANULARITIES.map((granularity) => ({
        id: granularity,
        name: GRANULARITY_LABELS[granularity] ?? granularity,
      }))}
      value={value}
    />
  );
}