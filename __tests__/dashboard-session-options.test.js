import {
  buildDashboardSessionOptions,
  buildDashboardComparisonChartPoints,
  dashboardSessionExercises,
  reconcileDashboardSessionId,
  updateDashboardSessionSide,
} from '../utils/dashboard-session-options.js';

describe('dashboard session options', () => {
  test('agrupa páginas por session_instance_id y conserva conteo/fecha', () => {
    const options = buildDashboardSessionOptions([
      { session_instance_id: 501, session_date: '2026-09-01', set_number: 1 },
      { session_instance_id: 502, session_date: '2026-09-01', set_number: 1 },
      { session_instance_id: '501', session_date: '2026-09-01', set_number: 2 },
      { session_instance_id: 503, session_date: '2026-09-03', set_number: 1 },
    ]);

    expect(options).toEqual([
      { id: 503, date: '2026-09-03', name: '03/09/2026 · sesión 503', seriesCount: 1 },
      { id: 501, date: '2026-09-01', name: '01/09/2026 · sesión 501', seriesCount: 2 },
      { id: 502, date: '2026-09-01', name: '01/09/2026 · sesión 502', seriesCount: 1 },
    ]);
  });

  test('usa el session id como identidad aunque dos sesiones compartan fecha', () => {
    const options = buildDashboardSessionOptions([
      { session_instance_id: 10, session_date: '2026-09-01' },
      { session_instance_id: 11, session_date: '2026-09-01' },
    ]);

    expect(options).toHaveLength(2);
    expect(options.map((option) => option.id)).toEqual([10, 11]);
  });

  test('solo ofrece los tres tipos métricos del dashboard', () => {
    const exercises = [
      { id: 1, kind: 'ritmo_continuo' },
      { id: 2, kind: 'velocidad_distancia' },
      { id: 3, kind: 'velocidad_tiempo' },
      { id: 4, kind: 'liviano' },
      { id: 5, kind: 'elongacion' },
    ];

    expect(dashboardSessionExercises(exercises).map((exercise) => exercise.id)).toEqual([1, 2, 3]);
  });

  test('cambiar grupo/corredor/ejercicio limpia la sesión previa', () => {
    const selected = { groupId: '41', athleteUserId: '101', exerciseId: '5', sessionInstanceId: '7101' };
    ['groupId', 'athleteUserId', 'exerciseId'].forEach((key) => {
      expect(updateDashboardSessionSide(selected, key, 'next').sessionInstanceId).toBe('');
    });
    expect(updateDashboardSessionSide(selected, 'sessionInstanceId', 7102)).toEqual({
      ...selected,
      sessionInstanceId: '7102',
    });
  });

  test('al recargar opciones conserva solo una sesión que siga en el scope', () => {
    const options = [{ id: 7101 }, { id: 7102 }];
    expect(reconcileDashboardSessionId(options, '7102')).toBe('7102');
    expect(reconcileDashboardSessionId(options, 999)).toBe('');
    expect(reconcileDashboardSessionId(options, '')).toBe('');
  });

  test('mapea puntos del response para el scatter sin derivar velocidad', () => {
    const aPoint = { set_number: 1, speed_kph: 12.4 };
    const bPoint = { set_number: 1, speed_kph: null };
    expect(buildDashboardComparisonChartPoints({ series: [aPoint] }, { series: [bPoint] })).toEqual([
      { side: 'a', index: 0, point: aPoint, x: 1, y: 12.4 },
      { side: 'b', index: 0, point: bPoint, x: 1, y: null },
    ]);
  });
});
