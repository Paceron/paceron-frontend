// Color determinístico por userId -- mismo color para el borde del marcador en
// el mapa y el puntito antes del nombre en las listas de participantes (pre-start
// y en vivo), así se puede identificar a un corredor de un vistazo entre las dos
// vistas sin depender de leer el nombre completo cada vez. Ámbar excluido a
// propósito -- reservado para TRAINER_MARKER_COLOR, nunca se lo pisa el hash.
const PALETTE = ['#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9'];

export function colorForUserId(userId) {
  const str = String(userId ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) % 997;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// Color fijo (no sale del hash) para el marcador del propio entrenador en el
// mapa -- distinto de cualquier corredor sin importar el azar del hash.
export const TRAINER_MARKER_COLOR = '#f59e0b';
