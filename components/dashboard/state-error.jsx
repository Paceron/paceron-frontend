import { DashboardState, StateAction } from './state-shell.jsx';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';

// Error TRANSITORIO: red caída o `5xx`. Es el ÚNICO estado con botón de
// reintentar — reintentar sin cambiar nada un 400/403/404 devuelve el mismo
// error, así que el botón solo arma un bucle.
//
// El mensaje sale de `resolveDashboardError` y no se escribe acá: el mapa literal
// de utils/dashboard-error-codes.js es el que clasifica, y los códigos UPPER_SNAKE
// del backend no se muestran crudos.
export function StateError({ id = 'dashboard-state-error', error, onRetry, retrying = false }) {
  const resolved = resolveDashboardError(error);

  return (
    <DashboardState
      icon="wifi-alert"
      id={id}
      message={resolved.message}
      title="No pudimos cargar las métricas"
      tone="danger"
    >
      <StateAction
        icon="refresh"
        id={`${id}-retry`}
        label="Reintentar"
        loading={retrying}
        onPress={onRetry}
        primary
      />
    </DashboardState>
  );
}
