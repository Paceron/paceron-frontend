// Estados de pago de Mercado Pago y cómo se muestran.
//
// El backend ya manda `status_group` en cada pago, agrupado igual que acá
// (constants/payment_status.go). Esta tabla es el espejo que usan el mock y
// los filtros; si MP suma un estado nuevo, cae en "other".

export const STATUS_GROUP_STATUSES = {
  approved: ['approved'],
  pending: ['pending', 'in_process', 'authorized'],
  rejected: ['rejected', 'cancelled'],
  refunded: ['refunded', 'charged_back'],
};

export function statusGroupOf(status) {
  const entry = Object.entries(STATUS_GROUP_STATUSES).find(([, statuses]) => statuses.includes(status));
  return entry ? entry[0] : 'other';
}

// tone: success | warning | danger | neutral. El componente decide los colores.
export const PAYMENT_STATUS_META = {
  approved: { label: 'Aprobado', tone: 'success' },
  pending: { label: 'Pendiente', tone: 'warning' },
  in_process: { label: 'En proceso', tone: 'warning' },
  authorized: { label: 'Autorizado', tone: 'warning' },
  rejected: { label: 'Rechazado', tone: 'danger' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
  refunded: { label: 'Reembolsado', tone: 'neutral' },
  charged_back: { label: 'Contracargo', tone: 'neutral' },
};

const GROUP_FALLBACK = {
  approved: PAYMENT_STATUS_META.approved,
  pending: PAYMENT_STATUS_META.pending,
  rejected: PAYMENT_STATUS_META.rejected,
  refunded: PAYMENT_STATUS_META.refunded,
  other: { label: 'Otro', tone: 'neutral' },
};

export function paymentStatusMeta(status, statusGroup) {
  return PAYMENT_STATUS_META[status] ?? GROUP_FALLBACK[statusGroup] ?? GROUP_FALLBACK.other;
}

// Opciones del filtro de estado de la lista de cobros. "Todos" es el
// placeholder del select (valor ''), no una opción más.
export const STATUS_FILTER_OPTIONS = [
  { id: 'approved', name: 'Aprobados' },
  { id: 'pending', name: 'Pendientes' },
  { id: 'rejected', name: 'Rechazados' },
  { id: 'refunded', name: 'Reembolsados' },
];
