import { View } from 'react-native';
import { DashboardState, StateAction } from './state-shell.jsx';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';

// `400`: la propia request está mal. NO hay botón de reintentar — reintentar sin
// cambiar el filtro devuelve el mismo 400 y el botón solo arma un bucle.
//
// Lo que hay es CORREGIR EL FILTRO, y qué corregir lo decide el `code` estable
// del backend a través del `action` de utils/dashboard-error-codes.js:
// `pick_dates`, `narrow_range`, `reset_tolerance`, `reset_param` o `none`. Cada
// action mapea a una acción concreta que la pantalla puede ofrecer; los que no
// tienen nada que ofrecer (los `reset_*`) se dicen por pantalla y se dejan
// resolver solos en el próximo ciclo, sin pedirle nada al usuario.
export function StateInvalidRequest({ id = 'dashboard-state-invalid', error, onFix, onResetTolerance, onResetParam }) {
  const resolved = resolveDashboardError(error);
  const message = resolved.message;
  const code = resolved.code ? ` (código ${resolved.code})` : '';

  return (
    <DashboardState
      icon="filter-alert-outline"
      id={id}
      message={`${message}${code}`}
      title="Revisá el filtro del período"
      tone="warning"
    >
      <View className="gap-2" nativeID={`${id}-actions`} testID={`${id}-actions`}>
        {resolved.action === 'pick_dates' ? (
          <StateAction
            icon="calendar-range"
            id={`${id}-pick-dates`}
            label="Elegir fechas"
            onPress={onFix}
            primary
          />
        ) : null}
        {resolved.action === 'narrow_range' ? (
          <StateAction
            icon="calendar-search"
            id={`${id}-narrow-range`}
            label="Acortar el rango"
            onPress={onFix}
            primary
          />
        ) : null}
        {resolved.action === 'reset_tolerance' ? (
          <StateAction
            id={`${id}-reset-tolerance`}
            icon="restore"
            label="Volver a la tolerancia por defecto"
            onPress={onResetTolerance}
            primary
          />
        ) : null}
        {resolved.action === 'reset_param' ? (
          <StateAction
            id={`${id}-reset-param`}
            icon="restore"
            label="Volver al valor por defecto"
            onPress={onResetParam}
            primary
          />
        ) : null}
        {resolved.action === 'none' ? (
          <StateAction
            id={`${id}-open-filters`}
            icon="tune"
            label="Abrir los filtros"
            onPress={onFix}
            primary
          />
        ) : null}
      </View>
    </DashboardState>
  );
}
