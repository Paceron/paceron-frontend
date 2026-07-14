// Valida el alias de pagos: 6-20 caracteres, letras/números/puntos/guiones.
// Devuelve null si es válido, o un mensaje de error.
export function validateTrainerAlias(value) {
  if (!value || !value.trim()) return 'El alias es requerido.';
  const clean = value.trim();
  if (clean.length < 6 || clean.length > 20) return 'El alias debe tener entre 6 y 20 caracteres.';
  if (!/^[a-zA-Z0-9.-]+$/.test(clean)) return 'El alias solo puede tener letras, números, puntos y guiones.';
  return null;
}
