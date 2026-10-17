// Medalla para los primeros 3 puestos -- el resto (incluida la fila
// propia cuando no entra en el top 5) se muestra como número plano,
// decisión del componente, no de esta util.
const RANK_META = {
  1: { icon: 'medal', color: '#eab308' },
  2: { icon: 'medal', color: '#94a3b8' },
  3: { icon: 'medal', color: '#b45309' },
};

export function rankMeta(rank) {
  return RANK_META[rank] ?? null;
}
