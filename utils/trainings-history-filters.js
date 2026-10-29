import { toISODate } from './date-field-format.js';

// Política "de a par": si falta cualquiera de las dos fechas, ninguna viaja
// al backend (evita el 400 de date_from/date_to sueltos, ver Gap 13). Los
// valores crudos vienen de DateField en DD/MM/YYYY en ambas plataformas —
// toISODate() normaliza antes de comparar y enviar al backend.
export function buildDateRangeFilters(dateFromRaw, dateToRaw) {
  const dateFrom = toISODate(dateFromRaw);
  const dateTo = toISODate(dateToRaw);
  if (!dateFrom || !dateTo) return { dateFrom: null, dateTo: null, error: null };
  if (dateFrom > dateTo) {
    return { dateFrom: null, dateTo: null, error: 'La fecha "desde" no puede ser posterior a la fecha "hasta".' };
  }
  return { dateFrom, dateTo, error: null };
}
