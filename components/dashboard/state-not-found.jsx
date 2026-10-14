import { DashboardState, StateAction } from './state-shell.jsx';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';

// `404`: el recurso pedido no existe. Sin botón de reintentar —volver a pedirlo
// devuelve el mismo 404— y con salida explícita al listado.
//
// Ojo con el `403`: el backend responde 403 también cuando el equipo NO existe
// (resolveTeamGroup solo mira el scope, igual que el mock), así que un 404 aquí
// nunca significa "está en otro scope". Por eso los dos estados tienen mensajes
// distintos y el de permisos no revela nada.
export function StateNotFound({ id = 'dashboard-state-not-found', error, onBack }) {
  const resolved = resolveDashboardError(error);

  return (
    <DashboardState
      icon="help-circle-outline"
      id={id}
      message={resolved.message}
      title="Ese recurso no existe"
      tone="warning"
    >
      <StateAction icon="arrow-left" id={`${id}-back`} label="Volver al listado" onPress={onBack} primary />
    </DashboardState>
  );
}
