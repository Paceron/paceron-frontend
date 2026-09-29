// Filtro de búsqueda por nombre de los selectores de la pantalla de asistencia
// (equipo → grupo → sesión, components/attendance/attendance-screen.jsx).
//
// Se ignora acentos y mayúsculas porque el equipo se elige escribiendo un
// nombre propio ("Club Sur") y en español eso falla constantemente sin
// normalizar: nadie escribe "nunez" con la ñ tilde, y el filtro tiene que
// encontrarlo igual.
//
// Es lógica pura a propósito (sin React ni hooks) para que entre en __tests__.

const DIACRITICS = /[\u0300-\u036f]/g;

// NFD descompone "ú" en "u" + U+0301; los diacríticos combinantes (el rango
// completo, no solo el acento agudo) se descartan. null/undefined y los
// números no rompen: se castean a string.
export function normalizeForSearch(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase();
}

// Filtra options por el campo nameKey (default 'name') con coincidencia por
// substring sobre el texto normalizado — "nú" encuentra a "Núñez" y a
// "Muñoz".
//
// Sin query (vacío o solo espacios) devuelve el array tal cual: el caller lo
// pinta tal cual vino, sin copia ni reordenamiento. Un nameKey ausente en un
// item no matchea (no matchea con nada, ni siquiera con la query vacía, que ya
// está cubierta antes).
export function filterByName(options, query, nameKey = 'name') {
  if (!Array.isArray(options)) return [];
  const needle = normalizeForSearch(query).trim();
  if (!needle) return options;
  return options.filter((option) => normalizeForSearch(option?.[nameKey]).includes(needle));
}
