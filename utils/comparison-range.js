import { buildDateRangeFilters } from './trainings-history-filters.js';

// Rango de la comparación (Gap 35). Mismas reglas que el backend, chequeadas
// antes de pedir para mostrar el error en el formulario en vez de un 400:
// las dos fechas, ordenadas, de 366 días como máximo y sin pasar de hoy.
// Sin rango cargado se usan los últimos 30 días.

export const MAX_COMPARISON_RANGE_DAYS = 366;
export const DEFAULT_COMPARISON_RANGE_DAYS = 30;

const pad2 = (n) => String(n).padStart(2, '0');

export function toLocalISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY', el formato que muestra DateField.
export function isoToFieldDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function defaultComparisonRange(now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DEFAULT_COMPARISON_RANGE_DAYS);
  return { fromInput: isoToFieldDate(toLocalISODate(from)), toInput: isoToFieldDate(toLocalISODate(now)) };
}

const isoToUtcMs = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const daysBetween = (fromIso, toIso) => Math.round((isoToUtcMs(toIso) - isoToUtcMs(fromIso)) / 86400000);

// Devuelve { dateFrom, dateTo, error } listos para la query. Si falta alguna
// fecha, dateFrom/dateTo quedan null y error explica qué falta.
export function buildComparisonRange(fromInput, toInput, now = new Date()) {
  if (!fromInput || !toInput) {
    return { dateFrom: null, dateTo: null, error: 'Elegí las dos fechas para comparar.' };
  }
  const { dateFrom, dateTo, error } = buildDateRangeFilters(fromInput, toInput);
  if (error) return { dateFrom: null, dateTo: null, error };
  if (!dateFrom || !dateTo) return { dateFrom: null, dateTo: null, error: 'Revisá el formato de las fechas (DD/MM/AAAA).' };
  if (dateTo > toLocalISODate(now)) {
    return { dateFrom: null, dateTo: null, error: 'La fecha "hasta" no puede ser posterior a hoy.' };
  }
  if (daysBetween(dateFrom, dateTo) > MAX_COMPARISON_RANGE_DAYS) {
    return { dateFrom: null, dateTo: null, error: `El rango no puede superar ${MAX_COMPARISON_RANGE_DAYS} días.` };
  }
  return { dateFrom, dateTo, error: null };
}
