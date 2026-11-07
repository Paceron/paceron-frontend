import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { toISODate } from '../utils/date-field-format.js';
import { mockGetTrainerHomeKpis } from './__mocks__/trainer-home-kpis-mock.js';

// GET /api/v1/dashboard/trainer-home-kpis. El backend identifica al entrenador
// por el token: el front no envía owner_id ni IDs de equipos/grupos.
export async function getTrainerHomeKpis({ period = 'month', referenceDate } = {}) {
  const isoReference = toISODate(referenceDate);
  if (USE_MOCKS) return await mockGetTrainerHomeKpis({ period, referenceDate: isoReference });

  const params = new URLSearchParams({ period });
  if (isoReference) params.set('reference_date', isoReference);
  return await api.get(`/dashboard/trainer-home-kpis?${params.toString()}`);
}
