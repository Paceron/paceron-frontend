import { formatArs } from './currency.js';
import { paymentMethodLabel, paymentTypeLabel } from './payment-method.js';
import { paymentStatusMeta } from './payment-status.js';

// HTML del comprobante de un pago del historial. Es lo que se imprime a PDF
// (services/receipt.js en nativo, receipt.web.js en web). Lógica pura para
// poder testearla sin imprimir nada.
//
// Solo hay comprobante de pagos aprobados: de un pago rechazado no hay nada que
// comprobar. No es una factura fiscal y lo dice.

export function canHaveReceipt(payment) {
  return payment?.status === 'approved';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// DD/MM/AAAA HH:MM en la zona del dispositivo, igual que el resto de la app.
export function formatReceiptDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatTierName(name) {
  return (name ?? '').replace(/_(corredor|entrenador)$/i, '') || 'Suscripción';
}

// Detalle del concepto: qué plan, o a qué equipo y entrenador se le pagó.
export function receiptConcept(payment) {
  const installment = payment.installmentNumber ? `, cuota #${payment.installmentNumber}` : '';
  if (payment.type === 'subscription') {
    return `Plan ${formatTierName(payment.tier?.name)}${installment}`;
  }
  const team = payment.team?.name || 'Equipo';
  const trainer = payment.trainer?.fullName ? ` (entrenador: ${payment.trainer.fullName})` : '';
  return `Membresía de ${team}${trainer}${installment}`;
}

export function receiptFileName(payment) {
  return `comprobante-paceron-${payment.id}.pdf`;
}

export function buildReceiptHtml({ payment, payer, issuedAt = new Date().toISOString() }) {
  const rows = [
    ['Fecha del pago', formatReceiptDate(payment.createdAt)],
    ['Tipo', paymentTypeLabel(payment.type)],
    ['Concepto', receiptConcept(payment)],
    ['Método de pago', paymentMethodLabel(payment.paymentMethodId)],
    ['Estado', paymentStatusMeta(payment.status, payment.statusGroup).label],
    ['ID de operación de Mercado Pago', payment.mpPaymentId || '—'],
  ];
  const payerLine = [payer?.fullName, payer?.email].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(receiptFileName(payment))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111518; margin: 0; padding: 40px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: 1px; color: #3f6212; }
  h1 { font-size: 18px; margin: 4px 0 2px; }
  .muted { color: #64748b; font-size: 12px; }
  .amount { margin: 28px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
  .amount .label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .amount .value { font-size: 30px; font-weight: 800; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.k { color: #64748b; width: 42%; }
  td.v { font-weight: 600; }
  footer { margin-top: 36px; color: #94a3b8; font-size: 11px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="brand">PACERON</div>
  <h1>Comprobante de pago N° ${escapeHtml(payment.id)}</h1>
  <div class="muted">${escapeHtml(payerLine)}</div>
  <div class="amount">
    <div class="label">Monto pagado</div>
    <div class="value">${escapeHtml(formatArs(payment.amount, { decimals: 2 }))}</div>
  </div>
  <table>
    ${rows.map(([k, v]) => `<tr><td class="k">${escapeHtml(k)}</td><td class="v">${escapeHtml(v)}</td></tr>`).join('\n    ')}
  </table>
  <footer>
    Emitido por Paceron el ${escapeHtml(formatReceiptDate(issuedAt))}. Este comprobante registra un pago procesado
    por Mercado Pago y no es una factura fiscal.
  </footer>
</body>
</html>`;
}
