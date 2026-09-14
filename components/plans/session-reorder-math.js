// Matemática pura de posicionamiento para el drag-and-drop de sesiones —
// sin dependencia de reanimated/gesture-handler, separada a propósito
// para poder testear los cálculos de índice sin un entorno de gestos
// real (ver __tests__/session-reorder-math.test.js). Las funciones
// llevan 'worklet' porque también se llaman desde dentro de workterls de
// react-native-reanimated en session-drag-and-drop.jsx — fuera de ese
// contexto (tests, JS plano) la directiva no tiene efecto, corren como
// funciones normales.
export const ESTIMATED_ROW_HEIGHT = 110;

// Índice estimado a partir de un desplazamiento vertical relativo (en px)
// y el alto de fila aproximado — usado tanto para "en qué posición del
// contenedor cayó el drop" (offset relativo al top del contenedor) como
// para "cuántas filas se corrió el drag" (offset relativo al top de la
// fila arrastrada). Sin tope superior — cada caller decide si clampear
// contra el largo real de la lista (ver clampIndex).
export function estimateIndexFromOffset(relativeOffset, rowHeight = ESTIMATED_ROW_HEIGHT) {
  'worklet';
  return Math.max(0, Math.round(relativeOffset / rowHeight));
}

// Ajusta un índice crudo al rango válido [0, itemCount - 1]. itemCount 0
// devuelve 0 (lista vacía, no hay a dónde clampear pero tampoco debería
// llamarse en ese caso).
export function clampIndex(index, itemCount) {
  'worklet';
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, index));
}

// Reordena moviendo el elemento en fromIndex a toIndex — sin mutar el
// array original. Devuelve la misma referencia sin cambios si los
// índices son iguales o inválidos (fuera de rango), para que un caller
// pueda usar el resultado directo como próximo estado sin chequear él
// mismo si hubo cambio real.
export function reorderList(list, fromIndex, toIndex) {
  if (
    fromIndex === toIndex
    || fromIndex < 0 || toIndex < 0
    || fromIndex >= list.length || toIndex >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
