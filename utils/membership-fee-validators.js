import { formatArs } from './currency.js';

// Valida la cuota mensual de un equipo (teams.membership_fee).
// Devuelve null si es válida, o un mensaje de error.
//
// Reglas, espejando el backend: el campo es OPCIONAL (vacío = no se manda, el
// backend deja el default 0), `0` es válido y significa equipo gratis, y
// cualquier monto mayor a 0 tiene que llegar al mínimo que devuelve
// GET /team-configuration (derivado del tier del entrenador). El mínimo se pasa
// como argumento y puede venir null si esa request todavía no resolvió — en ese
// caso no se valida contra el piso (mejor dejar pasar y que el backend rechace
// con 400 que bloquear el form por un dato que no cargó).
export function validateMembershipFee(value, minimumFee) {
  if (value === undefined || value === null || String(value).trim() === '') return null;

  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Ingresá un monto válido.';
  if (amount < 0) return 'La cuota no puede ser negativa.';
  if (amount === 0) return null;

  if (Number.isFinite(Number(minimumFee)) && Number(minimumFee) > 0 && amount < Number(minimumFee)) {
    return `El mínimo permitido es ${formatArs(minimumFee)}.`;
  }

  return null;
}
