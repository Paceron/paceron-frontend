import {
  MEMBER_PERIOD_COMPARISON_ENABLED,
  canCompareSessions,
  canReadPeriodComparison,
  canReadTeamRanking,
} from '../utils/dashboard-capabilities.js';

// Las dos secciones que el backend restringe, decididas por capacidad y no
// esparcidas como `activeRole === 'trainer'` por el JSX de la pantalla. El valor
// que importa fijar acá es que un rol CORREDOR no habilita ninguna de las dos
// mientras el backend siga devolviendo 403 a quien no es dueño.

describe('dashboard capabilities — ranking del equipo', () => {
  test('solo el entrenador', () => {
    expect(canReadTeamRanking('trainer')).toBe(true);
    expect(canReadTeamRanking('runner')).toBe(false);
  });

  test('nada más lo habilita: ni un rol desconocido ni la ausencia de rol', () => {
    ['', 'owner', 'trainer ', undefined, null].forEach((role) => {
      expect(canReadTeamRanking(role)).toBe(false);
    });
  });
});

describe('dashboard capabilities — comparación por período', () => {
  test('el entrenador siempre', () => {
    expect(canReadPeriodComparison('trainer')).toBe(true);
  });

  test('el corredor queda atado al interruptor del gap de backend', () => {
    // Hoy el endpoint es owner-only, así que el corredor NO la pide. El día que
    // `MEMBER_PERIOD_COMPARISON_ENABLED` pase a `true`, este test se actualiza
    // solo: lo que no puede pasar es que el corredor la pida con el flag apagado.
    expect(canReadPeriodComparison('runner')).toBe(MEMBER_PERIOD_COMPARISON_ENABLED);
    expect(MEMBER_PERIOD_COMPARISON_ENABLED).toBe(false);
  });

  test('nada más lo habilita', () => {
    ['', 'owner', undefined, null].forEach((role) => {
      expect(canReadPeriodComparison(role)).toBe(MEMBER_PERIOD_COMPARISON_ENABLED);
    });
  });
});

describe('dashboard capabilities — comparación A/B por sesión', () => {
  test('entrenador y corredor pueden comparar dentro de su scope', () => {
    expect(canCompareSessions('trainer')).toBe(true);
    expect(canCompareSessions('runner')).toBe(true);
  });

  test('no se monta para roles desconocidos', () => {
    ['', 'owner', undefined, null].forEach((role) => expect(canCompareSessions(role)).toBe(false));
  });
});
