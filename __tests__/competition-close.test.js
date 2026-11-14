import { canCloseCompetition } from '../utils/competition-close.js';

const NOW = new Date(2026, 10, 14, 10, 0, 0).getTime(); // 2026-11-14 10:00 local

describe('canCloseCompetition', () => {
  test('métrica activa con endAt pasado se puede cerrar', () => {
    expect(canCloseCompetition({ type: 'metric', status: 'active', endAt: '2026-11-10T00:00:00Z' }, NOW)).toBe(true);
  });

  test('métrica activa con endAt futuro todavía no', () => {
    expect(canCloseCompetition({ type: 'metric', status: 'active', endAt: '2026-12-01T00:00:00Z' }, NOW)).toBe(false);
  });

  test('ruta activa sin endAt se puede cerrar siempre -- es abierta, el cierre ES la decisión del entrenador', () => {
    expect(canCloseCompetition({ type: 'route', status: 'active', endAt: null }, NOW)).toBe(true);
  });

  test('ruta activa CON endAt (si alguna vez existiera) respeta la fecha igual que métrica', () => {
    expect(canCloseCompetition({ type: 'route', status: 'active', endAt: '2026-12-01T00:00:00Z' }, NOW)).toBe(false);
    expect(canCloseCompetition({ type: 'route', status: 'active', endAt: '2026-11-01T00:00:00Z' }, NOW)).toBe(true);
  });

  test('métrica activa sin endAt NO se puede cerrar -- ahí sí es un dato que falta, no un diseño abierto', () => {
    expect(canCloseCompetition({ type: 'metric', status: 'active', endAt: null }, NOW)).toBe(false);
  });

  test('cualquier estado no-activo nunca se puede cerrar', () => {
    for (const status of ['pending_approval', 'finished', 'rejected', 'cancelled']) {
      expect(canCloseCompetition({ type: 'route', status, endAt: null }, NOW)).toBe(false);
      expect(canCloseCompetition({ type: 'metric', status, endAt: '2026-11-01T00:00:00Z' }, NOW)).toBe(false);
    }
  });
});
