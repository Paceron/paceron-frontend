import { mockGetTeamSubscription, mockGetTeamSubscriptions, __mockActivateTeamSubscription, __resetMockTeamSubscriptions } from '../services/__mocks__/team-subscriptions-mock.js';
import { __resetMockTeams, mockAddTeamUser } from '../services/__mocks__/teams-mock.js';
import { toTeamSubscriptionModel, toTeamSubscriptionsListModel } from '../services/normalizers.js';

// Equipos del seed de teams-mock.js: el 1 es gratis, el 2 cobra 25000.
const FREE_TEAM_ID = 1;
const PAID_TEAM_ID = 2;
const USER_ID = 42;

describe('team-subscriptions-mock', () => {
  beforeEach(() => {
    __resetMockTeams();
    __resetMockTeamSubscriptions();
  });

  test('equipo gratis: membresía activa, sin cuota ni datos de checkout', async () => {
    const dto = await mockGetTeamSubscription(USER_ID, FREE_TEAM_ID);
    expect(dto.membership.subscription_status).toBe('active');
    expect(dto.next_installment).toBeUndefined();
    expect(dto.mercadopago).toBeUndefined();
    expect(dto.has_debt).toBe(false);
  });

  test('equipo pago: arranca en first_payment_pending con la cuota #1', async () => {
    const dto = await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);
    expect(dto.membership.subscription_status).toBe('first_payment_pending');
    expect(dto.membership.paid_installments).toBe(0);
    expect(dto.next_installment.installment_number).toBe(1);
    expect(dto.next_installment.installment_amount).toBe(25000);
    // La cuota #1 no tiene vencimiento: nunca cuenta como deuda.
    expect(dto.next_installment.next_due_date).toBeNull();
    expect(dto.has_debt).toBe(false);
  });

  test('el estado es estable entre llamadas (no regenera la cuota)', async () => {
    const first = await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);
    const second = await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);
    expect(second.next_installment.installment_id).toBe(first.next_installment.installment_id);
  });

  // Igual que el mock de tier: no hay webhook que simular, así que el mock NO
  // activa solo. Es lo que permite ejercer la UI de "puede tardar en
  // reflejarse" sin infraestructura de webhook.
  test('no se activa solo: sigue pendiente después de leerlo varias veces', async () => {
    await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);
    const dto = await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);
    expect(dto.membership.subscription_status).toBe('first_payment_pending');
  });

  test('__mockActivateTeamSubscription activa la membresía y genera la cuota siguiente', async () => {
    await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);
    __mockActivateTeamSubscription(USER_ID, PAID_TEAM_ID);
    const dto = await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);

    expect(dto.membership.subscription_status).toBe('active');
    expect(dto.membership.paid_installments).toBe(1);
    expect(dto.next_installment.installment_number).toBe(2);
    expect(dto.next_installment.next_due_date).not.toBeNull();
    expect(dto.next_installment.blocked_date).not.toBeNull();
    // Recién pagada, la cuota #2 vence en el futuro → sin deuda.
    expect(dto.has_debt).toBe(false);
  });

  test('cada usuario tiene su propia membresía en el mismo equipo', async () => {
    const a = await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);
    __mockActivateTeamSubscription(USER_ID, PAID_TEAM_ID);
    const b = await mockGetTeamSubscription(99, PAID_TEAM_ID);

    expect(b.membership.subscription_status).toBe('first_payment_pending');
    expect(b.next_installment.installment_id).not.toBe(a.next_installment.installment_id);
  });

  test('la respuesta pasa por toTeamSubscriptionModel sin perder nada', async () => {
    const model = toTeamSubscriptionModel(await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID));
    expect(model.team.membershipFee).toBe(25000);
    expect(model.nextInstallment.installmentAmount).toBe(25000);
    expect(model.mercadopago.marketplace).toBe(true);
    expect(model.mercadopago.concept).toBe('team_subscription');
  });
});

describe('mockGetTeamSubscriptions (Gap 41)', () => {
  beforeEach(() => {
    __resetMockTeams();
    __resetMockTeamSubscriptions();
  });

  test('equipo gratis sin corredores: members vacío', async () => {
    const dto = await mockGetTeamSubscriptions(FREE_TEAM_ID);
    expect(dto.membership_fee).toBeFalsy();
    expect(dto.members).toEqual([]);
  });

  test('equipo gratis con corredores: todos active, sin deuda', async () => {
    await mockAddTeamUser(FREE_TEAM_ID, 201, 'corredor');
    await mockAddTeamUser(FREE_TEAM_ID, 202, 'corredor');
    const dto = await mockGetTeamSubscriptions(FREE_TEAM_ID);
    expect(dto.members).toHaveLength(2);
    expect(dto.members.every((m) => m.status === 'active' && m.has_debt === false)).toBe(true);
  });

  test('equipo pago sin historial propio: variedad determinística por posición', async () => {
    await mockAddTeamUser(PAID_TEAM_ID, 301, 'corredor');
    await mockAddTeamUser(PAID_TEAM_ID, 302, 'corredor');
    await mockAddTeamUser(PAID_TEAM_ID, 303, 'corredor');
    const dto = await mockGetTeamSubscriptions(PAID_TEAM_ID);

    expect(dto.members[0]).toMatchObject({ user_id: 301, status: 'active', has_debt: false });
    expect(dto.members[1]).toMatchObject({ user_id: 302, status: 'overdue', has_debt: true, subscription_status: 'active' });
    expect(dto.members[2]).toMatchObject({ user_id: 303, status: 'first_payment_pending', has_debt: false, paid_installments: 0 });
  });

  test('respeta el historial real si el corredor ya pasó por el flujo self-only', async () => {
    await mockAddTeamUser(PAID_TEAM_ID, USER_ID, 'corredor');
    await mockGetTeamSubscription(USER_ID, PAID_TEAM_ID);
    __mockActivateTeamSubscription(USER_ID, PAID_TEAM_ID);

    const dto = await mockGetTeamSubscriptions(PAID_TEAM_ID);
    expect(dto.members[0]).toMatchObject({ user_id: USER_ID, status: 'active', has_debt: false, paid_installments: 1 });
  });

  test('no incluye corredores inactivos ni al entrenador', async () => {
    await mockAddTeamUser(PAID_TEAM_ID, 401, 'entrenador');
    await mockAddTeamUser(PAID_TEAM_ID, 402, 'corredor');
    const dto = await mockGetTeamSubscriptions(PAID_TEAM_ID);
    expect(dto.members.map((m) => m.user_id)).toEqual([402]);
  });

  test('toTeamSubscriptionsListModel normaliza ids a string y no pierde campos', async () => {
    await mockAddTeamUser(PAID_TEAM_ID, 501, 'corredor');
    const model = toTeamSubscriptionsListModel(await mockGetTeamSubscriptions(PAID_TEAM_ID));
    expect(model.teamId).toBe(String(PAID_TEAM_ID));
    expect(model.membershipFee).toBe(25000);
    expect(model.members[0]).toEqual({
      userId: '501', status: 'active', subscriptionStatus: 'active', hasDebt: false, initAmount: 25000, paidInstallments: 2,
    });
  });
});
