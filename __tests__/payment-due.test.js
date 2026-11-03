import { HOME_DUE_WINDOW_DAYS, homeDuePayments, payRouteFor } from '../utils/payment-due.js';

const NOW = new Date('2026-11-03T15:00:00Z');
const item = (over) => ({ key: 'k', type: 'trainer_payment', teamId: 7, dueDate: '2026-11-20T00:00:00Z', overdue: false, ...over });

describe('homeDuePayments', () => {
  test('muestra las vencidas aunque la fecha sea vieja', () => {
    const late = item({ key: 'late', dueDate: '2026-08-22T00:00:00Z', overdue: true });
    expect(homeDuePayments([late], NOW)).toEqual([late]);
  });

  test('muestra las que vencen dentro de la ventana y no las más lejanas', () => {
    const soon = item({ key: 'soon', dueDate: '2026-11-12T23:00:00Z' });
    const far = item({ key: 'far', dueDate: '2026-11-20T00:00:00Z' });
    expect(HOME_DUE_WINDOW_DAYS).toBe(10);
    expect(homeDuePayments([soon, far], NOW).map((i) => i.key)).toEqual(['soon']);
  });

  test('respeta el orden y descarta items sin fecha', () => {
    const a = item({ key: 'a', dueDate: '2026-11-04T00:00:00Z' });
    const b = item({ key: 'b', overdue: true, dueDate: '2026-10-01T00:00:00Z' });
    expect(homeDuePayments([a, item({ key: 'x', dueDate: null }), b, null], NOW).map((i) => i.key)).toEqual(['a', 'b']);
    expect(homeDuePayments(undefined, NOW)).toEqual([]);
  });
});

describe('payRouteFor', () => {
  test('cuota de equipo va a la suscripción del equipo con el pago iniciado', () => {
    expect(payRouteFor(item({ teamId: 32 }))).toEqual({ pathname: '/teams/[teamId]/subscription', params: { teamId: '32', pay: '1' } });
  });

  test('cuota de tier va a la pantalla de tiers del rol de la suscripción', () => {
    expect(payRouteFor({ type: 'subscription', tierRoleName: 'corredor' })).toEqual({ pathname: '/profile/tier-upgrade', params: { pay: '1', role: 'corredor' } });
    expect(payRouteFor({ type: 'subscription', tierRoleName: null })).toEqual({ pathname: '/profile/tier-upgrade', params: { pay: '1' } });
  });

  test('sin equipo ni tier no hay ruta', () => {
    expect(payRouteFor(item({ teamId: null }))).toBeNull();
    expect(payRouteFor(null)).toBeNull();
  });
});
