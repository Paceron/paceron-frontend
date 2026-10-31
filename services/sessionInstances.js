import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetSessionInstance } from './__mocks__/calendar-mock.js';

// GET /api/v1/session-instances/:id — detalle standalone de una instancia
// (Gap 14). Necesario cuando el caller solo tiene el id (ej. una fila del
// historial de entrenamientos) y no la instancia completa en memoria — los
// demás puntos de entrada a la pantalla de revisión ya la traían embebida
// desde el calendario.
//
// Bug real 2026-10-29: esta función no tenía rama de mocks -- pegaba
// siempre contra el backend real (401 con USE_MOCKS=true, auth de mock no
// es válida ahí), encontrado al verificar session-review-screen.jsx (F5 /
// entrada directa por URL, el único camino real donde el slot no trae
// sessionInstance embebido). Mismo patrón de bug ya encontrado y
// arreglado 2026-10-21 en getWorkoutFeedbackPoints (services/
// runnerSession.js) -- el 401 contra el backend real disparaba el
// interceptor de refresh de services/api.js y terminaba deslogueando al
// usuario en medio de la pantalla.
export async function getSessionInstance(sessionInstanceId) {
  if (USE_MOCKS) return await mockGetSessionInstance(sessionInstanceId);
  return await api.get(`/session-instances/${Number(sessionInstanceId)}`);
}
