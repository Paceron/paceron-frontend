import { mockGetTeamSubscription, __mockActivateTeamSubscription, __resetMockTeamSubscriptions } from '../services/__mocks__/team-subscriptions-mock.js';
import { __resetMockTeams } from '../services/__mocks__/teams-mock.js';
import { toTeamSubscriptionModel } from '../services/normalizers.js';

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
