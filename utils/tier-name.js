// Nombre de un tier para mostrar. El backend lo manda como identificador
// (`premium_corredor`, `base_entrenador`): se saca el sufijo de rol, que la UI
// ya muestra aparte, los guiones bajos que queden pasan a espacios y se
// capitaliza (`premium_corredor` → "Premium"). Solo para el texto: para
// comparar contra el tier actual (roles[].tier) se usa el nombre crudo.
export function formatTierName(name, fallback = '') {
  const base = String(name ?? '')
    .trim()
    .replace(/_(corredor|entrenador)$/i, '')
    .replace(/_+/g, ' ')
    .trim();
  if (!base) return fallback;
  return base.charAt(0).toUpperCase() + base.slice(1);
}
