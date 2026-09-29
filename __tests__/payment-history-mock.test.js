import {
  mockGetReceivedPayments,
  mockGetReceivedPaymentsSummary,
  mockGetPaymentHistory,
  __setMockPaymentHistoryNow,
  __resetMockPaymentHistory,
} from '../services/__mocks__/payment-history-mock.js';
import {
  toReceivedPaymentModel,
  toHistoryPaymentModel,
  toPaymentsPageModel,
  toReceivedSummaryModel,
} from '../services/normalizers.js';
import { statusGroupOf, paymentStatusMeta } from '../utils/payment-status.js';

// Sábado 26/09/2026, 15:00 en Argentina.
const NOW = '2026-09-26T18:00:00Z';

beforeEach(() => __setMockPaymentHistoryNow(NOW));
afterEach(() => __resetMockPaymentHistory());

async function allReceived(filters = {}) {
  const items = [];
  for (let page = 1; page < 20; page += 1) {
    const res = await mockGetReceivedPayments({ ...filters, page });
    items.push(...res.payments);
    if (!res.has_more) break;
  }
  return items;
}

describe('payment-history mock — cobros', () => {
  test('pagina de a 20 con has_more', async () => {
    const page1 = await mockGetReceivedPayments({ page: 1 });
    expect(page1.payments).toHaveLength(20);
    expect(page1.has_more).toBe(true);
    const all = await allReceived();
    expect(all.length).toBeGreaterThan(40);
  });

  test('ordena del más reciente al más antiguo', async () => {
    const all = await allReceived();
    const dates = all.map((p) => p.created_at);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  test('ningún pago queda en el futuro', async () => {
    const all = await allReceived();
    all.forEach((p) => expect(p.created_at <= NOW).toBe(true));
  });

  test('filtra por equipo y por grupo de estado', async () => {
    const trail = await allReceived({ teamId: 18 });
    expect(trail.length).toBeGreaterThan(0);
    trail.forEach((p) => expect(p.team.id).toBe(18));

    const rejected = await allReceived({ status: 'rejected' });
    expect(rejected.length).toBe(3);
    rejected.forEach((p) => expect(['rejected', 'cancelled']).toContain(p.status));
  });

  test('el neto solo existe en pagos aprobados, y no en todos', async () => {
    const all = await allReceived();
    const approved = all.filter((p) => p.status === 'approved');
    const withNet = approved.filter((p) => p.net_amount !== null);
    expect(withNet.length).toBeGreaterThan(0);
    expect(withNet.length).toBeLessThan(approved.length);
    all.filter((p) => p.status !== 'approved').forEach((p) => expect(p.net_amount).toBeNull());
  });
});

describe('payment-history mock — resumen', () => {
  test('6 meses seguidos que terminan en el mes actual', async () => {
    const s = await mockGetReceivedPaymentsSummary({ months: 6 });
    expect(s.monthly.map((m) => m.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  test('hay un mes sin cobros, con neto null', async () => {
    const s = await mockGetReceivedPaymentsSummary({ months: 6 });
    const empty = s.monthly.find((m) => m.gross_amount === 0);
    expect(empty).toBeDefined();
    expect(empty.net_amount).toBeNull();
  });

  test('pendientes y rechazados se cuentan por cuota, sobre el último intento', async () => {
    const s = await mockGetReceivedPaymentsSummary({ months: 6 });
    // 2 in_process en el mes actual; 3 rechazos pero uno tiene después un aprobado.
    expect(s.pending_count).toBe(2);
    expect(s.rejected_count).toBe(2);
  });

  test('el bruto mensual es la suma de los aprobados del listado', async () => {
    const s = await mockGetReceivedPaymentsSummary({ months: 6 });
    const all = await allReceived();
    const september = all
      .filter((p) => p.status === 'approved' && p.created_at >= '2026-09-01T03:00:00Z')
      .reduce((acc, p) => acc + p.gross_amount, 0);
    expect(s.monthly[5].gross_amount).toBe(september);
  });

  test('by_team queda ordenado por bruto descendente', async () => {
    const s = await mockGetReceivedPaymentsSummary({ months: 6 });
    const gross = s.by_team.map((t) => t.gross_amount);
    expect([...gross].sort((a, b) => b - a)).toEqual(gross);
    expect(s.by_team).toHaveLength(3);
  });

  test('con until la ventana termina en ese mes y no suma cobros posteriores', async () => {
    const s = await mockGetReceivedPaymentsSummary({ months: 6, until: '2026-07' });
    expect(s.monthly.map((m) => m.month)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    const all = await allReceived();
    const july = all
      .filter((p) => p.status === 'approved' && p.created_at >= '2026-07-01T03:00:00Z' && p.created_at < '2026-08-01T03:00:00Z')
      .reduce((acc, p) => acc + p.gross_amount, 0);
    expect(s.monthly[5].gross_amount).toBe(july);
  });

  test('earliest_month es el mes del cobro más viejo, sin importar la ventana', async () => {
    const all = await allReceived();
    const oldest = all.map((p) => p.created_at).sort()[0];
    const expected = new Date(new Date(oldest).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 7);
    expect((await mockGetReceivedPaymentsSummary({ months: 6 })).earliest_month).toBe(expected);
    expect((await mockGetReceivedPaymentsSummary({ months: 6, until: '2026-05' })).earliest_month).toBe(expected);
  });

  test('con 3 meses el equipo nuevo sigue apareciendo', async () => {
    const s = await mockGetReceivedPaymentsSummary({ months: 3 });
    expect(s.monthly).toHaveLength(3);
    expect(s.by_team.map((t) => t.team_id)).toContain(21);
  });
});

describe('payment-history mock — historial', () => {
  test('trae suscripciones y pagos a entrenadores, del más reciente al más antiguo', async () => {
    const res = await mockGetPaymentHistory({ page: 1 });
    expect(res.has_more).toBe(false);
    expect(res.payments.length).toBe(11);
    expect(new Set(res.payments.map((p) => p.type))).toEqual(new Set(['subscription', 'trainer_payment']));
    const dates = res.payments.map((p) => p.created_at);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  test('cada tipo trae su referencia y el otro par en null', async () => {
    const { payments } = await mockGetPaymentHistory({ page: 1 });
    payments.filter((p) => p.type === 'subscription').forEach((p) => {
      expect(p.tier).not.toBeNull();
      expect(p.team).toBeNull();
      expect(p.trainer).toBeNull();
    });
    payments.filter((p) => p.type === 'trainer_payment').forEach((p) => {
      expect(p.tier).toBeNull();
      expect(p.team.name).toBeTruthy();
      expect(p.trainer.surname).toBeTruthy();
    });
  });

  test('filtra por tipo y por estado', async () => {
    const subs = await mockGetPaymentHistory({ page: 1, type: 'subscription' });
    expect(subs.payments.length).toBe(7);
    const trainer = await mockGetPaymentHistory({ page: 1, type: 'trainer_payment', status: 'pending' });
    expect(trainer.payments).toHaveLength(1);
    expect(trainer.payments[0].status).toBe('in_process');
  });

  test('la primera cuota no tiene vencimiento', async () => {
    const { payments } = await mockGetPaymentHistory({ page: 1 });
    payments.filter((p) => p.installment_number === 1).forEach((p) => expect(p.due_date).toBeNull());
  });
});

describe('normalizers de historial de pagos', () => {
  test('toReceivedPaymentModel', () => {
    const model = toReceivedPaymentModel({
      id: 812, mp_payment_id: '131', status: 'approved', status_group: 'approved', status_detail: 'accredited',
      gross_amount: 15000, net_amount: 14101.5, currency_id: 'ARS', payment_method_id: 'visa',
      created_at: '2026-09-14T16:22:05Z', installment_id: 301, installment_number: 3,
      team: { id: 12, name: 'Runners' }, payer: { id: 45, name: 'Lucía', surname: 'Gómez', email: 'l@g.com' },
    });
    expect(model).toEqual(expect.objectContaining({
      id: '812', grossAmount: 15000, netAmount: 14101.5, installmentNumber: 3,
      team: { id: '12', name: 'Runners' }, payer: { id: '45', fullName: 'Lucía Gómez', email: 'l@g.com' },
    }));
  });

  test('toReceivedPaymentModel conserva el neto null y tolera refs vacías', () => {
    const model = toReceivedPaymentModel({ id: 1, gross_amount: 100, net_amount: null, team: { id: 0, name: '' }, payer: { id: 0, name: '', surname: '', email: '' } });
    expect(model.netAmount).toBeNull();
    expect(model.payer.fullName).toBe('');
  });

  test('toHistoryPaymentModel', () => {
    const tier = toHistoryPaymentModel({ id: 790, type: 'subscription', amount: 9999, installment_number: 2, due_date: null, tier: { id: 4, name: 'Premium_entrenador', role_name: 'entrenador' }, team: null, trainer: null });
    expect(tier).toEqual(expect.objectContaining({ id: '790', type: 'subscription', dueDate: null, tier: { id: '4', name: 'Premium_entrenador', roleName: 'entrenador' }, team: null, trainer: null }));
    const trainer = toHistoryPaymentModel({ id: 812, type: 'trainer_payment', tier: null, team: { id: 12, name: 'Runners' }, trainer: { id: 3, name: 'Pepa', surname: 'Lota' } });
    expect(trainer).toEqual(expect.objectContaining({ tier: null, team: { id: '12', name: 'Runners' }, trainer: { id: '3', fullName: 'Pepa Lota' } }));
    expect(toHistoryPaymentModel(null)).toBeNull();
  });

  test('toPaymentsPageModel', () => {
    expect(toPaymentsPageModel({ payments: [{ id: 1 }], has_more: true }, (p) => p.id)).toEqual({ items: [1], hasMore: true });
    expect(toPaymentsPageModel(null, (p) => p)).toEqual({ items: [], hasMore: false });
  });

  test('toReceivedSummaryModel', async () => {
    const model = toReceivedSummaryModel(await mockGetReceivedPaymentsSummary({ months: 6 }));
    expect(model.monthly).toHaveLength(6);
    expect(model.monthly[5]).toEqual(expect.objectContaining({ month: '2026-09', grossAmount: expect.any(Number) }));
    expect(model.byTeam[0]).toEqual(expect.objectContaining({ teamId: expect.any(String), pendingCount: expect.any(Number) }));
    expect(model.pendingCount).toBe(2);
    expect(model.earliestMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(toReceivedSummaryModel({ monthly: [], by_team: [] }).earliestMonth).toBeNull();
    expect(toReceivedSummaryModel(null)).toBeNull();
  });
});

describe('payment-status', () => {
  test('agrupa los estados de Mercado Pago', () => {
    expect(statusGroupOf('in_process')).toBe('pending');
    expect(statusGroupOf('cancelled')).toBe('rejected');
    expect(statusGroupOf('charged_back')).toBe('refunded');
    expect(statusGroupOf('algo_nuevo')).toBe('other');
  });

  test('etiqueta por estado, con fallback por grupo', () => {
    expect(paymentStatusMeta('in_process').label).toBe('En proceso');
    expect(paymentStatusMeta('algo_nuevo', 'rejected').label).toBe('Rechazado');
    expect(paymentStatusMeta('algo_nuevo', 'x').label).toBe('Otro');
  });
});
