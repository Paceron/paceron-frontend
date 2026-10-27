import { DASHBOARD_KEYS, dashboardScopeKey } from '../hooks/use-dashboard-query.js';

// La query key es lo que decide si el caché devuelve LA respuesta que se está
// pidiendo o la de otra combinación de filtros. El error que importa no es que
// falte un dato: es que falte un filtro y la pantalla muestre los números de
// otra búsqueda sin ningún error visible.

const SCOPE = {
  teamId: 4,
  groupId: null,
  athleteUserId: null,
  exerciseId: 5,
  kind: null,
  distanceFromM: null,
  distanceToM: null,
  timeFromMin: null,
  timeToMin: null,
  from: '01/09/2026',
  to: '13/10/2026',
  tolerance: 0.05,
};

describe('dashboard query key — los cuatro de rango entran a la key', () => {
  test('cambiar cualquiera de los cuatro cambia la key', () => {
    const base = dashboardScopeKey(SCOPE);
    const variants = [
      { distanceFromM: 5000 },
      { distanceToM: 21000 },
      { timeFromMin: 30 },
      { timeToMin: 90 },
    ];
    for (const change of variants) {
      expect(dashboardScopeKey({ ...SCOPE, ...change })).not.toBe(base);
    }
  });

  test('el tipo y el ejercicio también cambian la key', () => {
    expect(dashboardScopeKey({ ...SCOPE, kind: 'ritmo_continuo' })).not.toBe(dashboardScopeKey(SCOPE));
    expect(dashboardScopeKey({ ...SCOPE, exerciseId: 6 })).not.toBe(dashboardScopeKey(SCOPE));
  });

  test('el corredor del scope cambia la key', () => {
    expect(dashboardScopeKey({ ...SCOPE, athleteUserId: 24 })).not.toBe(dashboardScopeKey(SCOPE));
    expect(dashboardScopeKey({ ...SCOPE, athleteUserId: '24' })).toBe(
      dashboardScopeKey({ ...SCOPE, athleteUserId: 24 }),
    );
  });

  test('"sin filtro" es una sola key: null y vacío no son dos búsquedas', () => {
    const withNull = dashboardScopeKey({ ...SCOPE, distanceFromM: null });
    const withEmpty = dashboardScopeKey({ ...SCOPE, distanceFromM: '' });
    const withUndefined = dashboardScopeKey({ ...SCOPE, distanceFromM: undefined });
    expect(withEmpty).toBe(withNull);
    expect(withUndefined).toBe(withNull);
  });

  test('el mismo id como number y como string es la misma búsqueda', () => {
    expect(dashboardScopeKey({ ...SCOPE, teamId: '4', exerciseId: '5' })).toBe(dashboardScopeKey(SCOPE));
  });

  test('todas las keys de métricas comparten el scope, así que el rango las separa a todas', () => {
    const base = SCOPE;
    const withRange = { ...SCOPE, distanceFromM: 5000, distanceToM: 21000 };
    const keys = [
      DASHBOARD_KEYS.summary(base),
      DASHBOARD_KEYS.timeseries(base, 'week'),
      DASHBOARD_KEYS.leaderboard(base, { page: 1, sort: 'best_time_ms', order: 'asc' }),
      DASHBOARD_KEYS.comparisons(base, []),
      DASHBOARD_KEYS.periods(base, { current: { from: '01/09/2026', to: '13/10/2026' } }),
    ];
    const ranged = [
      DASHBOARD_KEYS.summary(withRange),
      DASHBOARD_KEYS.timeseries(withRange, 'week'),
      DASHBOARD_KEYS.leaderboard(withRange, { page: 1, sort: 'best_time_ms', order: 'asc' }),
      DASHBOARD_KEYS.comparisons(withRange, []),
      DASHBOARD_KEYS.periods(withRange, { current: { from: '01/09/2026', to: '13/10/2026' } }),
    ];
    keys.forEach((key, index) => {
      expect(ranged[index].join('|')).not.toBe(key.join('|'));
    });
  });

  test('la comparación A/B separa por cada referencia y el rango', () => {
    const base = {
      teamId: 4,
      from: '2026-09-01',
      to: '2026-10-01',
      a: { groupId: 41, athleteUserId: 101, sessionInstanceId: 7101, exerciseId: 5 },
      b: { groupId: 42, athleteUserId: 105, sessionInstanceId: 7102, exerciseId: 10 },
    };
    const key = DASHBOARD_KEYS.sessionComparison(base).join('|');
    expect(DASHBOARD_KEYS.sessionComparison({ ...base, a: { ...base.a, sessionInstanceId: 7103 } }).join('|')).not.toBe(key);
    expect(DASHBOARD_KEYS.sessionComparison({ ...base, b: { ...base.b, athleteUserId: 106 } }).join('|')).not.toBe(key);
    expect(DASHBOARD_KEYS.sessionComparison({ ...base, to: '2026-10-02' }).join('|')).not.toBe(key);
  });
});
