import { buildCompetitionDatesLabel, buildCompetitionName, buildCompetitionTitle, COMPETITION_TYPE_ICON, formatCompetitionDate } from '../utils/competition-title.js';
import { totalRouteMeters } from '../utils/route-geometry.js';
import { formatMeters } from '../utils/distance.js';

describe('buildCompetitionTitle', () => {
  test('type=metric arma "métrica (desde → hasta)" en DD-MM-YYYY, sin la hora del ISO', () => {
    const title = buildCompetitionTitle({ type: 'metric', metric: 'distance', startAt: '2026-10-01T00:00:00Z', endAt: '2026-10-07T00:00:00Z' });
    expect(title).toBe('Distancia (01-10-2026 → 07-10-2026)');
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
    const competition = {
      type: 'route', metric: null, startAt: '2026-10-01', endAt: null,
      route: { type: 'LineString', coordinates: [[-58.4, -34.6]] },
    };
    expect(buildCompetitionTitle(competition)).toBe('Por trayectoria · 0 m · 1 punto');
  });
});

describe('formatCompetitionDate', () => {
  test('recorta la hora de un ISO completo y devuelve DD-MM-YYYY', () => {
    expect(formatCompetitionDate('2026-11-14T00:00:00Z')).toBe('14-11-2026');
  });

  test('acepta una fecha ISO sin hora', () => {
    expect(formatCompetitionDate('2026-11-14')).toBe('14-11-2026');
  });

  test('devuelve vacío para valores faltantes', () => {
    expect(formatCompetitionDate(null)).toBe('');
  });
});

describe('buildCompetitionName', () => {
  test('type=metric devuelve solo el nombre de la métrica, sin fechas', () => {
    expect(buildCompetitionName({ type: 'metric', metric: 'distance', startAt: '2026-10-01T00:00:00Z', endAt: '2026-10-07T00:00:00Z' })).toBe('Distancia');
  });

  test('type=route conserva el título descriptivo', () => {
    const competition = {
      type: 'route', metric: null, startAt: '2026-10-01', endAt: null,
      route: { type: 'LineString', coordinates: [[-58.4, -34.6]] },
    };
    expect(buildCompetitionName(competition)).toBe('Por trayectoria · 0 m · 1 punto');
  });
});


describe('buildCompetitionDatesLabel', () => {
  test('con inicio y fin usa una flecha', () => {
    expect(buildCompetitionDatesLabel({ startAt: '2026-10-01T00:00:00Z', endAt: '2026-10-07T00:00:00Z' })).toBe('01-10-2026 → 07-10-2026');
  });

  test('con solo inicio usa "Desde"', () => {
    expect(buildCompetitionDatesLabel({ startAt: '2026-10-01', endAt: null })).toBe('Desde 01-10-2026');
  });

  test('sin fechas devuelve null', () => {
    expect(buildCompetitionDatesLabel({ startAt: null, endAt: null })).toBeNull();
  });
});

describe('COMPETITION_TYPE_ICON', () => {
  test('mapea cada tipo a su icono', () => {
    expect(COMPETITION_TYPE_ICON.route).toBe('flag-checkered');
    expect(COMPETITION_TYPE_ICON.metric).toBe('trophy-variant');
  });
});
