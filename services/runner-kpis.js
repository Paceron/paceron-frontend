import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { useAuthStore } from '../store/auth-store.js';
import { toISODate } from '../utils/date-field-format.js';
import { mockGetRunnerKpis } from './__mocks__/runner-kpis-mock.js';

// GET /api/v1/dashboard/runner-kpis.
//
// El endpoint es nuevo y vive en el change hermano `kpis-home-corredor` del
// backend. El corredor sale del token: el front NO manda team_id, group_id ni
// athlete_user_id. Tampoco deriva from/to — los recibe y los muestra.
//
// `reference_date` viaja en ISO. El DateField del repo emite DD/MM/YYYY, pero
// acá la fecha la calcula el dispositivo, así que se normaliza igual en el
// borde para no depender del formato interno del caller.
export async function getRunnerKpis({ period = 'month', referenceDate, tab = 'general' } = {}) {
  const isoReference = toISODate(referenceDate);

  if (USE_MOCKS) {
    return await mockGetRunnerKpis({
      period,
      referenceDate: isoReference,
      tab,
      callerUserId: useAuthStore.getState().userId ?? null,
    });
  }

  const params = new URLSearchParams();
  params.set('period', period);
  if (isoReference) params.set('reference_date', isoReference);
  params.set('tab', tab);

  return await api.get(`/dashboard/runner-kpis?${params.toString()}`);
}
