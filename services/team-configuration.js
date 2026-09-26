import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetTeamConfiguration } from './__mocks__/team-configuration-mock.js';

// GET /api/v1/team-configuration — topes de creación/edición de equipo
// (`{max_members, minimum_fee}`, TeamConfiguration) derivados del tier del
// ENTRENADOR autenticado, no de un equipo puntual: por eso no lleva params ni
// id. Self-only, 401 sin identity.
export async function getTeamConfiguration() {
  if (USE_MOCKS) return await mockGetTeamConfiguration();
  return await api.get('/team-configuration');
}
