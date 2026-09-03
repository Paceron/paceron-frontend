import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockListTiers } from './__mocks__/tiers-mock.js';

// GET /api/v1/tiers — endpoint real ya existente (no es parte del
// dominio de pagos, es del sistema de roles/tiers). Sin parámetro de
// filtro por rol en el backend — devuelve todos los tiers de todos los
// roles, el caller filtra por rol activo (ver
// components/profile/tier-upgrade-screen.jsx).
export async function listTiers() {
  if (USE_MOCKS) return await mockListTiers();
  return await api.get('/tiers');
}
