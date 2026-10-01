// Nombre legible del método de pago que devuelve Mercado Pago en
// `payment_method_id`. Si MP devuelve uno que no está mapeado, se muestra el id
// con mayúscula inicial en vez de ocultarlo.

const METHOD_LABELS = {
  visa: 'Visa',
  debvisa: 'Visa débito',
  master: 'Mastercard',
  debmaster: 'Mastercard débito',
  amex: 'American Express',
  naranja: 'Naranja',
  cabal: 'Cabal',
  debcabal: 'Cabal débito',
  maestro: 'Maestro',
  cencosud: 'Cencosud',
  argencard: 'Argencard',
  tarshop: 'Tarjeta Shopping',
  cmr: 'CMR',
  account_money: 'Dinero en cuenta de Mercado Pago',
  rapipago: 'Rapipago',
  pagofacil: 'Pago Fácil',
};

export function paymentMethodLabel(methodId) {
  if (!methodId) return '—';
  const known = METHOD_LABELS[methodId];
  if (known) return known;
  return methodId.charAt(0).toUpperCase() + methodId.slice(1).replace(/_/g, ' ');
}

// Tipo de pago del historial (lo decide el backend según la cuota).
export const PAYMENT_TYPE_LABELS = {
  subscription: 'Suscripción',
  trainer_payment: 'Pago a entrenador',
};

export function paymentTypeLabel(type) {
  return PAYMENT_TYPE_LABELS[type] ?? 'Pago';
}

export const PAYMENT_TYPE_FILTER_OPTIONS = [
  { id: 'subscription', name: 'Suscripciones' },
  { id: 'trainer_payment', name: 'Pagos a entrenadores' },
];
