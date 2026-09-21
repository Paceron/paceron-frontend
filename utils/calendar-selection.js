// Regla de "una sola clase por selección" del modo multi-selección del
// calendario (docs/superpowers/specs/2026-09-21-calendar-multi-select-design.md
// §3) — la selección entera es de días cerrados o de días abiertos/futuros,
// nunca mezcla. `currentClosedClass` es el estado `closed` del primer día
// ya seleccionado (`null` si la selección está vacía, en cuyo caso
// cualquier día puede arrancarla).
export function canAddToSelection(currentClosedClass, candidateClosed) {
  if (currentClosedClass === null) return true;
  return candidateClosed === currentClosedClass;
}
