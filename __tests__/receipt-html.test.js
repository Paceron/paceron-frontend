import { buildReceiptHtml, canHaveReceipt, receiptConcept, receiptFileName, formatReceiptDate } from '../utils/receipt-html.js';
import { paymentMethodLabel, paymentTypeLabel } from '../utils/payment-method.js';

const plain = (s) => s.replace(/ /g, ' ');

const tierPayment = {
  id: '790', mpPaymentId: '1319990011', type: 'subscription', status: 'approved', statusGroup: 'approved',
  amount: 9999, paymentMethodId: 'master', createdAt: '2026-09-02T15:10:00Z', installmentNumber: 2,
  tier: { name: 'Premium_entrenador' }, team: null, trainer: null,
};

const trainerPayment = {
  id: '812', mpPaymentId: '1319998877', type: 'trainer_payment', status: 'approved', statusGroup: 'approved',
  amount: 18000, paymentMethodId: 'account_money', createdAt: '2026-09-14T16:22:05Z', installmentNumber: 3,
  tier: null, team: { name: 'Club de Corredores Palermo' }, trainer: { fullName: 'Mariana Ibarra' },
};

describe('comprobante', () => {
  test('solo hay comprobante de pagos aprobados', () => {
    expect(canHaveReceipt(tierPayment)).toBe(true);
    expect(canHaveReceipt({ ...tierPayment, status: 'rejected' })).toBe(false);
    expect(canHaveReceipt({ ...tierPayment, status: 'in_process' })).toBe(false);
    expect(canHaveReceipt(null)).toBe(false);
  });

  test('concepto según el tipo', () => {
    expect(receiptConcept(tierPayment)).toBe('Plan Premium, cuota #2');
    expect(receiptConcept(trainerPayment)).toBe('Membresía de Club de Corredores Palermo (entrenador: Mariana Ibarra), cuota #3');
    expect(receiptConcept({ type: 'trainer_payment', team: null, trainer: null })).toBe('Membresía de Equipo');
  });

  test('nombre de archivo', () => {
    expect(receiptFileName(tierPayment)).toBe('comprobante-paceron-790.pdf');
  });

  test('fecha legible y tolerante a basura', () => {
    expect(formatReceiptDate('2026-09-02T15:10:00Z')).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/);
    expect(formatReceiptDate('no-es-fecha')).toBe('');
  });

  test('el HTML lleva monto, método, estado, concepto, pagador y la aclaración fiscal', () => {
    const html = plain(buildReceiptHtml({ payment: trainerPayment, payer: { fullName: 'Juan Liendo', email: 'juan@test.com' }, issuedAt: '2026-09-27T12:00:00Z' }));
    expect(html).toContain('Comprobante de pago N° 812');
    expect(html).toContain('$ 18.000,00');
    expect(html).toContain('Dinero en cuenta de Mercado Pago');
    expect(html).toContain('Aprobado');
    expect(html).toContain('Pago a entrenador');
    expect(html).toContain('Mariana Ibarra');
    expect(html).toContain('Juan Liendo · juan@test.com');
    expect(html).toContain('1319998877');
    expect(html).toContain('no es una factura fiscal');
  });

  test('escapa el HTML de los datos', () => {
    const html = buildReceiptHtml({ payment: { ...trainerPayment, team: { name: '<script>x</script>' } }, payer: null });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('métodos y tipos de pago', () => {
  test('métodos conocidos y desconocidos', () => {
    expect(paymentMethodLabel('visa')).toBe('Visa');
    expect(paymentMethodLabel('debmaster')).toBe('Mastercard débito');
    expect(paymentMethodLabel('nueva_tarjeta')).toBe('Nueva tarjeta');
    expect(paymentMethodLabel('')).toBe('—');
  });

  test('tipos', () => {
    expect(paymentTypeLabel('subscription')).toBe('Suscripción');
    expect(paymentTypeLabel('trainer_payment')).toBe('Pago a entrenador');
    expect(paymentTypeLabel('otro')).toBe('Pago');
  });
});
