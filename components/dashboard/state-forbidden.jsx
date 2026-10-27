import { DashboardState, StateAction } from './state-shell.jsx';
import { resolveDashboardError } from '../../utils/dashboard-error-codes.js';

// `403`: el recurso está fuera del scope del solicitante.
//
// El mensaje NO revela si el recurso existe —ni que falta ni que no se puede
// ver—, y por una razón concreta del backend: `resolveTeamGroup` contesta 403
// también cuando el equipo no existe, justamente para no filtrar existencia por
// la diferencia entre el 403 y el 404. Un texto como "no tenés permiso" sí la
// revelaría.
export function StateForbidden({ id = 'dashboard-state-forbidden', error, onBack }) {
  const resolved = resolveDashboardError(error);

  return (
    <DashboardState
      icon="shield-lock-outline"
      id={id}
      message={resolved.message}
      title="Este recurso no está entre los que podés ver"
      tone="warning"
    >
      {onBack ? <StateAction icon="arrow-left" id={`${id}-back`} label="Volver" onPress={onBack} primary /> : null}
    </DashboardState>
  );
}
