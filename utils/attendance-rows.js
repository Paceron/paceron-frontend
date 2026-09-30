import { filterByName } from './attendance-filter.js';

// Filtrado y orden de la grilla de asistencia.
//
// La fila del backend trae UN solo campo `name` con el nombre completo
// (`SessionAttendanceRow` = user_id, name, email, attendance_id, status,
// source, registered_at) — no hay nombre y apellido por separado. Por eso el
// filtro por "nombre o apellido" sale solo: es un substring sobre el nombre
// completo, y `filterByName` ya normaliza acentos y mayúsculas, así que
// `núñez`, `Nunez` y `nuñez` encuentran lo mismo.

// Ordenar con `localeCompare` en español y `sensitivity: 'base'` importa por dos
// cosas concretas: sin el locale, "Ñ" se va después de la Z y los nombres con
// Ñ quedan al final de la lista; con `base`, las tildes y la Ñ se comparan como
// si no estuvieran, que es lo que espera cualquiera que ordena alfabéticamente
// una lista de nombres en español.
export function sortRowsByName(rows, order = 'asc') {
  const sign = order === 'desc' ? -1 : 1;
  // Copia antes de ordenar: `Array.prototype.sort` es in-place y el array viene
  // de la cache de Query — mutarlo reordería el cache bajo los pies de React.
  return [...rows].sort((a, b) => sign * String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'es', { sensitivity: 'base' }));
}

// Filtra por nombre y ordena, en un solo paso. Query vacío devuelve todo
// (ordenado igual, que es lo que espera un usuario que acaba de tocar el filtro:
// quiere ver el orden, no el desorden del server).
export function filterAndSortRows(rows, query, order = 'asc') {
  return sortRowsByName(filterByName(rows, query, 'name'), order);
}
