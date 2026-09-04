import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockListTiers } from './__mocks__/tiers-mock.js';

// GET /api/v1/tiers?role_id= — endpoint real ya existente (no es parte
// del dominio de pagos, es del sistema de roles/tiers). El filtro
// role_id es opcional y ya soportado por el backend (confirmado en
// swagger 2026-09-05) — antes se traían todos los tiers y se filtraba
// client-side (ver components/profile/tier-upgrade-screen.jsx).
export async function listTiers({ roleId } = {}) {
  if (USE_MOCKS) return await mockListTiers({ roleId });
  const params = new URLSearchParams();
  if (roleId != null) params.set('role_id', roleId);
  const query = params.toString();
  return await api.get(query ? `/tiers?${query}` : '/tiers');
}
