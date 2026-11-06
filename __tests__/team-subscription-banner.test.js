import { teamSubscriptionBannerContent } from '../utils/team-subscription-banner.js';

const next = (overrides = {}) => ({
  installmentId: 9,
  installmentNumber: 2,
  installmentAmount: 15000,
  // 06/12 a las 23:37 en Argentina.
  nextDueDate: '2026-12-07T02:37:00Z',
  ...overrides,
});

describe('teamSubscriptionBannerContent', () => {
  it('con deuda avisa que la cuota venció', () => {
    const content = teamSubscriptionBannerContent({ hasDebt: true, nextInstallment: next() });
    expect(content.variant).toBe('debt');
    expect(content.title).toBe('Tu cuota está vencida');
    expect(content.detail).toBe('Pagá tu cuota para mantener la membresía al día.');
    expect(content.buttonLabel).toBe('Completar pago');
  });

  it('sin el primer pago pide completarlo', () => {
    const content = teamSubscriptionBannerContent({ isPendingFirstPayment: true, nextInstallment: next({ installmentNumber: 1 }) });
    expect(content.variant).toBe('pending');
    expect(content.detail).toBe('Completá la primera cuota para activar tu membresía.');
  });

  it('la deuda gana sobre el primer pago pendiente', () => {
    const content = teamSubscriptionBannerContent({ hasDebt: true, isPendingFirstPayment: true, nextInstallment: next({ installmentNumber: 1 }) });
    expect(content.variant).toBe('debt');
  });

  it('al día sigue ofreciendo pagar la próxima cuota, con su vencimiento en hora argentina', () => {
    const content = teamSubscriptionBannerContent({ nextInstallment: next() });
    expect(content.variant).toBe('current');
    expect(content.title).toBe('Membresía al día');
    expect(content.amountLabel).toMatch(/^Próxima cuota #2 · \$\s?15\.000$/);
    expect(content.detail).toBe('Vence el 06/12/2026. Podés pagarla antes si querés.');
    expect(content.buttonLabel).toBe('Pagar cuota');
  });

  it('al día sin cuota abierta deja entrar a ver la cuota', () => {
    const content = teamSubscriptionBannerContent({ nextInstallment: null, membershipFee: 15000 });
    expect(content.variant).toBe('current');
    expect(content.amountLabel).toBeNull();
    expect(content.detail).toBe('No tenés cuotas pendientes por ahora.');
    expect(content.buttonLabel).toBe('Ver cuota');
  });

  it('sin monto cargado no muestra "$ 0"', () => {
    const content = teamSubscriptionBannerContent({ isPendingFirstPayment: true, nextInstallment: null, membershipFee: null });
    expect(content.amountLabel).toBeNull();
  });
});
