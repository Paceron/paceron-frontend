import api from './api.js';

// GET /api/v1/session-instances/:id — detalle standalone de una instancia
// (Gap 14). Necesario cuando el caller solo tiene el id (ej. una fila del
// historial de entrenamientos) y no la instancia completa en memoria — los
// demás puntos de entrada a la pantalla de revisión ya la traían embebida
// desde el calendario.
export async function getSessionInstance(sessionInstanceId) {
  return await api.get(`/session-instances/${Number(sessionInstanceId)}`);
}
