import { buildCompetitionTitle } from '../utils/competition-title.js';
import { totalRouteMeters } from '../utils/route-geometry.js';
import { formatMeters } from '../utils/distance.js';

describe('buildCompetitionTitle', () => {
  test('type=metric arma "métrica (desde → hasta)"', () => {
    const title = buildCompetitionTitle({ type: 'metric', metric: 'distance', startAt: '2026-10-01', endAt: '2026-10-07' });
    expect(title).toBe('Distancia (2026-10-01 → 2026-10-07)');
  });

  test('type=route arma "Por trayectoria · distancia · N puntos", sin usar metric/endAt (ambos null)', () => {
    const coordinates = [[-58.4, -34.6], [-58.41, -34.61], [-58.42, -34.62]];
    const title = buildCompetitionTitle({
      type: 'route', metric: null, startAt: '2026-10-01', endAt: null,
      route: { type: 'LineString', coordinates },
    });
    const expectedMeters = totalRouteMeters(coordinates.map(([lng, lat]) => ({ lat, lng })));
    expect(title).toBe(`Por trayectoria · ${formatMeters(expectedMeters)} · 3 puntos`);
    expect(title).not.toContain('null');
  });

  test('type=route con un solo punto -> singular, distancia 0', () => {
    const title = buildCompetitionTitle({
      type: 'route', metric: null, startAt: '2026-10-01', endAt: null,
      route: { type: 'LineString', coordinates: [[-58.4, -34.6]] },
    });
    expect(title).toBe('Por trayectoria · 0 m · 1 punto');
  });
});
